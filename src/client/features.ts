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
    id: "find-trader",
    title: "Find a trader",
    body: "Search the header for a display name, Discord username, or KCC name, and open that person's page.",
    image: "/features/find-trader.svg",
  },
  {
    id: "profile-overlap",
    title: "See the overlap",
    body: "On someone else's page, the header shows how many of their cards you want, and how many of their wishes you can offer.",
    image: "/features/profile-overlap.svg",
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
