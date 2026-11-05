import type { Card, CardCategory, Catalog } from "./types.ts";

const ORIGIN = "https://koi-card-collector.com";
const MAX_PAGES = 40;
const HIDDEN_KEY = "hidden-characters";
const MAX_DISCOVERIES = 5;

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

async function fetchCategory(category: CardCategory): Promise<Card[]> {
  const cards: Card[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
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

    const data = (await response.json()) as DexPage;
    const pageCards = data.cards ?? [];
    if (pageCards.length === 0) return cards;

    for (const card of pageCards) cards.push(slim(card, category));
    if (typeof data.total === "number" && cards.length >= data.total) return cards;
  }

  throw new Error(`Dex ${category} exceeded ${MAX_PAGES} pages`);
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

async function hiddenCatalogCards(env: SyncEnv, known: Set<string>): Promise<Card[]> {
  const stored = await readHiddenIds(env);
  const candidates = stored.filter((id) => !known.has(id));
  const details = await mapPool(candidates, 6, fetchCharacterOrNull);
  const hidden = details.filter((character): character is DexCharacter => Boolean(character && !character.inPool));
  const keep = hidden.map((character) => character.id);
  if (keep.length !== stored.length) await env.CARDS.put(HIDDEN_KEY, JSON.stringify(keep));
  return hidden.flatMap(hiddenCardsFor);
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
  await env.CARDS.put("catalog", JSON.stringify({ ...catalog, cards: [...catalog.cards, ...added] }));
  return true;
}

export async function syncCatalog(env: SyncEnv): Promise<Catalog> {
  const [characterCards, eventCards] = await Promise.all([
    fetchCategory("characters"),
    fetchCategory("events"),
  ]);
  const details = await mapPool(
    [...new Set(characterCards.map((card) => card.id))],
    6,
    fetchCharacter,
  );

  const ssCards = details.map((character) => rankCardFor(character, "SS"));
  const sssCards = details.flatMap(sssCardsFor);
  const seenVariants = new Set(
    sssCards.map((card) => card.variantId).filter((id): id is string => Boolean(id)),
  );
  const extraEvents = eventCards.filter(
    (card) => !card.variantId || !seenVariants.has(card.variantId),
  );

  const listed = [...ssCards, ...sssCards, ...extraEvents];
  const hiddenCards = await hiddenCatalogCards(env, new Set(listed.map((card) => card.id)));
  const cards = [...listed, ...hiddenCards];

  const catalog: Catalog = {
    syncedAt: new Date().toISOString(),
    cards,
  };
  await env.CARDS.put("catalog", JSON.stringify(catalog));
  return catalog;
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
