import { artUrl, removeKey, writeKey } from "./sync.ts";
import { asLegacyCard, cardKey, type Card, type CardCategory } from "./types.ts";

const ORIGIN = "https://koi-card-collector.com";
const PAGES_PER_PASS = 45;
const POOL = 1;
const PAGE_SIZE = 1000;
const SYNC_COOLDOWN_MS = 60 * 60 * 1000;
const PROGRESS_TTL_MS = 60 * 60 * 1000;

export interface SyncProgress {
  cards: number;
  total: number;
}

export interface OwnedCards {
  ss: string[];
  sss: string[];
  /** Full visual keys (`base:border+artId`) for version-accurate ownership marks. */
  editions?: string[];
  duplicates?: Record<string, number>;
  editionDuplicates?: Record<string, number>;
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
  collectionValue: number;
  avatarUrl: string | null;
}

export type OwnedResponse = OwnedCards & {
  nextSyncAt: string;
  previousDuplicates?: Record<string, number>;
  artwork: Card[];
  profile: SyncedProfile | null;
  syncProgress?: SyncProgress;
};

type CachedOwned = OwnedCards & { nextSyncAt: string };

interface OwnedSyncState {
  nextPage: number;
  pageCount: number;
  perPage: number;
  total: number;
  hidden: boolean;
  ss: Record<string, number>;
  sss: Record<string, number>;
  editions: Record<string, number>;
  artwork: Card[];
  copies: number;
  profile: SyncedProfile | null;
  previousDuplicates: Record<string, number>;
  startedAt: string;
}

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
  art?: { crop?: string; border?: string; holo?: string; fullCard?: boolean };
}

interface CollectionPage {
  total?: number;
  pageSize?: number;
  hidden?: boolean;
  profile?: {
    id?: string;
    name?: string;
    discordUsername?: string;
    level?: number;
    publicCollection?: boolean;
    avatar?: string;
    stats?: { cards?: number; sss?: number; collectionValue?: number };
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

function progressKey(profileId: string) {
  return `owned-sync:${profileId}`;
}

async function fetchPage(profileId: string, page: number): Promise<CollectionPage> {
  const url = new URL(`/api/community/profiles/${encodeURIComponent(profileId)}`, ORIGIN);
  url.searchParams.set("section", "collection");
  url.searchParams.set("sort", "rarity");
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(PAGE_SIZE));
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

function editionCard(
  characterId: string,
  rank: "SS" | "SSS",
  character: { name?: string; game?: string; creator?: string },
  variant: CollectionVariant,
): Card | null {
  const image = artUrl(variant.art?.crop);
  if (!character.name || !image) return null;
  if (rank === "SS" && !variant.id) return null;
  const border = rank === "SSS" ? (variant.art?.border ?? "starry") : null;
  const card: Card = {
    id: characterId,
    name: character.name,
    game: character.game ?? "",
    creator: character.creator ?? "",
    rank,
    category: "characters" as CardCategory,
    eventName: null,
    variantId: variant.id ?? null,
    variantName: variant.name || (rank === "SS" ? "SS artwork" : null),
    border,
    holo: variant.art?.holo ?? null,
    fullCard: variant.art?.fullCard === true,
    image,
  };
  return asLegacyCard(card);
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
    collectionValue: profile.stats?.collectionValue ?? 0,
    avatarUrl: avatar
      ? new URL(avatar, "https://koi-card-collector.com").href
      : null,
  };
}

function artworkKey(card: Card): string {
  return cardKey(asLegacyCard(card));
}

function absorbPages(
  pages: CollectionPage[],
  ss: Map<string, number>,
  sss: Map<string, number>,
  editions: Map<string, number>,
  artwork: Map<string, Card>,
): number {
  let copies = 0;
  for (const page of pages) {
    for (const entry of page.cards ?? []) {
      const copy = entry.copy;
      if (!copy?.characterId || !isTracked(copy.rank)) continue;
      copies += 1;
      const variant = copy.variant ?? {};
      if (copy.rank === "SSS") {
        const base = `${copy.characterId}:${variant.id ?? ""}`;
        sss.set(base, (sss.get(base) ?? 0) + 1);
        const card = editionCard(copy.characterId, "SSS", entry.character ?? {}, variant);
        if (card) {
          const key = cardKey(card);
          editions.set(key, (editions.get(key) ?? 0) + 1);
          artwork.set(artworkKey(card), card);
        }
        continue;
      }
      const variantId = variant.id;
      if (!variantId) {
        ss.set(copy.characterId, (ss.get(copy.characterId) ?? 0) + 1);
        continue;
      }
      const base = `${copy.characterId}:${variantId}`;
      ss.set(base, (ss.get(base) ?? 0) + 1);
      const card = editionCard(copy.characterId, "SS", entry.character ?? {}, variant);
      if (card) {
        const key = cardKey(card);
        editions.set(key, (editions.get(key) ?? 0) + 1);
        artwork.set(artworkKey(card), card);
      }
    }
  }
  return copies;
}

async function fetchOwnedPass(
  profileId: string,
  prior: OwnedSyncState | null,
  previousDuplicates: Record<string, number>,
): Promise<{
  owned: OwnedCards;
  artwork: Card[];
  profile: SyncedProfile | null;
  state: OwnedSyncState;
  syncProgress: SyncProgress;
}> {
  const ss = new Map<string, number>(prior ? Object.entries(prior.ss) : []);
  const sss = new Map<string, number>(prior ? Object.entries(prior.sss) : []);
  const editions = new Map<string, number>(prior ? Object.entries(prior.editions ?? {}) : []);
  const artwork = new Map<string, Card>(prior ? prior.artwork.map((card) => [artworkKey(card), card]) : []);
  let copies = prior?.copies ?? 0;
  let next = prior?.nextPage ?? 0;
  let pageCount = prior?.pageCount ?? 1;
  let perPage = prior?.perPage ?? 0;
  let total = prior?.total ?? 0;
  let hidden = prior?.hidden ?? false;
  let profile = prior?.profile ?? null;
  const startedAt = prior?.startedAt ?? new Date().toISOString();
  const prevDup = prior?.previousDuplicates ?? previousDuplicates;

  if (prior && (!perPage || !total) && pageCount > 0) {
    perPage = perPage || PAGE_SIZE;
    total = total || pageCount * perPage;
  }

  const pages: CollectionPage[] = [];
  let fetched = 0;
  let done = false;

  if (!prior) {
    const first = await fetchPage(profileId, 0);
    pages.push(first);
    fetched = 1;
    perPage = first.pageSize ?? first.cards?.length ?? PAGE_SIZE;
    total = first.total ?? perPage;
    pageCount = perPage > 0 ? Math.ceil(total / perPage) : 1;
    hidden = Boolean(first.hidden);
    profile = profileFrom(first);
    next = 1;
    done = hidden || pageCount <= 1 || reachesUntracked(first);
  }

  while (!done && fetched < PAGES_PER_PASS && next < pageCount) {
    const room = Math.min(POOL, PAGES_PER_PASS - fetched, pageCount - next);
    if (room <= 0) break;
    const batch = Array.from({ length: room }, (_, index) => next + index);
    const results = await Promise.all(batch.map((page) => fetchPage(profileId, page)));
    pages.push(...results);
    fetched += batch.length;
    next += batch.length;
    done = next >= pageCount || results.some(reachesUntracked);
  }

  copies += absorbPages(pages, ss, sss, editions, artwork);

  const state: OwnedSyncState = {
    nextPage: next,
    pageCount,
    perPage,
    total,
    hidden,
    ss: Object.fromEntries(ss),
    sss: Object.fromEntries(sss),
    editions: Object.fromEntries(editions),
    artwork: [...artwork.values()],
    copies,
    profile,
    previousDuplicates: prevDup,
    startedAt,
  };

  const owned: OwnedCards = {
    ss: [...ss.keys()],
    sss: [...sss.keys()],
    editions: [...editions.keys()],
    duplicates: Object.fromEntries([...ss, ...sss].filter(([, count]) => count > 1)),
    editionDuplicates: Object.fromEntries([...editions].filter(([, count]) => count > 1)),
    copies,
    hidden,
    complete: done,
    fetchedAt: new Date().toISOString(),
  };

  return {
    owned,
    artwork: [...artwork.values()],
    profile,
    state,
    syncProgress: {
      cards: Math.min(next * Math.max(perPage, 1), Math.max(total, 0)),
      total: Math.max(total, 0),
    },
  };
}

export function ownsCard(owned: OwnedCards, key: string): boolean {
  const [id = "", variantId = "", rank = "", edition] = key.split(":");
  if (edition) {
    if (owned.editions?.includes(key)) return true;
    // Fall back to base ownership when edition data is missing from an old cache.
    if (!owned.editions?.length) {
      if (rank === "SSS") return owned.sss.includes(`${id}:${variantId}`);
      if (rank === "SS") return owned.ss.includes(variantId ? `${id}:${variantId}` : id);
    }
    return false;
  }
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

export function copiesForKeys(duplicates: Record<string, number>, keys: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of keys) {
    const owned = ownedKey(key);
    if (!owned) continue;
    const count = duplicates[owned] ?? 0;
    if (count > 1) out[key] = count;
  }
  return out;
}

/** Cached collection duplicates only — no KCC refresh. Empty if missing or hidden. */
export async function readCachedDuplicates(env: OwnedEnv, profileId: string): Promise<Record<string, number>> {
  const cached = await env.CARDS.get<OwnedCards>(`owned:${profileId}`, "json");
  if (!cached || !Array.isArray(cached.ss) || cached.hidden) return {};
  return cached.duplicates ?? {};
}

function freshProgress(progress: OwnedSyncState | null): OwnedSyncState | null {
  if (!progress) return null;
  if (Date.now() - Date.parse(progress.startedAt) > PROGRESS_TTL_MS) return null;
  return progress;
}

export async function readOwned(env: OwnedEnv, profileId: string, refresh: boolean, force = false): Promise<OwnedResponse> {
  const cacheKey = `owned:${profileId}`;
  const syncKey = progressKey(profileId);
  const cached = await env.CARDS.get<OwnedCards>(cacheKey, "json");
  if (!refresh && cached && Array.isArray(cached.ss)) {
    return { ...withNextSync(cached), artwork: [], profile: null };
  }

  const prior = freshProgress(await env.CARDS.get<OwnedSyncState>(syncKey, "json"));
  if (!prior && cached && Array.isArray(cached.ss)) {
    const response = withNextSync(cached);
    if (!force && Date.parse(response.nextSyncAt) > Date.now()) throw new SyncCooldownError(response.nextSyncAt);
  }

  const pass = await fetchOwnedPass(profileId, prior, cached?.duplicates ?? {});
  const syncProgress = pass.syncProgress;

  if (!pass.owned.complete) {
    await writeKey(env, syncKey, JSON.stringify(pass.state));
    const placeholder = cached && Array.isArray(cached.ss) ? withNextSync(cached) : withNextSync(pass.owned);
    return {
      ...placeholder,
      complete: false,
      syncProgress,
      artwork: [],
      profile: pass.profile,
      previousDuplicates: pass.state.previousDuplicates,
    };
  }

  await removeKey(env, syncKey);
  await writeKey(env, cacheKey, JSON.stringify(pass.owned));
  return {
    ...withNextSync(pass.owned),
    previousDuplicates: pass.state.previousDuplicates,
    artwork: pass.artwork,
    profile: pass.profile,
    syncProgress,
  };
}
