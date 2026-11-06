export interface FeatureNote {
  id: string;
  title: string;
  body: string;
  image?: string;
}

export const SEEN_FEATURE_KEY = "kcc-trader:seen-feature";

export const FEATURES: FeatureNote[] = [
  {
    id: "visit-sync",
    title: "Your collection stays up to date",
    body: "Opening the site refreshes your collection when the last sync was more than 12 hours ago. The sync button still waits an hour between tries.",
  },
  {
    id: "help",
    title: "Help",
    body: "The question mark in the header opens a short guide to syncing, lists, and trades. There's a Help link in the footer too.",
    image: "/features/help.svg",
  },
];

export function unseenFeatures(seenId: string | null): FeatureNote[] {
  if (!seenId) return FEATURES;
  const index = FEATURES.findIndex((feature) => feature.id === seenId);
  if (index === -1) return FEATURES;
  return FEATURES.slice(index + 1);
}
