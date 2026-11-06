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
];

export function unseenFeatures(seenId: string | null): FeatureNote[] {
  if (!seenId) return FEATURES;
  const index = FEATURES.findIndex((feature) => feature.id === seenId);
  if (index === -1) return FEATURES;
  return FEATURES.slice(index + 1);
}
