export interface FeatureNote {
  id: string;
  title: string;
  body: string;
  image?: string;
  bleed?: boolean;
}

export const SEEN_FEATURE_KEY = "kcc-trader:seen-feature";

export const FEATURES: FeatureNote[] = [
  {
    id: "wishlist-priority",
    title: "Priority wishes",
    body: "Star a card in the catalog, or on your Wishlist, when you want it most. Priority wishes stay at the top, and the star shows on your page.",
    image: "/features/priority.svg",
  },
  {
    id: "profile-sections",
    title: "Jump between lists",
    body: "On a profile, For trade and Wishlist can fold away. The buttons under the menu jump straight to either list.",
    image: "/features/profile-sections.svg",
    bleed: true,
  },
  {
    id: "new-cards",
    title: "New cards",
    body: "Cards added in the last 7 days wear a New badge. Sort the catalog by Name, or by Newest, to bring them up front.",
    image: "/features/new-cards.svg",
  },
  {
    id: "wishlist-counts",
    title: "Wishlist counts",
    body: "A rose heart on a card is how many other traders have it on their Wishlist. It shows in the catalog, on For trade, and on your Wishlist.",
    image: "/features/wishlist-counts.svg",
  },
  {
    id: "profile-overlap",
    title: "See the overlap",
    body: "On someone else's page, the header shows how many of their cards you want, and how many of their wishes you can offer.",
    image: "/features/profile-overlap.svg",
  },
  {
    id: "trade-views",
    title: "You want, they want",
    body: "On Trades, switch to who has a card on your Wishlist, or who wants a card you're offering. People who are already a match stay under Matches.",
    image: "/features/trade-views.svg",
  },
  {
    id: "trade-notice",
    title: "New matches",
    body: "The Trades tab shows how many matches you have as soon as you arrive. It lights up when a match is new since you last opened it.",
    image: "/features/trade-notice.svg",
  },
  {
    id: "find-trader",
    title: "Find a trader",
    body: "Search the header for a display name, Discord username, or KCC name, and open that person's page.",
    image: "/features/find-trader.svg",
  },
  {
    id: "leaderboard",
    title: "Leaderboard",
    body: "The trophy in the header opens a leaderboard of public collections. It ranks by SSS cards, with collection value and level as the other orders.",
    image: "/features/leaderboard.svg",
  },
  {
    id: "owned-tags",
    title: "Owned tags",
    body: "A check in the corner marks a card you own. Turn Owned tags off in Settings to hide it.",
    image: "/features/owned-tags.svg",
  },
  {
    id: "skipped-cards",
    title: "Skip a card",
    body: "On For trade, Manage skipped cards keeps SS and SSS cards off duplicates listing. You can skip one before it is a spare.",
    image: "/features/skipped-cards.svg",
  },
  {
    id: "trades-perf",
    title: "Snappier Trades",
    body: "A long match list used to weigh Trades down. It should feel much quicker now — cards further down the list load as you scroll.",
    image: "/features/trades-perf.svg",
  },
  {
    id: "their-copies",
    title: "Their copy counts",
    body: "On Trades and on someone else's For trade, the gold chip shows how many copies they have — not only how many you have.",
    image: "/features/their-copies.svg",
  },
  {
    id: "kept-cards",
    title: "Keep on Wishlist",
    body: "On Wishlist, Manage kept cards leaves chosen cards on the list after you own them — even when Clear owned from Wishlist is on. You can keep one before you own it.",
    image: "/features/kept-cards.svg",
  },
];

function newestFirst(notes: readonly FeatureNote[]): FeatureNote[] {
  return [...notes].reverse();
}

export function unseenFeatures(seenId: string | null): FeatureNote[] {
  if (!seenId) return newestFirst(FEATURES);
  const index = FEATURES.findIndex((feature) => feature.id === seenId);
  const unseen = index === -1 ? FEATURES : FEATURES.slice(index + 1);
  return newestFirst(unseen);
}
