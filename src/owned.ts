const ORIGIN = "https://koi-card-collector.com";
const MAX_PAGES = 45;
const POOL = 6;
const SYNC_COOLDOWN_MS = 60 * 60 * 1000;

export interface OwnedCards {
  characters: string[];
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
  url.searchParams.set("page", String(page));
  const response = await fetch(url, { headers: { "user-agent": "kcc-trader" } });
  if (!response.ok) throw new Error(`Collection page ${page} failed: ${response.status}`);
  return (await response.json()) as CollectionPage;
}

async function fetchOwned(profileId: string): Promise<OwnedCards> {
  const first = await fetchPage(profileId, 0);
  const perPage = first.cards?.length ?? 0;
  const total = first.total ?? perPage;
  const pages = [first];

  if (!first.hidden && perPage > 0 && total > perPage) {
    const pageCount = Math.min(Math.ceil(total / perPage), MAX_PAGES);
    const remaining = Array.from({ length: pageCount - 1 }, (_, index) => index + 1);
    let next = 0;
    const results = new Array<CollectionPage>(remaining.length);
    await Promise.all(
      Array.from({ length: Math.min(POOL, remaining.length) }, async () => {
        while (next < remaining.length) {
          const index = next;
          next += 1;
          results[index] = await fetchPage(profileId, remaining[index]);
        }
      }),
    );
    pages.push(...results);
  }

  const characters = new Set<string>();
  const ss = new Set<string>();
  const sss = new Set<string>();
  let copies = 0;
  for (const page of pages) {
    for (const entry of page.cards ?? []) {
      const copy = entry.copy;
      if (!copy?.characterId) continue;
      copies += 1;
      if (copy.rank === "SSS") {
        sss.add(`${copy.characterId}:${copy.variant?.id ?? ""}`);
      } else if (copy.rank === "SS") {
        ss.add(copy.characterId);
      } else {
        characters.add(copy.characterId);
      }
    }
  }

  return {
    characters: [...characters],
    ss: [...ss],
    sss: [...sss],
    copies,
    hidden: Boolean(first.hidden),
    complete: copies >= total,
    fetchedAt: new Date().toISOString(),
  };
}

export function ownsCard(owned: OwnedCards, key: string): boolean {
  const [, id = "", variantId = "", rank = ""] = key.split(":");
  if (rank === "SSS") return owned.sss.includes(`${id}:${variantId}`);
  if (rank === "SS") return owned.ss.includes(id);
  return owned.characters.includes(id);
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
