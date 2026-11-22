export type CardCategory = "characters" | "events";

export interface Card {
  id: string;
  name: string;
  game: string;
  creator: string;
  rank: string;
  category: CardCategory;
  eventName: string | null;
  variantId: string | null;
  variantName: string | null;
  border: string | null;
  holo: string | null;
  fullCard: boolean;
  image: string;
  /** Fingerprint of frozen border+art; set only on legacy editions. */
  edition?: string | null;
  /** True when this visual is no longer the current dex edition. */
  legacy?: boolean;
  hidden?: boolean;
  addedAt?: string;
}

export interface Catalog {
  syncedAt: string | null;
  cards: Card[];
}

export function artIdFromImage(image: string | undefined): string {
  if (!image) return "";
  const match = image.match(/\/art\/([0-9a-f-]{36})/i);
  return match?.[1] ?? "";
}

/** Stable fingerprint for a frozen border + art pair (no colons). */
export function editionFingerprint(border: string | null | undefined, image: string | undefined): string {
  return `${border ?? ""}+${artIdFromImage(image)}`;
}

export function baseCardKey(card: Pick<Card, "id" | "variantId" | "rank">): string {
  return `${card.id}:${card.variantId ?? ""}:${card.rank}`;
}

export function cardKey(card: Pick<Card, "id" | "variantId" | "rank" | "edition" | "legacy">): string {
  const base = baseCardKey(card);
  return card.legacy && card.edition ? `${base}:${card.edition}` : base;
}

/** Ownership / edition key for the card's current visual (always includes fingerprint). */
export function visualKey(card: Pick<Card, "id" | "variantId" | "rank" | "border" | "image" | "edition" | "legacy">): string {
  if (card.legacy && card.edition) return cardKey(card);
  return `${baseCardKey(card)}:${editionFingerprint(card.border, card.image)}`;
}

export function sameVisual(
  a: Pick<Card, "border" | "image">,
  b: Pick<Card, "border" | "image">,
): boolean {
  return (a.border ?? "") === (b.border ?? "") && artIdFromImage(a.image) === artIdFromImage(b.image);
}

export function asLegacyCard(card: Card, addedAt?: string): Card {
  const edition = card.edition || editionFingerprint(card.border, card.image);
  return {
    ...card,
    edition,
    legacy: true,
    addedAt: addedAt ?? card.addedAt,
  };
}

export const NEW_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export function isNewCard(card: Pick<Card, "addedAt">, now = Date.now()): boolean {
  if (!card.addedAt) return false;
  const added = Date.parse(card.addedAt);
  return Number.isFinite(added) && added <= now && now - added < NEW_FOR_MS;
}
