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
  hidden?: boolean;
  addedAt?: string;
}

export interface Catalog {
  syncedAt: string | null;
  cards: Card[];
}

export function cardKey(card: Pick<Card, "id" | "variantId" | "rank">): string {
  return `${card.id}:${card.variantId ?? ""}:${card.rank}`;
}

export const NEW_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export function isNewCard(card: Pick<Card, "addedAt">, now = Date.now()): boolean {
  if (!card.addedAt) return false;
  const added = Date.parse(card.addedAt);
  return Number.isFinite(added) && added <= now && now - added < NEW_FOR_MS;
}
