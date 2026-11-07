import { TRADER_COLUMNS, traderFromRow, type ListEnv, type ListName, type Trader, type TraderRow } from "./lists.ts";

export interface TradeMatch {
  trader: Trader;
  theyHave: string[];
  theyWant: string[];
  priority: string[];
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

export async function findTrades(env: ListEnv, userId: string): Promise<TradeMatch[]> {
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

  const score = (match: TradeMatch) => Math.min(match.theyHave.length, match.theyWant.length);
  const priorityHits = (match: TradeMatch) => {
    const wanted = new Set(match.priority);
    return match.theyHave.reduce((count, key) => count + (wanted.has(key) ? 1 : 0), 0);
  };
  return [...byTrader.values()].sort(
      (a, b) =>
        score(b) - score(a) ||
        priorityHits(b) - priorityHits(a) ||
        b.theyHave.length + b.theyWant.length - (a.theyHave.length + a.theyWant.length) ||
        a.trader.name.localeCompare(b.trader.name),
    );
}
