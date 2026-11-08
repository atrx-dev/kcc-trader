import type { Card } from "../types.ts";

const BORDERLESS = new Set(["besties", "kcc-chan"]);

export const STANDARD_SHINE_BORDERS = ["sunburst", "cobalt", "sovereign", "glitch", "duality", "emerald"] as const;
export type StandardShineBorder = (typeof STANDARD_SHINE_BORDERS)[number];

export function isStandardShineBorder(border: string): border is StandardShineBorder {
  return (STANDARD_SHINE_BORDERS as readonly string[]).includes(border);
}

export function hasFrame(card: Pick<Card, "name" | "variantName" | "eventName" | "fullCard">): boolean {
  if (card.fullCard) return false;
  for (const part of [card.name, card.variantName, card.eventName]) {
    if (part && BORDERLESS.has(part.toLowerCase())) return false;
  }
  return true;
}

const RANK_FRAMES: Record<string, string> = {
  Common: "/frames/common.webp",
  B: "/frames/b.webp",
  A: "/frames/a.webp",
  S: "/frames/s.webp",
  SS: "/frames/ss.webp",
  SSS: "/frames/sss.webp",
};

const NAME_PLATE_INSET: Record<string, number> = {
  "halloween-1": 272,
  "halloween-2": 286,
  "halloween-3": 280,
  "halloween-4": 273,
  "halloween-5": 282,
  "halloween-6": 300,
  "halloween-7": 300,
  "halloween-8": 298,
  "halloween-9": 285,
  "halloween-10": 314,
  sunburst: 280,
  cobalt: 310,
  sovereign: 320,
  glitch: 300,
  duality: 258,
  emerald: 280,
};

function isPngBorder(border: string): boolean {
  return border.startsWith("halloween-") || isStandardShineBorder(border);
}

function framePath(card: Card): string {
  if (card.rank !== "SSS") return RANK_FRAMES[card.rank] ?? RANK_FRAMES.Common;
  const border = card.border || "starry";
  if (border === "starry") return "/frames/sss.webp";
  const extension = isPngBorder(border) ? "png" : "webp";
  return `/frames/sss-${border}.${extension}`;
}

export function frameUrl(card: Card): string {
  return framePath(card);
}

export function namePlateStyle(card: Card): { left: string; width: string } | undefined {
  if (card.rank !== "SSS") return undefined;
  const border = card.border || "starry";
  const raw = NAME_PLATE_INSET[border] ?? (border === "starry" ? 240 : 258);
  const inset = raw / 6;
  return { left: `${inset}%`, width: `${97 - inset}%` };
}
