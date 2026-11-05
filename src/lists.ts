export type ListName = "forTrade" | "wishlist";

export interface Lists {
  forTrade: string[];
  wishlist: string[];
}

export interface Trader {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  kccName: string | null;
  kccId: string | null;
}

export interface ListChange {
  list: ListName;
  key: string;
  present: boolean;
}

export interface ListsResponse extends Lists {
  accepting: boolean;
}

export interface ListEnv {
  DB: D1Database;
}

export interface TraderRow {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  kcc_name: string | null;
  kcc_id: string | null;
  accepting: number;
}

interface EntryRow {
  list: ListName;
  card_key: string;
}

const KEY_PATTERN = /^[0-9a-f-]{36}:(?:[0-9a-f-]{36})?:(?:Common|B|A|S|SS|SSS)$/i;
const MAX_PER_LIST = 400;
const MAX_CHANGES = 200;

export function parseChanges(value: unknown): ListChange[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CHANGES) return null;
  const changes: ListChange[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { list, key, present } = item as Record<string, unknown>;
    if (list !== "forTrade" && list !== "wishlist") return null;
    if (typeof key !== "string" || !KEY_PATTERN.test(key) || typeof present !== "boolean") return null;
    changes.push({ list, key, present });
  }
  return changes;
}

export function traderFromRow(row: TraderRow): Trader {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    avatarUrl: row.avatar_url,
    kccName: row.kcc_name,
    kccId: row.kcc_id,
  };
}

function saveTrader(env: ListEnv, trader: Trader, accepting?: boolean): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO traders (id, name, username, avatar_url, kcc_name, kcc_id, accepting)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, COALESCE(?7, 1))
     ON CONFLICT (id) DO UPDATE SET
       name = excluded.name,
       username = excluded.username,
       avatar_url = excluded.avatar_url,
       kcc_name = excluded.kcc_name,
       kcc_id = excluded.kcc_id,
       accepting = COALESCE(?7, accepting)
     WHERE name IS NOT excluded.name
       OR username IS NOT excluded.username
       OR avatar_url IS NOT excluded.avatar_url
       OR kcc_name IS NOT excluded.kcc_name
       OR kcc_id IS NOT excluded.kcc_id
       OR accepting IS NOT COALESCE(?7, accepting)`,
  ).bind(
    trader.id,
    trader.name,
    trader.username,
    trader.avatarUrl,
    trader.kccName,
    trader.kccId,
    accepting === undefined ? null : Number(accepting),
  );
}

function selectTrader(env: ListEnv, id: string): D1PreparedStatement {
  return env.DB.prepare(
    "SELECT id, name, username, avatar_url, kcc_name, kcc_id, accepting FROM traders WHERE id = ?",
  ).bind(id);
}

function selectEntries(env: ListEnv, id: string): D1PreparedStatement {
  return env.DB.prepare(
    "SELECT list, card_key FROM list_entries WHERE trader_id = ? ORDER BY added_at DESC",
  ).bind(id);
}

function listsFrom(rows: EntryRow[]): Lists {
  const lists: Lists = { forTrade: [], wishlist: [] };
  for (const row of rows) lists[row.list].push(row.card_key);
  return lists;
}

function responseFrom(trader: D1Result, entries: D1Result): ListsResponse {
  const row = trader.results[0] as TraderRow | undefined;
  return { ...listsFrom(entries.results as unknown as EntryRow[]), accepting: row?.accepting !== 0 };
}

export async function readLists(env: ListEnv, trader: Trader): Promise<ListsResponse> {
  const [, row, entries] = await env.DB.batch([
    saveTrader(env, trader),
    selectTrader(env, trader.id),
    selectEntries(env, trader.id),
  ]);
  return responseFrom(row, entries);
}

export async function setAccepting(env: ListEnv, trader: Trader, accepting: boolean): Promise<ListsResponse> {
  const [, row, entries] = await env.DB.batch([
    saveTrader(env, trader, accepting),
    selectTrader(env, trader.id),
    selectEntries(env, trader.id),
  ]);
  return responseFrom(row, entries);
}

export async function readPublicLists(
  env: ListEnv,
  userId: string,
): Promise<(ListsResponse & { trader: Trader }) | null> {
  const [row, entries] = await env.DB.batch([selectTrader(env, userId), selectEntries(env, userId)]);
  const trader = row.results[0] as TraderRow | undefined;
  if (!trader) return null;
  return { ...responseFrom(row, entries), trader: traderFromRow(trader) };
}

export async function changeLists(
  env: ListEnv,
  trader: Trader,
  changes: ListChange[],
): Promise<ListsResponse & { full: boolean }> {
  const existing = listsFrom((await selectEntries(env, trader.id).all<EntryRow>()).results);
  const members = { forTrade: new Set(existing.forTrade), wishlist: new Set(existing.wishlist) };
  const now = Date.now();
  const writes: D1PreparedStatement[] = [saveTrader(env, trader)];
  let full = false;

  changes.forEach(({ list, key, present }, index) => {
    if (!present) {
      members[list].delete(key);
      writes.push(
        env.DB.prepare("DELETE FROM list_entries WHERE trader_id = ? AND list = ? AND card_key = ?").bind(
          trader.id,
          list,
          key,
        ),
      );
      return;
    }
    if (!members[list].has(key) && members[list].size >= MAX_PER_LIST) {
      full = true;
      return;
    }
    members[list].add(key);
    writes.push(
      env.DB.prepare(
        `INSERT INTO list_entries (trader_id, list, card_key, added_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (trader_id, list, card_key) DO UPDATE SET added_at = excluded.added_at`,
      ).bind(trader.id, list, key, now + index),
    );
  });

  const results = await env.DB.batch([...writes, selectTrader(env, trader.id), selectEntries(env, trader.id)]);
  return { ...responseFrom(results[results.length - 2], results[results.length - 1]), full };
}
