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
  image: string;
  hidden?: boolean;
}

export interface Catalog {
  syncedAt: string | null;
  cards: Card[];
}

export function cardKey(card: Pick<Card, "id" | "variantId" | "rank">): string {
  return `${card.id}:${card.variantId ?? ""}:${card.rank}`;
}
