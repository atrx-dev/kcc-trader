const ORIGIN = "https://koi-card-collector.com";
const MAX_PAGES = 45;
const POOL = 6;
const SYNC_COOLDOWN_MS = 60 * 60 * 1000;

export interface OwnedCards {
  ss: string[];
  sss: string[];
  copies: number;
  hidden: boolean;
  complete: boolean;
  fetchedAt: string;
}

export type OwnedResponse = OwnedCards & { nextSyncAt: string };

export class SyncCooldownError extends Error {
  constructor(readonly nextSyncAt: string) {
    super("You can only sync your collection once an hour");
  }
}

function withNextSync(owned: OwnedCards): OwnedResponse {
  const nextSyncAt = new Date(Date.parse(owned.fetchedAt) + SYNC_COOLDOWN_MS).toISOString();
  return { ...owned, nextSyncAt };
}

interface CollectionPage {
  total?: number;
  hidden?: boolean;
  cards?: {
    copy?: {
      characterId?: string;
      rank?: string;
      variant?: { id?: string } | null;
    };
  }[];
}

interface OwnedEnv {
  CARDS: KVNamespace;
}

async function fetchPage(profileId: string, page: number): Promise<CollectionPage> {
  const url = new URL(`/api/community/profiles/${encodeURIComponent(profileId)}`, ORIGIN);
  url.searchParams.set("section", "collection");
  url.searchParams.set("sort", "rarity");
  url.searchParams.set("page", String(page));
  const response = await fetch(url, { headers: { "user-agent": "kcc-trader" } });
  if (!response.ok) throw new Error(`Collection page ${page} failed: ${response.status}`);
  return (await response.json()) as CollectionPage;
}

function isTracked(rank: string | undefined): boolean {
  return rank === "SSS" || rank === "SS";
}

function reachesUntracked(page: CollectionPage): boolean {
  return (page.cards ?? []).some((entry) => entry.copy?.characterId && !isTracked(entry.copy.rank));
}

async function fetchOwned(profileId: string): Promise<OwnedCards> {
  const first = await fetchPage(profileId, 0);
  const perPage = first.cards?.length ?? 0;
  const total = first.total ?? perPage;
  const pageCount = perPage > 0 ? Math.ceil(total / perPage) : 1;
  const lastPage = Math.min(pageCount, MAX_PAGES);
  const pages = [first];
  let next = 1;
  let done = Boolean(first.hidden) || pageCount <= 1 || reachesUntracked(first);

  while (!done && next < lastPage) {
    const batch = Array.from({ length: Math.min(POOL, lastPage - next) }, (_, index) => next + index);
    const results = await Promise.all(batch.map((page) => fetchPage(profileId, page)));
    pages.push(...results);
    next += batch.length;
    done = next >= pageCount || results.some(reachesUntracked);
  }

  const ss = new Set<string>();
  const sss = new Set<string>();
  let copies = 0;
  for (const page of pages) {
    for (const entry of page.cards ?? []) {
      const copy = entry.copy;
      if (!copy?.characterId || !isTracked(copy.rank)) continue;
      copies += 1;
      if (copy.rank === "SSS") sss.add(`${copy.characterId}:${copy.variant?.id ?? ""}`);
      else ss.add(copy.characterId);
    }
  }

  return {
    ss: [...ss],
    sss: [...sss],
    copies,
    hidden: Boolean(first.hidden),
    complete: done,
    fetchedAt: new Date().toISOString(),
  };
}

export function ownsCard(owned: OwnedCards, key: string): boolean {
  const [id = "", variantId = "", rank = ""] = key.split(":");
  if (rank === "SSS") return owned.sss.includes(`${id}:${variantId}`);
  if (rank === "SS") return owned.ss.includes(id);
  return false;
}

export async function readOwned(env: OwnedEnv, profileId: string, refresh: boolean): Promise<OwnedResponse> {
  const cacheKey = `owned:${profileId}`;
  const cached = await env.CARDS.get<OwnedCards>(cacheKey, "json");
  if (cached && Array.isArray(cached.ss)) {
    const response = withNextSync(cached);
    if (!refresh) return response;
    if (Date.parse(response.nextSyncAt) > Date.now()) throw new SyncCooldownError(response.nextSyncAt);
  }
  const owned = await fetchOwned(profileId);
  await env.CARDS.put(cacheKey, JSON.stringify(owned));
  return withNextSync(owned);
}
