export type ListName = "forTrade" | "wishlist";

export interface Lists {
  forTrade: string[];
  wishlist: string[];
  priority?: string[];
  auto?: string[];
  skips?: string[];
  keeps?: string[];
}

export interface Trader {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  kccName: string | null;
  kccId: string | null;
  lastSeenAt?: number | null;
}

export interface ListChange {
  list: ListName;
  key: string;
  present: boolean;
  auto?: boolean;
  priority?: boolean;
  skip?: boolean;
  keep?: boolean;
}

export interface Preferences {
  accepting: boolean;
  pruneWishlist: boolean;
  listDuplicates: boolean;
}

export interface ListSync {
  removed: Lists;
  unlisted: string[];
  added: string[];
}

export interface ListsResponse extends Lists, Preferences {}

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
  prune_wishlist?: number;
  list_duplicates?: number;
  last_seen_at: number;
  introduced?: number;
}

interface EntryRow {
  list: ListName;
  card_key: string;
  priority?: number;
  auto?: number;
}

const KEY_PATTERN = /^[0-9a-f-]{36}:(?:[0-9a-f-]{36})?:(?:Common|B|A|S|SS|SSS)$/i;
const MAX_PER_LIST = 400;
const MAX_CHANGES = 200;
const SEEN_RESOLUTION = 60 * 60 * 1000;
export const TRADER_COLUMNS =
  "traders.id, traders.name, traders.username, traders.avatar_url, traders.kcc_name, traders.kcc_id, traders.accepting, traders.prune_wishlist, traders.list_duplicates, traders.last_seen_at, traders.introduced";

export function parseChanges(value: unknown): ListChange[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CHANGES) return null;
  const changes: ListChange[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { list, key, present, auto, priority, skip, keep } = item as Record<string, unknown>;
    if (list !== "forTrade" && list !== "wishlist") return null;
    if (typeof key !== "string" || !KEY_PATTERN.test(key) || typeof present !== "boolean") return null;
    if (auto !== undefined && typeof auto !== "boolean") return null;
    if (priority !== undefined && (typeof priority !== "boolean" || list !== "wishlist")) return null;
    if (skip !== undefined && (typeof skip !== "boolean" || list !== "forTrade")) return null;
    if (keep !== undefined && (typeof keep !== "boolean" || list !== "wishlist")) return null;
    changes.push({
      list,
      key,
      present,
      auto: auto === true,
      ...(typeof priority === "boolean" ? { priority } : {}),
      ...(typeof skip === "boolean" ? { skip } : {}),
      ...(typeof keep === "boolean" ? { keep } : {}),
    });
  }
  return changes;
}

const TRADER_SEARCH_LIMIT = 8;

export async function countTraders(env: ListEnv): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM traders WHERE sss IS NOT NULL",
  ).first<{ total: number }>();
  return Number(row?.total ?? 0);
}

/** Traders with no public collection who have not been seen for this long. */
export const STALE_PRIVATE_MS = 30 * 24 * 60 * 60 * 1000;

export async function listStalePrivateTraders(
  env: ListEnv,
  olderThanMs = STALE_PRIVATE_MS,
): Promise<{ id: string; kccId: string | null }[]> {
  const rows = await env.DB.prepare(
    "SELECT id, kcc_id FROM traders WHERE sss IS NULL AND last_seen_at < ? ORDER BY last_seen_at",
  )
    .bind(Date.now() - olderThanMs)
    .all<{ id: string; kcc_id: string | null }>();
  return rows.results.map((row) => ({ id: row.id, kccId: row.kcc_id }));
}

export async function deleteTraders(env: ListEnv, ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await env.DB.batch(ids.map((id) => env.DB.prepare("DELETE FROM traders WHERE id = ?").bind(id)));
  return result.reduce((sum, item) => sum + (item.meta.changes ?? 0), 0);
}

export type LeaderboardBy = "sss" | "level" | "value";

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  kccName: string | null;
  sss: number;
  level: number;
  value: number;
}

const LEADERBOARD_ORDER: Record<LeaderboardBy, string> = {
  sss: "sss DESC, collection_value DESC, level DESC",
  level: "level DESC, sss DESC, collection_value DESC",
  value: "collection_value DESC, sss DESC, level DESC",
};

export interface CollectionStats {
  cards: number;
  sss: number;
  level: number;
  collectionValue: number | null;
}

export function recordCollection(env: ListEnv, traderId: string, stats: CollectionStats | null): Promise<D1Result> {
  if (!stats) {
    return env.DB.prepare(
      "UPDATE traders SET cards = NULL, sss = NULL, level = NULL, collection_value = NULL WHERE id = ?",
    )
      .bind(traderId)
      .run();
  }
  return env.DB.prepare(
    "UPDATE traders SET cards = ?2, sss = ?3, level = ?4, collection_value = COALESCE(?5, collection_value) WHERE id = ?1",
  )
    .bind(traderId, stats.cards, stats.sss, stats.level, stats.collectionValue)
    .run();
}

export async function readLeaderboard(env: ListEnv, by: LeaderboardBy): Promise<LeaderboardEntry[]> {
  const rows = await env.DB.prepare(
    `SELECT id, name, username, avatar_url, kcc_name, sss, level, collection_value AS value
     FROM traders
     WHERE sss IS NOT NULL${by === "value" ? " AND collection_value IS NOT NULL" : ""}
     ORDER BY ${LEADERBOARD_ORDER[by]}, name COLLATE NOCASE
     LIMIT 100`,
  ).all<{
    id: string;
    name: string;
    username: string;
    avatar_url: string;
    kcc_name: string | null;
    sss: number;
    level: number;
    value: number | null;
  }>();
  let rank = 0;
  let previous = Number.NaN;
  return rows.results.map((row, index) => {
    const score = by === "value" ? row.value ?? 0 : row[by];
    if (score !== previous) {
      rank = index + 1;
      previous = score;
    }
    return {
      rank,
      id: row.id,
      name: row.name,
      username: row.username,
      avatarUrl: row.avatar_url,
      kccName: row.kcc_name,
      sss: row.sss,
      level: row.level,
      value: row.value ?? 0,
    };
  });
}

export async function searchTraders(env: ListEnv, raw: string): Promise<Trader[]> {
  const query = raw.trim().slice(0, 40);
  if (query.length < 2) return [];
  const escaped = query.replace(/[\\%_]/g, (char) => `\\${char}`);
  const rows = await env.DB.prepare(
    `SELECT ${TRADER_COLUMNS} FROM traders
     WHERE sss IS NOT NULL
       AND (
         name LIKE ?1 ESCAPE '\\' COLLATE NOCASE
         OR username LIKE ?1 ESCAPE '\\' COLLATE NOCASE
         OR IFNULL(kcc_name, '') LIKE ?1 ESCAPE '\\' COLLATE NOCASE
       )
     ORDER BY
       CASE
         WHEN name LIKE ?2 ESCAPE '\\' COLLATE NOCASE
           OR username LIKE ?2 ESCAPE '\\' COLLATE NOCASE
           OR IFNULL(kcc_name, '') LIKE ?2 ESCAPE '\\' COLLATE NOCASE
         THEN 0 ELSE 1
       END,
       name COLLATE NOCASE
     LIMIT ${TRADER_SEARCH_LIMIT}`,
  )
    .bind(`%${escaped}%`, `${escaped}%`)
    .all<TraderRow>();
  return rows.results.map(traderFromRow);
}

export function traderFromRow(row: TraderRow): Trader {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    avatarUrl: row.avatar_url,
    kccName: row.kcc_name,
    kccId: row.kcc_id,
    lastSeenAt: row.last_seen_at || null,
  };
}

function flag(value: boolean | undefined): number | null {
  return value === undefined ? null : Number(value);
}

export function rememberTrader(env: ListEnv, trader: Trader): Promise<D1Result> {
  return saveTrader(env, trader).run();
}

function saveTrader(env: ListEnv, trader: Trader, preferences: Partial<Preferences> = {}): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO traders (id, name, username, avatar_url, kcc_name, kcc_id, accepting, prune_wishlist, list_duplicates, last_seen_at, introduced)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, COALESCE(?7, 1), COALESCE(?8, 1), COALESCE(?10, 0), ?9, 0)
     ON CONFLICT (id) DO UPDATE SET
       name = excluded.name,
       username = excluded.username,
       avatar_url = excluded.avatar_url,
       kcc_name = excluded.kcc_name,
       kcc_id = excluded.kcc_id,
       accepting = COALESCE(?7, accepting),
       prune_wishlist = COALESCE(?8, prune_wishlist),
       list_duplicates = COALESCE(?10, list_duplicates),
       last_seen_at = excluded.last_seen_at
     WHERE last_seen_at < ?9 - ${SEEN_RESOLUTION}
       OR name IS NOT excluded.name
       OR username IS NOT excluded.username
       OR avatar_url IS NOT excluded.avatar_url
       OR kcc_name IS NOT excluded.kcc_name
       OR kcc_id IS NOT excluded.kcc_id
       OR accepting IS NOT COALESCE(?7, accepting)
       OR prune_wishlist IS NOT COALESCE(?8, prune_wishlist)
       OR list_duplicates IS NOT COALESCE(?10, list_duplicates)`,
  ).bind(
    trader.id,
    trader.name,
    trader.username,
    trader.avatarUrl,
    trader.kccName,
    trader.kccId,
    flag(preferences.accepting),
    flag(preferences.pruneWishlist),
    Date.now(),
    flag(preferences.listDuplicates),
  );
}

function selectTrader(env: ListEnv, id: string): D1PreparedStatement {
  return env.DB.prepare(`SELECT ${TRADER_COLUMNS} FROM traders WHERE id = ?`).bind(id);
}

function selectEntries(env: ListEnv, id: string): D1PreparedStatement {
  return env.DB.prepare(
    "SELECT list, card_key, priority, auto FROM list_entries WHERE trader_id = ? ORDER BY added_at DESC",
  ).bind(id);
}

function selectSkips(env: ListEnv, id: string): D1PreparedStatement {
  return env.DB.prepare("SELECT card_key FROM trade_skips WHERE trader_id = ?").bind(id);
}

function selectKeeps(env: ListEnv, id: string): D1PreparedStatement {
  return env.DB.prepare("SELECT card_key FROM wishlist_keeps WHERE trader_id = ?").bind(id);
}

function listsFrom(rows: EntryRow[]): Lists {
  const lists: Lists = { forTrade: [], wishlist: [], priority: [], auto: [] };
  for (const row of rows) {
    lists[row.list].push(row.card_key);
    if (row.list === "wishlist" && row.priority) lists.priority!.push(row.card_key);
    if (row.list === "forTrade" && row.auto) lists.auto!.push(row.card_key);
  }
  return lists;
}

function responseFrom(trader: D1Result, entries: D1Result, skips: D1Result, keeps: D1Result): ListsResponse {
  const row = trader.results[0] as TraderRow | undefined;
  return {
    ...listsFrom(entries.results as unknown as EntryRow[]),
    skips: (skips.results as { card_key: string }[]).map((skip) => skip.card_key),
    keeps: (keeps.results as { card_key: string }[]).map((keep) => keep.card_key),
    accepting: row?.accepting !== 0,
    pruneWishlist: row?.prune_wishlist !== 0,
    listDuplicates: row?.list_duplicates === 1,
  };
}

export async function readLists(env: ListEnv, trader: Trader): Promise<ListsResponse & { welcome: boolean }> {
  const [, row, entries, skips, keeps] = await env.DB.batch([
    saveTrader(env, trader),
    selectTrader(env, trader.id),
    selectEntries(env, trader.id),
    selectSkips(env, trader.id),
    selectKeeps(env, trader.id),
  ]);
  const stored = row.results[0] as TraderRow | undefined;
  return { ...responseFrom(row, entries, skips, keeps), welcome: stored?.introduced === 0 };
}

export function markIntroduced(env: ListEnv, traderId: string): Promise<D1Result> {
  return env.DB.prepare("UPDATE traders SET introduced = 1 WHERE id = ?").bind(traderId).run();
}

export async function setPreferences(
  env: ListEnv,
  trader: Trader,
  preferences: Partial<Preferences>,
): Promise<ListsResponse> {
  const [, row, entries, skips, keeps] = await env.DB.batch([
    saveTrader(env, trader, preferences),
    selectTrader(env, trader.id),
    selectEntries(env, trader.id),
    selectSkips(env, trader.id),
    selectKeeps(env, trader.id),
  ]);
  return responseFrom(row, entries, skips, keeps);
}

export async function readPublicLists(
  env: ListEnv,
  userId: string,
): Promise<(Lists & { accepting: boolean; trader: Trader }) | null> {
  const [row, entries, skips, keeps] = await env.DB.batch([
    selectTrader(env, userId),
    selectEntries(env, userId),
    selectSkips(env, userId),
    selectKeeps(env, userId),
  ]);
  const trader = row.results[0] as TraderRow | undefined;
  if (!trader) return null;
  const { pruneWishlist: _, listDuplicates: __, auto: ___, skips: ____, keeps: _____, ...lists } = responseFrom(
    row,
    entries,
    skips,
    keeps,
  );
  return { ...lists, trader: traderFromRow(trader) };
}

export async function syncLists(
  env: ListEnv,
  traderId: string,
  owns: (key: string) => boolean,
  duplicates: string[],
  newDuplicates: string[],
): Promise<ListSync> {
  const [traderResult, entryResult, skipResult, keepResult] = await env.DB.batch([
    env.DB.prepare("SELECT prune_wishlist, list_duplicates FROM traders WHERE id = ?").bind(traderId),
    env.DB.prepare("SELECT list, card_key, auto FROM list_entries WHERE trader_id = ?").bind(traderId),
    env.DB.prepare("SELECT card_key FROM trade_skips WHERE trader_id = ?").bind(traderId),
    env.DB.prepare("SELECT card_key FROM wishlist_keeps WHERE trader_id = ?").bind(traderId),
  ]);
  const trader = traderResult.results[0] as Pick<TraderRow, "prune_wishlist" | "list_duplicates"> | undefined;
  const sync: ListSync = { removed: { forTrade: [], wishlist: [] }, unlisted: [], added: [] };
  if (!trader) return sync;

  const spare = new Set(duplicates);
  const skipped = new Set((skipResult.results as { card_key: string }[]).map((row) => row.card_key));
  const kept = new Set((keepResult.results as { card_key: string }[]).map((row) => row.card_key));
  const listed = new Set<string>();
  for (const { list, card_key: key, auto } of entryResult.results as unknown as (EntryRow & { auto: number })[]) {
    if (list === "wishlist") {
      if (trader.prune_wishlist !== 0 && owns(key) && !kept.has(key)) sync.removed.wishlist.push(key);
    } else if (!owns(key)) {
      sync.removed.forTrade.push(key);
    } else if (auto && (skipped.has(key) || (trader.list_duplicates && !spare.has(key)))) {
      sync.unlisted.push(key);
    } else {
      listed.add(key);
    }
  }
  if (trader.list_duplicates) {
    const room = Math.max(0, MAX_PER_LIST - listed.size);
    sync.added = newDuplicates.filter((key) => !listed.has(key) && !skipped.has(key)).slice(0, room);
  }

  const writes = [
    { list: "forTrade", keys: [...sync.removed.forTrade, ...sync.unlisted] },
    { list: "wishlist", keys: sync.removed.wishlist },
  ]
    .filter(({ keys }) => keys.length > 0)
    .map(({ list, keys }) =>
      env.DB.prepare(
        "DELETE FROM list_entries WHERE trader_id = ? AND list = ? AND card_key IN (SELECT value FROM json_each(?))",
      ).bind(traderId, list, JSON.stringify(keys)),
    );
  if (sync.added.length > 0) {
    writes.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO list_entries (trader_id, list, card_key, added_at, auto)
         SELECT ?1, 'forTrade', value, ?2 + key, 1 FROM json_each(?3)`,
      ).bind(traderId, Date.now(), JSON.stringify(sync.added)),
    );
  }
  if (writes.length > 0) await env.DB.batch(writes);
  return sync;
}

export async function changeLists(
  env: ListEnv,
  trader: Trader,
  changes: ListChange[],
): Promise<ListsResponse & { full: boolean }> {
  const existing = listsFrom((await selectEntries(env, trader.id).all<EntryRow>()).results);
  const members = { forTrade: new Set(existing.forTrade), wishlist: new Set(existing.wishlist) };
  const autoKeys = new Set(existing.auto ?? []);
  const now = Date.now();
  const writes: D1PreparedStatement[] = [saveTrader(env, trader)];
  let full = false;

  changes.forEach(({ list, key, present, auto, priority, skip, keep }, index) => {
    if (list === "forTrade" && skip === true) {
      writes.push(
        env.DB.prepare("INSERT OR IGNORE INTO trade_skips (trader_id, card_key) VALUES (?, ?)").bind(trader.id, key),
      );
      if (!present || autoKeys.has(key)) {
        autoKeys.delete(key);
        members.forTrade.delete(key);
        writes.push(
          env.DB.prepare("DELETE FROM list_entries WHERE trader_id = ? AND list = 'forTrade' AND card_key = ?").bind(
            trader.id,
            key,
          ),
        );
      }
      return;
    }
    if (list === "forTrade" && skip === false && (!present || members.forTrade.has(key))) {
      writes.push(env.DB.prepare("DELETE FROM trade_skips WHERE trader_id = ? AND card_key = ?").bind(trader.id, key));
      return;
    }
    if (list === "wishlist" && keep === true) {
      writes.push(
        env.DB.prepare("INSERT OR IGNORE INTO wishlist_keeps (trader_id, card_key) VALUES (?, ?)").bind(trader.id, key),
      );
      return;
    }
    if (list === "wishlist" && keep === false) {
      writes.push(env.DB.prepare("DELETE FROM wishlist_keeps WHERE trader_id = ? AND card_key = ?").bind(trader.id, key));
      if (!present) {
        members.wishlist.delete(key);
        writes.push(
          env.DB.prepare("DELETE FROM list_entries WHERE trader_id = ? AND list = 'wishlist' AND card_key = ?").bind(
            trader.id,
            key,
          ),
        );
      }
      return;
    }
    if (!present) {
      members[list].delete(key);
      if (list === "forTrade") autoKeys.delete(key);
      if (list === "wishlist") {
        writes.push(
          env.DB.prepare("DELETE FROM wishlist_keeps WHERE trader_id = ? AND card_key = ?").bind(trader.id, key),
        );
      }
      writes.push(
        env.DB.prepare("DELETE FROM list_entries WHERE trader_id = ? AND list = ? AND card_key = ?").bind(
          trader.id,
          list,
          key,
        ),
      );
      return;
    }
    if (members[list].has(key) && list === "wishlist" && priority !== undefined) {
      writes.push(
        env.DB.prepare("UPDATE list_entries SET priority = ? WHERE trader_id = ? AND list = ? AND card_key = ?").bind(
          priority ? 1 : 0,
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
    const automatic = list === "forTrade" && auto ? 1 : 0;
    if (list === "forTrade") {
      if (automatic) autoKeys.add(key);
      else autoKeys.delete(key);
    }
    if (list === "forTrade" && (automatic || skip === false)) {
      writes.push(env.DB.prepare("DELETE FROM trade_skips WHERE trader_id = ? AND card_key = ?").bind(trader.id, key));
    }
    writes.push(
      env.DB.prepare(
        `INSERT INTO list_entries (trader_id, list, card_key, added_at, auto, priority) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (trader_id, list, card_key) DO UPDATE SET added_at = excluded.added_at, auto = excluded.auto`,
      ).bind(trader.id, list, key, now + index, automatic, list === "wishlist" && priority ? 1 : 0),
    );
  });

  const results = await env.DB.batch([
    ...writes,
    selectTrader(env, trader.id),
    selectEntries(env, trader.id),
    selectSkips(env, trader.id),
    selectKeeps(env, trader.id),
  ]);
  return {
    ...responseFrom(
      results[results.length - 4],
      results[results.length - 3],
      results[results.length - 2],
      results[results.length - 1],
    ),
    full,
  };
}
