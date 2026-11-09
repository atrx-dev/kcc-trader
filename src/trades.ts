import { TRADER_COLUMNS, traderFromRow, type ListEnv, type ListName, type Trader, type TraderRow } from "./lists.ts";
import { copiesForKeys, readCachedDuplicates } from "./owned.ts";

export interface TradeMatch {
  trader: Trader;
  theyHave: string[];
  theyWant: string[];
  priority: string[];
  /** Their spare counts for cards in theyHave (from cached collection sync). */
  theyHaveCopies?: Record<string, number>;
}

interface MatchRow extends TraderRow {
  list: ListName;
  card_key: string;
  wanted_priority: number;
}

export const INACTIVE_AFTER = 30 * 24 * 60 * 60 * 1000;

const MATCH_QUERY = `
  SELECT ${TRADER_COLUMNS}, theirs.list, theirs.card_key,
    CASE WHEN mine.list = 'wishlist' THEN mine.priority ELSE theirs.priority END AS wanted_priority
  FROM list_entries AS mine
  JOIN list_entries AS theirs
    ON theirs.card_key = mine.card_key
    AND theirs.list = CASE mine.list WHEN 'wishlist' THEN 'forTrade' ELSE 'wishlist' END
  JOIN traders ON traders.id = theirs.trader_id
  WHERE mine.trader_id = ?1 AND theirs.trader_id != ?1 AND traders.accepting = 1 AND traders.last_seen_at >= ?2
  ORDER BY theirs.added_at DESC`;

const DEMAND_QUERY = `
  SELECT list_entries.card_key AS card_key, COUNT(*) AS demand
  FROM list_entries
  JOIN traders ON traders.id = list_entries.trader_id
  WHERE list_entries.list = 'wishlist' AND list_entries.trader_id != ?1
    AND traders.accepting = 1 AND traders.last_seen_at >= ?2
  GROUP BY list_entries.card_key`;

export async function wishlistDemand(env: ListEnv, userId: string): Promise<Record<string, number>> {
  const { results } = await env.DB.prepare(DEMAND_QUERY)
    .bind(userId, Date.now() - INACTIVE_AFTER)
    .all<{ card_key: string; demand: number }>();
  const demand: Record<string, number> = {};
  for (const row of results) {
    const count = Number(row.demand);
    if (count > 0) demand[row.card_key] = count;
  }
  return demand;
}

export async function findTrades(
  env: ListEnv & { CARDS: KVNamespace },
  userId: string,
): Promise<TradeMatch[]> {
  const { results } = await env.DB.prepare(MATCH_QUERY).bind(userId, Date.now() - INACTIVE_AFTER).all<MatchRow>();
  const byTrader = new Map<string, TradeMatch>();
  for (const row of results) {
    let match = byTrader.get(row.id);
    if (!match) {
      match = { trader: traderFromRow(row), theyHave: [], theyWant: [], priority: [] };
      byTrader.set(row.id, match);
    }
    if (row.list === "forTrade") match.theyHave.push(row.card_key);
    else match.theyWant.push(row.card_key);
    if (row.wanted_priority) match.priority.push(row.card_key);
  }

  const matches = [...byTrader.values()];
  const profileIds = [...new Set(matches.map((match) => match.trader.kccId).filter(Boolean))] as string[];
  const duplicatesByProfile = new Map<string, Record<string, number>>();
  await Promise.all(
    profileIds.map(async (profileId) => {
      duplicatesByProfile.set(profileId, await readCachedDuplicates(env, profileId));
    }),
  );
  for (const match of matches) {
    const profileId = match.trader.kccId;
    if (!profileId || match.theyHave.length === 0) continue;
    const copies = copiesForKeys(duplicatesByProfile.get(profileId) ?? {}, match.theyHave);
    if (Object.keys(copies).length > 0) match.theyHaveCopies = copies;
  }

  const score = (match: TradeMatch) => Math.min(match.theyHave.length, match.theyWant.length);
  const priorityHits = (match: TradeMatch) => {
    const wanted = new Set(match.priority);
    return match.theyHave.reduce((count, key) => count + (wanted.has(key) ? 1 : 0), 0);
  };
  return matches.sort(
    (a, b) =>
      score(b) - score(a) ||
      priorityHits(b) - priorityHits(a) ||
      b.theyHave.length + b.theyWant.length - (a.theyHave.length + a.theyWant.length) ||
      a.trader.name.localeCompare(b.trader.name),
  );
}
