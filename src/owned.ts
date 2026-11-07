import { artUrl } from "./sync.ts";
import { type Card } from "./types.ts";

const ORIGIN = "https://koi-card-collector.com";
const MAX_PAGES = 40;
const POOL = 6;
const SYNC_COOLDOWN_MS = 60 * 60 * 1000;

export interface OwnedCards {
  ss: string[];
  sss: string[];
  duplicates?: Record<string, number>;
  copies: number;
  hidden: boolean;
  complete: boolean;
  fetchedAt: string;
}

export interface SyncedProfile {
  id: string;
  name: string;
  discordUsername: string;
  level: number;
  publicCollection: boolean;
  cards: number;
  sss: number;
  avatarUrl: string | null;
}

export type OwnedResponse = OwnedCards & {
  nextSyncAt: string;
  previousDuplicates?: Record<string, number>;
  artwork: Card[];
  profile: SyncedProfile | null;
};

type CachedOwned = OwnedCards & { nextSyncAt: string };

export class SyncCooldownError extends Error {
  constructor(readonly nextSyncAt: string) {
    super("You can only sync your collection once an hour");
  }
}

function withNextSync(owned: OwnedCards): CachedOwned {
  const nextSyncAt = new Date(Date.parse(owned.fetchedAt) + SYNC_COOLDOWN_MS).toISOString();
  return { ...owned, nextSyncAt };
}

interface CollectionVariant {
  id?: string;
  name?: string;
  art?: { crop?: string };
}

interface CollectionPage {
  total?: number;
  hidden?: boolean;
  profile?: {
    id?: string;
    name?: string;
    discordUsername?: string;
    level?: number;
    publicCollection?: boolean;
    avatar?: string;
    stats?: { cards?: number; sss?: number };
  };
  cards?: {
    copy?: {
      characterId?: string;
      rank?: string;
      variant?: CollectionVariant | null;
    };
    character?: {
      name?: string;
      game?: string;
      creator?: string;
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

function legacySsCard(
  characterId: string,
  character: { name?: string; game?: string; creator?: string },
  variant: CollectionVariant,
): Card | null {
  const image = artUrl(variant.art?.crop);
  if (!variant.id || !character.name || !image) return null;
  return {
    id: characterId,
    name: character.name,
    game: character.game ?? "",
    creator: character.creator ?? "",
    rank: "SS",
    category: "characters",
    eventName: null,
    variantId: variant.id,
    variantName: variant.name || "SS artwork",
    border: null,
    image,
  };
}

function profileFrom(page: CollectionPage): SyncedProfile | null {
  const profile = page.profile;
  if (!profile?.id || !profile.name) return null;
  const avatar = profile.avatar ?? "";
  return {
    id: profile.id,
    name: profile.name,
    discordUsername: profile.discordUsername ?? "",
    level: profile.level ?? 0,
    publicCollection: profile.publicCollection ?? false,
    cards: profile.stats?.cards ?? 0,
    sss: profile.stats?.sss ?? 0,
    avatarUrl: avatar
      ? new URL(avatar, "https://koi-card-collector.com").href
      : null,
  };
}

async function fetchOwned(profileId: string): Promise<{ owned: OwnedCards; artwork: Card[]; profile: SyncedProfile | null }> {
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

  const ss = new Map<string, number>();
  const sss = new Map<string, number>();
  const artwork = new Map<string, Card>();
  let copies = 0;
  for (const page of pages) {
    for (const entry of page.cards ?? []) {
      const copy = entry.copy;
      if (!copy?.characterId || !isTracked(copy.rank)) continue;
      copies += 1;
      if (copy.rank === "SSS") {
        const key = `${copy.characterId}:${copy.variant?.id ?? ""}`;
        sss.set(key, (sss.get(key) ?? 0) + 1);
        continue;
      }
      const variantId = copy.variant?.id;
      if (!variantId) {
        ss.set(copy.characterId, (ss.get(copy.characterId) ?? 0) + 1);
        continue;
      }
      const key = `${copy.characterId}:${variantId}`;
      ss.set(key, (ss.get(key) ?? 0) + 1);
      const card = legacySsCard(copy.characterId, entry.character ?? {}, copy.variant ?? {});
      if (card) artwork.set(key, card);
    }
  }

  return {
    profile: profileFrom(first),
    owned: {
      ss: [...ss.keys()],
      sss: [...sss.keys()],
      duplicates: Object.fromEntries([...ss, ...sss].filter(([, count]) => count > 1)),
      copies,
      hidden: Boolean(first.hidden),
      complete: done,
      fetchedAt: new Date().toISOString(),
    },
    artwork: [...artwork.values()],
  };
}

export function ownsCard(owned: OwnedCards, key: string): boolean {
  const [id = "", variantId = "", rank = ""] = key.split(":");
  if (rank === "SSS") return owned.sss.includes(`${id}:${variantId}`);
  if (rank === "SS") return owned.ss.includes(variantId ? `${id}:${variantId}` : id);
  return false;
}

function ownedKey(key: string): string | null {
  const [id = "", variantId = "", rank = ""] = key.split(":");
  if (rank === "SSS") return `${id}:${variantId}`;
  if (rank === "SS") return variantId ? `${id}:${variantId}` : id;
  return null;
}

export function isSpare(duplicates: Record<string, number> | undefined, key: string): boolean {
  const owned = ownedKey(key);
  return owned !== null && (duplicates?.[owned] ?? 0) > 1;
}

export async function readOwned(env: OwnedEnv, profileId: string, refresh: boolean, force = false): Promise<OwnedResponse> {
  const cacheKey = `owned:${profileId}`;
  const cached = await env.CARDS.get<OwnedCards>(cacheKey, "json");
  if (cached && Array.isArray(cached.ss)) {
    const response = withNextSync(cached);
    if (!refresh) return { ...response, artwork: [], profile: null };
    if (!force && Date.parse(response.nextSyncAt) > Date.now()) throw new SyncCooldownError(response.nextSyncAt);
  }
  const { owned, artwork, profile } = await fetchOwned(profileId);
  await env.CARDS.put(cacheKey, JSON.stringify(owned));
  return { ...withNextSync(owned), previousDuplicates: cached?.duplicates ?? {}, artwork, profile };
}
