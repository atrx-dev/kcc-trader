import {
  asLegacyCard,
  baseCardKey,
  cardKey,
  sameVisual,
  type Card,
  type CardCategory,
  type Catalog,
} from "./types.ts";

const ORIGIN = "https://koi-card-collector.com";
const MAX_PAGES = 40;
const HIDDEN_KEY = "hidden-characters";
const SS_ARTWORK_KEY = "ss-artwork";
const LEGACY_EDITIONS_KEY = "legacy-editions";
const MAX_DISCOVERIES = 5;
const SYNC_STATE_KEY = "catalog-sync";
const REQUEST_BUDGET = 40;
const LOCK_KEY = "catalog-sync-lock";
const LOCK_MS = 90_000;
const LOCK_TTL_SECONDS = 120;
const WRITE_GAP_MS = 1_100;
const POOL = 6;
const SYNC_EVERY_MS = 12 * 60 * 60 * 1000;
const KCC_CHAN_ID = "c6b718f6-488a-4e40-b974-c021da730c70";

export interface SyncEnv {
  CARDS: KVNamespace;
}

interface ArtRef {
  crop?: string;
  border?: string;
  holo?: string;
  fullCard?: boolean;
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
    holo: art?.holo ?? null,
    fullCard: art?.fullCard === true,
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
    holo: variant.art?.holo ?? null,
    fullCard: variant.art?.fullCard === true,
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
    holo: art?.holo ?? null,
    fullCard: art?.fullCard === true,
    image: artUrl(art?.crop),
  };
}

function hiddenCardsFor(character: DexCharacter): Card[] {
  const base = character.isPromo ? [] : [rankCardFor(character, "SS")];
  return [...base, ...sssCardsFor(character)].map((card) => ({ ...card, hidden: true }));
}

function kccChanCards(character: DexCharacter): Card[] {
  const art = character.sss ?? character.sssVariants?.[0]?.art ?? character.art;
  const variant = character.sssVariants?.[0];
  return [
    {
      id: character.id,
      name: character.name,
      game: character.game ?? "Koi Card Collector",
      creator: character.creator ?? "Koi Card Collector",
      rank: "SSS",
      category: "events",
      eventName: "KCC-chan",
      variantId: variant?.id ?? character.id,
      variantName: variant?.name && variant.name !== "Original secret" ? variant.name : null,
      border: art?.border ?? "starry",
      holo: art?.holo ?? "kcc-chan",
      fullCard: art?.fullCard === true,
      image: artUrl(art?.crop),
    },
  ];
}

async function fetchKccChanCharacter(): Promise<DexCharacter | null> {
  try {
    const response = await fetch(`${ORIGIN}/api/community/kcc-event`, {
      headers: { "user-agent": "kcc-trader" },
    });
    if (response.ok) {
      const data = (await response.json()) as { reward?: DexCharacter | null };
      if (data.reward?.id) return data.reward;
    }
  } catch {
    /* fall through to character lookup */
  }
  return fetchCharacterOrNull(KCC_CHAN_ID);
}

export async function ensureKccChanPromo(env: SyncEnv): Promise<boolean> {
  const catalog = await readCatalog(env);
  if (!catalog.syncedAt) return false;
  const existing = catalog.cards.find((card) => card.id === KCC_CHAN_ID || card.holo === "kcc-chan");
  if (existing?.holo === "kcc-chan" && existing.fullCard && existing.image) return false;

  const character = await fetchKccChanCharacter();
  if (!character) return false;
  const cards = kccChanCards(character);
  const byKey = new Map(catalog.cards.map((card) => [cardKey(card), card]));
  const demoted: Card[] = [];
  let changed = false;
  const at = new Date().toISOString();
  for (const card of cards) {
    const key = cardKey(card);
    const previous = byKey.get(key);
    if (!previous) {
      byKey.set(key, { ...card, addedAt: at });
      changed = true;
      continue;
    }
    const visualChanged = !sameVisual(previous, card);
    if (
      previous.holo !== card.holo ||
      previous.fullCard !== card.fullCard ||
      visualChanged ||
      previous.eventName !== card.eventName ||
      previous.game !== card.game ||
      previous.border !== card.border
    ) {
      if (visualChanged && !previous.legacy) demoted.push(asLegacyCard(previous, previous.addedAt ?? at));
      byKey.set(key, { ...previous, ...card, edition: null, legacy: false, addedAt: previous.addedAt });
      changed = true;
    }
  }
  if (!changed) return false;
  if (demoted.length) await mergeLegacyEditions(env, demoted);
  for (const card of demoted) byKey.set(cardKey(card), card);
  await writeKey(env, "catalog", JSON.stringify({ ...catalog, cards: [...byKey.values()] }));
  return true;
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
  await writeKey(env, HIDDEN_KEY, JSON.stringify([...hiddenIds]));
  const at = new Date().toISOString();
  await writeKey(env,
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
  | { status: "running"; remaining: number; locked?: boolean; owner?: string }
  | { status: "done"; syncedAt: string; count: number };

interface SyncLock {
  owner: string;
  at: number;
}

function readLock(raw: string | null): SyncLock | null {
  if (!raw) return null;
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as { owner?: unknown; at?: unknown };
      if (typeof parsed.owner === "string" && typeof parsed.at === "number") return { owner: parsed.owner, at: parsed.at };
    } catch {
      return null;
    }
    return null;
  }
  const at = Number(raw);
  return Number.isFinite(at) ? { owner: "", at } : null;
}

function rateLimited(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /too many requests/i.test(message) || /\b429\b/.test(message);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function writeKey(
  env: { CARDS: KVNamespace },
  key: string,
  value: string,
  options?: KVNamespacePutOptions,
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await (options ? env.CARDS.put(key, value, options) : env.CARDS.put(key, value));
      return;
    } catch (error) {
      if (attempt === 3 || !rateLimited(error)) throw error;
      await wait(WRITE_GAP_MS);
    }
  }
}

export async function removeKey(env: { CARDS: KVNamespace }, key: string): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await env.CARDS.delete(key);
      return;
    } catch (error) {
      if (attempt === 3 || !rateLimited(error)) throw error;
      await wait(WRITE_GAP_MS);
    }
  }
}

async function claimLock(env: SyncEnv, owner: string): Promise<{ owner: string } | { busy: true }> {
  const current = readLock(await env.CARDS.get(LOCK_KEY));
  const held = current !== null && Date.now() - current.at < LOCK_MS;
  if (held && current.owner !== owner) return { busy: true };
  const next = owner || crypto.randomUUID();
  if (!current || current.owner !== next || Date.now() - current.at >= WRITE_GAP_MS) {
    await writeKey(env, LOCK_KEY, JSON.stringify({ owner: next, at: Date.now() }), { expirationTtl: LOCK_TTL_SECONDS });
  }
  return { owner: next };
}

export interface CatalogSyncStatus {
  status: "idle" | "running";
  finishedAt: string | null;
  remaining: number;
  count: number | null;
}

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

export async function readLegacyEditions(env: SyncEnv): Promise<Card[]> {
  const stored = await env.CARDS.get<Card[]>(LEGACY_EDITIONS_KEY, "json");
  if (stored) return stored;
  // Migrate older SS-only artwork cache into the unified legacy store.
  const legacy = await env.CARDS.get<Card[]>(SS_ARTWORK_KEY, "json");
  if (!legacy?.length) return [];
  const migrated = legacy.map((card) => asLegacyCard(card));
  await writeKey(env, LEGACY_EDITIONS_KEY, JSON.stringify(migrated));
  return migrated;
}

/** @deprecated Use readLegacyEditions */
export async function readSsArtwork(env: SyncEnv): Promise<Card[]> {
  return readLegacyEditions(env);
}

function activeByBase(cards: Card[]): Map<string, Card> {
  const map = new Map<string, Card>();
  for (const card of cards) {
    if (card.legacy) continue;
    map.set(baseCardKey(card), card);
  }
  return map;
}

function legacyStillDistinct(card: Card, current: Map<string, Card>): boolean {
  const now = current.get(baseCardKey(card));
  if (!now) return true;
  return !sameVisual(card, now);
}

export async function writeLegacyEditions(env: SyncEnv, cards: Card[]): Promise<void> {
  await writeKey(env, LEGACY_EDITIONS_KEY, JSON.stringify(cards));
}

export async function mergeLegacyEditions(env: SyncEnv, incoming: Card[]): Promise<Card[]> {
  const stored = await readLegacyEditions(env);
  const byKey = new Map(stored.map((card) => [cardKey(asLegacyCard(card)), asLegacyCard(card)]));
  let changed = false;
  for (const card of incoming) {
    const legacy = asLegacyCard(card);
    const key = cardKey(legacy);
    if (byKey.has(key)) continue;
    byKey.set(key, legacy);
    changed = true;
  }
  const next = [...byKey.values()];
  if (changed) await writeLegacyEditions(env, next);
  return next;
}

export async function addLegacyEditions(env: SyncEnv, cards: Card[]): Promise<boolean> {
  if (cards.length === 0) return false;
  const catalog = await readCatalog(env);
  const current = activeByBase(catalog.cards);
  const candidates = cards.filter((card) => legacyStillDistinct(card, current));
  if (candidates.length === 0) return false;
  const before = await readLegacyEditions(env);
  const beforeKeys = new Set(before.map((card) => cardKey(asLegacyCard(card))));
  const merged = await mergeLegacyEditions(env, candidates);
  const added = merged.some((card) => !beforeKeys.has(cardKey(card)));
  if (!added) return false;
  return publishLegacyIntoCatalog(env, merged);
}

/** @deprecated Use addLegacyEditions */
export async function addSsArtwork(env: SyncEnv, cards: Card[]): Promise<boolean> {
  return addLegacyEditions(env, cards);
}

export async function publishLegacyIntoCatalog(env: SyncEnv, legacy?: Card[]): Promise<boolean> {
  const catalog = await readCatalog(env);
  if (!catalog.syncedAt) return false;
  const editions = legacy ?? (await readLegacyEditions(env));
  const current = activeByBase(catalog.cards);
  const extras = editions.filter((card) => legacyStillDistinct(card, current));
  const known = new Set(catalog.cards.map((card) => cardKey(card)));
  const at = new Date().toISOString();
  const fresh = extras.filter((card) => !known.has(cardKey(card))).map((card) => ({
    ...asLegacyCard(card),
    addedAt: card.addedAt ?? at,
  }));
  if (fresh.length === 0) return false;
  await writeKey(env, "catalog", JSON.stringify({ ...catalog, cards: [...catalog.cards, ...fresh] }));
  return true;
}

function rememberAddedAt(previous: Card[], cards: Card[], at: string): Card[] {
  const known = new Map(previous.filter((card) => !card.legacy).map((card) => [baseCardKey(card), card.addedAt]));
  return cards.map((card) => {
    if (card.legacy) return card;
    const key = baseCardKey(card);
    if (known.has(key)) {
      const addedAt = known.get(key);
      return addedAt ? { ...card, addedAt } : card;
    }
    return { ...card, addedAt: at };
  });
}

function preserveChangedEditions(previous: Card[], current: Card[], at: string): Card[] {
  const now = activeByBase(current);
  const out: Card[] = [];
  for (const card of previous) {
    if (card.legacy) continue;
    const next = now.get(baseCardKey(card));
    if (!next || sameVisual(card, next)) continue;
    out.push(asLegacyCard(card, card.addedAt ?? at));
  }
  return out;
}

function finishRun(run: SyncRun, legacy: Card[], promos: Card[] = []): Catalog {
  const seenVariants = new Set(
    run.cards
      .filter((card) => card.rank === "SSS")
      .map((card) => card.variantId)
      .filter((id): id is string => Boolean(id)),
  );
  const extraEvents = run.eventCards.filter((card) => !card.variantId || !seenVariants.has(card.variantId));
  const live = [...run.cards, ...extraEvents, ...(run.hidden?.cards ?? [])];
  const seen = new Set(live.map((card) => cardKey(card)));
  const extraPromos = promos.filter((card) => {
    if (seen.has(cardKey(card))) return false;
    seen.add(cardKey(card));
    return true;
  });
  const currentByBase = activeByBase([...live, ...extraPromos]);
  const distinctLegacy = legacy
    .map((card) => asLegacyCard(card))
    .filter((card) => legacyStillDistinct(card, currentByBase) && !seen.has(cardKey(card)));
  return {
    syncedAt: new Date().toISOString(),
    cards: [...live, ...extraPromos, ...distinctLegacy],
  };
}

function remainingOf(state: SyncState | null): number {
  if (!state || "finishedAt" in state) return 0;
  return state.pending.length + (state.hidden?.pending.length ?? 0);
}

export async function stepCatalogSync(env: SyncEnv, force = false, owner = ""): Promise<SyncProgress> {
  const state = await env.CARDS.get<SyncState>(SYNC_STATE_KEY, "json");
  if (!force && state && "finishedAt" in state && Date.now() - Date.parse(state.finishedAt) < SYNC_EVERY_MS) {
    return { status: "idle", finishedAt: state.finishedAt };
  }
  const claim = await claimLock(env, owner);
  if ("busy" in claim) {
    return { status: "running", remaining: remainingOf(state), locked: true };
  }
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
    await writeKey(env, SYNC_STATE_KEY, JSON.stringify(run));
    await removeKey(env, LOCK_KEY);
    throw error;
  }

  if (run.listing || run.pending.length > 0 || !run.hidden || run.hidden.pending.length > 0) {
    await writeKey(env, SYNC_STATE_KEY, JSON.stringify(run));
    return { status: "running", remaining: run.pending.length + (run.hidden?.pending.length ?? 0), owner: claim.owner };
  }

  const previous = await readCatalog(env);
  const at = new Date().toISOString();
  const liveDraft = [...run.cards, ...run.eventCards, ...(run.hidden?.cards ?? [])];
  const fromDex = preserveChangedEditions(previous.cards, liveDraft, at);
  const previousLegacy = previous.cards.filter((card) => card.legacy);
  const storedLegacy = await mergeLegacyEditions(env, [...previousLegacy, ...fromDex]);
  const kccChan = await fetchKccChanCharacter().catch(() => null);
  const promos = kccChan ? kccChanCards(kccChan) : [];
  const catalog = finishRun(run, storedLegacy, promos);
  if (previous.syncedAt && catalog.syncedAt) {
    catalog.cards = rememberAddedAt(previous.cards, catalog.cards, catalog.syncedAt);
  }
  await writeKey(env, "catalog", JSON.stringify(catalog));
  if (run.hidden.keep.length !== run.hidden.stored) await writeKey(env, HIDDEN_KEY, JSON.stringify(run.hidden.keep));
  await writeKey(env, SYNC_STATE_KEY, JSON.stringify({ finishedAt: catalog.syncedAt }));
  await removeKey(env, LOCK_KEY);
  return { status: "done", syncedAt: catalog.syncedAt!, count: catalog.cards.length };
}

export async function catalogSyncStatus(env: SyncEnv): Promise<CatalogSyncStatus> {
  const state = await env.CARDS.get<SyncState>(SYNC_STATE_KEY, "json");
  const raw = await env.CARDS.get("catalog");
  let finishedAt: string | null = null;
  let count: number | null = null;
  if (raw) {
    try {
      const catalog = JSON.parse(raw) as { syncedAt?: string | null; cards?: unknown[] };
      finishedAt = catalog.syncedAt ?? null;
      count = Array.isArray(catalog.cards) ? catalog.cards.length : null;
    } catch {
      finishedAt = null;
    }
  }
  if (state && "finishedAt" in state) finishedAt = state.finishedAt;
  if (state && !("finishedAt" in state)) {
    return { status: "running", finishedAt, remaining: remainingOf(state), count };
  }
  return { status: "idle", finishedAt, remaining: 0, count };
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
        holo: card.holo ?? null,
        fullCard: card.fullCard === true,
        image: artUrl(card.image),
        edition: card.edition ?? null,
        legacy: card.legacy === true,
      })),
  };
}
