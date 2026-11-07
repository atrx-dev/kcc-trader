import { cardKey, type Card, type CardCategory, type Catalog } from "./types.ts";

const ORIGIN = "https://koi-card-collector.com";
const MAX_PAGES = 40;
const HIDDEN_KEY = "hidden-characters";
const SS_ARTWORK_KEY = "ss-artwork";
const MAX_DISCOVERIES = 5;
const SYNC_STATE_KEY = "catalog-sync";
const REQUEST_BUDGET = 40;
const LOCK_KEY = "catalog-sync-lock";
const LOCK_MS = 90_000;
const POOL = 6;
const SYNC_EVERY_MS = 12 * 60 * 60 * 1000;

export interface SyncEnv {
  CARDS: KVNamespace;
}

interface ArtRef {
  crop?: string;
  border?: string;
}

interface SssVariant {
  id: string;
  name?: string;
  art?: ArtRef;
}

interface DexCharacter {
  id: string;
  name: string;
  game?: string;
  creator?: string;
  art?: ArtRef;
  ss?: ArtRef;
  sss?: ArtRef;
  sssVariants?: SssVariant[];
  inPool?: boolean;
  isPromo?: boolean;
}

interface DexCard {
  character: DexCharacter;
  rank?: string;
  eventName?: string;
  variant?: {
    id?: string;
    name?: string;
    art?: ArtRef;
  };
}

interface DexPage {
  cards?: DexCard[];
  total?: number;
}

export function artUrl(path: string | undefined): string {
  if (!path) return "";
  const match = path.match(/\/art\/([0-9a-f-]{36})/i);
  return match ? `${ORIGIN}/api/community/art/${match[1]}?w=300` : "";
}

function artwork(card: DexCard): ArtRef | undefined {
  if (card.rank === "SSS") return card.variant?.art ?? card.character.sss ?? card.character.art;
  if (card.rank === "SS") return card.variant?.art ?? card.character.ss ?? card.character.art;
  return card.variant?.art ?? card.character.art;
}

function slim(card: DexCard, category: CardCategory): Card {
  const art = artwork(card);
  const rank = card.rank ?? "";
  return {
    id: card.character.id,
    name: card.character.name,
    game: card.character.game ?? "",
    creator: card.character.creator ?? "",
    rank,
    category,
    eventName: card.eventName ?? null,
    variantId: card.variant?.id ?? null,
    variantName: card.variant?.name ?? null,
    border: rank === "SSS" ? (art?.border ?? card.character.sss?.border ?? "starry") : null,
    image: artUrl(art?.crop),
  };
}

async function fetchDexPage(category: CardCategory, page: number): Promise<DexPage> {
  const url = new URL("/api/community/dex", ORIGIN);
  url.searchParams.set("page", String(page));
  url.searchParams.set("name", "");
  url.searchParams.set("dev", "");
  url.searchParams.set("game", "");
  url.searchParams.set("sort", "name");
  url.searchParams.set("section", "showcase");
  url.searchParams.set("category", category);

  const response = await fetch(url, {
    headers: { "user-agent": "kcc-trader" },
  });
  if (!response.ok) {
    throw new Error(`Dex ${category} page ${page} failed: ${response.status}`);
  }
  return (await response.json()) as DexPage;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

async function fetchCharacter(id: string): Promise<DexCharacter> {
  const response = await fetch(`${ORIGIN}/api/community/characters/${id}`, {
    headers: { "user-agent": "kcc-trader" },
  });
  if (!response.ok) throw new Error(`Character ${id} failed: ${response.status}`);
  const data = (await response.json()) as { character: DexCharacter };
  return data.character;
}

function sssCardsFor(character: DexCharacter): Card[] {
  const variants =
    character.sssVariants ??
    (character.sss
      ? [{ id: character.id, name: "Original secret", art: character.sss }]
      : []);
  return variants.map((variant) => ({
    id: character.id,
    name: character.name,
    game: character.game ?? "",
    creator: character.creator ?? "",
    rank: "SSS",
    category: "characters",
    eventName: null,
    variantId: variant.id,
    variantName: variant.name ?? null,
    border: variant.art?.border || "starry",
    image: artUrl(variant.art?.crop),
  }));
}

async function fetchCharacterOrNull(id: string): Promise<DexCharacter | null> {
  try {
    return await fetchCharacter(id);
  } catch {
    return null;
  }
}

function rankCardFor(character: DexCharacter, rank: "SS"): Card {
  const art = character.ss?.crop ? character.ss : character.art;
  return {
    id: character.id,
    name: character.name,
    game: character.game ?? "",
    creator: character.creator ?? "",
    rank,
    category: "characters",
    eventName: null,
    variantId: null,
    variantName: null,
    border: null,
    image: artUrl(art?.crop),
  };
}

function hiddenCardsFor(character: DexCharacter): Card[] {
  const base = character.isPromo ? [] : [rankCardFor(character, "SS")];
  return [...base, ...sssCardsFor(character)].map((card) => ({ ...card, hidden: true }));
}

async function readHiddenIds(env: SyncEnv): Promise<string[]> {
  return (await env.CARDS.get<string[]>(HIDDEN_KEY, "json")) ?? [];
}

export async function discoverHiddenCards(env: SyncEnv, characterIds: Iterable<string>): Promise<boolean> {
  const catalog = await readCatalog(env);
  if (!catalog.syncedAt) return false;
  const known = new Set(catalog.cards.map((card) => card.id));
  const unknown = [...new Set(characterIds)].filter((id) => !known.has(id)).slice(0, MAX_DISCOVERIES);
  if (unknown.length === 0) return false;

  const details = await mapPool(unknown, 6, fetchCharacterOrNull);
  const found = details.filter((character): character is DexCharacter => Boolean(character && !character.inPool));
  const added = found.flatMap(hiddenCardsFor);
  if (added.length === 0) return false;

  const hiddenIds = new Set(await readHiddenIds(env));
  for (const character of found) hiddenIds.add(character.id);
  await env.CARDS.put(HIDDEN_KEY, JSON.stringify([...hiddenIds]));
  const at = new Date().toISOString();
  await env.CARDS.put(
    "catalog",
    JSON.stringify({ ...catalog, cards: [...catalog.cards, ...added.map((card) => ({ ...card, addedAt: at }))] }),
  );
  return true;
}

interface SyncRun {
  listing: { category: CardCategory; page: number; seen: number } | null;
  characterIds: string[];
  eventCards: Card[];
  pending: string[];
  cards: Card[];
  hidden: { stored: number; pending: string[]; keep: string[]; cards: Card[] } | null;
}

type SyncState = { finishedAt: string } | SyncRun;

export type SyncProgress =
  | { status: "idle"; finishedAt: string }
  | { status: "running"; remaining: number }
  | { status: "done"; syncedAt: string; count: number };

function freshRun(): SyncRun {
  return {
    listing: { category: "characters", page: 0, seen: 0 },
    characterIds: [],
    eventCards: [],
    pending: [],
    cards: [],
    hidden: null,
  };
}

async function listDex(run: SyncRun, listing: NonNullable<SyncRun["listing"]>): Promise<void> {
  const { category, page } = listing;
  if (page >= MAX_PAGES) throw new Error(`Dex ${category} exceeded ${MAX_PAGES} pages`);
  const data = await fetchDexPage(category, page);
  const cards = (data.cards ?? []).map((card) => slim(card, category));
  if (category === "characters") {
    const known = new Set(run.characterIds);
    for (const card of cards) {
      if (known.has(card.id)) continue;
      known.add(card.id);
      run.characterIds.push(card.id);
    }
  } else {
    run.eventCards.push(...cards);
  }
  const seen = listing.seen + cards.length;
  const finished = cards.length === 0 || (typeof data.total === "number" && seen >= data.total);
  if (!finished) run.listing = { category, page: page + 1, seen };
  else if (category === "characters") {
    run.pending = [...run.characterIds];
    run.listing = { category: "events", page: 0, seen: 0 };
  } else run.listing = null;
}

export async function readSsArtwork(env: SyncEnv): Promise<Card[]> {
  return (await env.CARDS.get<Card[]>(SS_ARTWORK_KEY, "json")) ?? [];
}

export async function addSsArtwork(env: SyncEnv, cards: Card[]): Promise<boolean> {
  if (cards.length === 0) return false;
  const stored = await readSsArtwork(env);
  const byKey = new Map(stored.map((card) => [cardKey(card), card]));
  let added = false;
  for (const card of cards) {
    const key = cardKey(card);
    if (byKey.has(key)) continue;
    byKey.set(key, card);
    added = true;
  }
  if (!added) return false;
  await env.CARDS.put(SS_ARTWORK_KEY, JSON.stringify([...byKey.values()]));
  const catalog = await readCatalog(env);
  if (!catalog.syncedAt) return false;
  const known = new Set(catalog.cards.map((card) => cardKey(card)));
  const extra = [...byKey.values()].filter((card) => !known.has(cardKey(card)));
  if (extra.length === 0) return false;
  const at = new Date().toISOString();
  const extraStamped = extra.map((card) => ({ ...card, addedAt: card.addedAt ?? at }));
  await env.CARDS.put("catalog", JSON.stringify({ ...catalog, cards: [...catalog.cards, ...extraStamped] }));
  return true;
}

function rememberAddedAt(previous: Card[], cards: Card[], at: string): Card[] {
  const known = new Map(previous.map((card) => [cardKey(card), card.addedAt]));
  return cards.map((card) => {
    const key = cardKey(card);
    if (known.has(key)) {
      const addedAt = known.get(key);
      return addedAt ? { ...card, addedAt } : card;
    }
    return { ...card, addedAt: at };
  });
}

function finishRun(run: SyncRun, artwork: Card[]): Catalog {
  const seenVariants = new Set(
    run.cards
      .filter((card) => card.rank === "SSS")
      .map((card) => card.variantId)
      .filter((id): id is string => Boolean(id)),
  );
  const extraEvents = run.eventCards.filter((card) => !card.variantId || !seenVariants.has(card.variantId));
  return {
    syncedAt: new Date().toISOString(),
    cards: [...run.cards, ...extraEvents, ...(run.hidden?.cards ?? []), ...artwork],
  };
}

function remainingOf(state: SyncState | null): number {
  if (!state || "finishedAt" in state) return 0;
  return state.pending.length + (state.hidden?.pending.length ?? 0);
}

export async function stepCatalogSync(env: SyncEnv, force = false): Promise<SyncProgress> {
  const state = await env.CARDS.get<SyncState>(SYNC_STATE_KEY, "json");
  if (!force && state && "finishedAt" in state && Date.now() - Date.parse(state.finishedAt) < SYNC_EVERY_MS) {
    return { status: "idle", finishedAt: state.finishedAt };
  }
  const lock = await env.CARDS.get(LOCK_KEY);
  if (lock && Date.now() - Number(lock) < LOCK_MS) return { status: "running", remaining: remainingOf(state) };
  await env.CARDS.put(LOCK_KEY, String(Date.now()), { expirationTtl: 60 });
  const run = force || !state || "finishedAt" in state ? freshRun() : state;
  let budget = REQUEST_BUDGET;

  try {
    while (run.listing && budget > 0) {
      await listDex(run, run.listing);
      budget -= 1;
    }
    while (!run.listing && run.pending.length > 0 && budget > 0) {
      const batch = run.pending.slice(0, Math.min(POOL, budget));
      const details = await Promise.all(batch.map(fetchCharacter));
      budget -= batch.length;
      for (const character of details) run.cards.push(rankCardFor(character, "SS"), ...sssCardsFor(character));
      run.pending = run.pending.slice(batch.length);
    }
    if (!run.listing && run.pending.length === 0 && !run.hidden) {
      const stored = await readHiddenIds(env);
      const known = new Set([...run.cards, ...run.eventCards].map((card) => card.id));
      run.hidden = { stored: stored.length, pending: stored.filter((id) => !known.has(id)), keep: [], cards: [] };
    }
    while (run.hidden && run.hidden.pending.length > 0 && budget > 0) {
      const batch = run.hidden.pending.slice(0, Math.min(POOL, budget));
      const details = await mapPool(batch, POOL, fetchCharacterOrNull);
      budget -= batch.length;
      for (const character of details) {
        if (!character || character.inPool) continue;
        run.hidden.keep.push(character.id);
        run.hidden.cards.push(...hiddenCardsFor(character));
      }
      run.hidden.pending = run.hidden.pending.slice(batch.length);
    }
  } catch (error) {
    await env.CARDS.put(SYNC_STATE_KEY, JSON.stringify(run));
    await env.CARDS.delete(LOCK_KEY);
    throw error;
  }

  if (run.listing || run.pending.length > 0 || !run.hidden || run.hidden.pending.length > 0) {
    await env.CARDS.put(SYNC_STATE_KEY, JSON.stringify(run));
    await env.CARDS.delete(LOCK_KEY);
    return { status: "running", remaining: run.pending.length + (run.hidden?.pending.length ?? 0) };
  }

  const seen = new Set([...run.cards, ...run.eventCards, ...(run.hidden?.cards ?? [])].map((card) => cardKey(card)));
  const artwork = (await readSsArtwork(env)).filter((card) => !seen.has(cardKey(card)));
  const previous = await readCatalog(env);
  const catalog = finishRun(run, artwork);
  if (previous.syncedAt && catalog.syncedAt) {
    catalog.cards = rememberAddedAt(previous.cards, catalog.cards, catalog.syncedAt);
  }
  await env.CARDS.put("catalog", JSON.stringify(catalog));
  if (run.hidden.keep.length !== run.hidden.stored) await env.CARDS.put(HIDDEN_KEY, JSON.stringify(run.hidden.keep));
  await env.CARDS.put(SYNC_STATE_KEY, JSON.stringify({ finishedAt: catalog.syncedAt }));
  await env.CARDS.delete(LOCK_KEY);
  return { status: "done", syncedAt: catalog.syncedAt!, count: catalog.cards.length };
}

export async function readCatalog(env: SyncEnv): Promise<Catalog> {
  const raw = await env.CARDS.get("catalog");
  if (!raw) return { syncedAt: null, cards: [] };
  const catalog = JSON.parse(raw) as Catalog;
  return {
    ...catalog,
    cards: catalog.cards
      .filter((card) => card.rank !== "Common")
      .map((card) => ({
        ...card,
        variantId: card.variantId ?? null,
        image: artUrl(card.image),
      })),
  };
}
