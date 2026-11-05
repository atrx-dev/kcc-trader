import { ArrowLeftRight, Handshake, Heart, LayoutGrid, type LucideIcon } from "lucide-react";
import { cardKey, type Card } from "../types.ts";

export interface SessionProfile {
  id: string;
  name: string;
  discordUsername: string;
  level: number;
  publicCollection: boolean;
  cards: number;
  sss: number;
}

export interface SessionUser {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string;
  profile: SessionProfile | null;
}

export interface Lists {
  forTrade: string[];
  wishlist: string[];
  accepting?: boolean;
  pruneWishlist?: boolean;
  listDuplicates?: boolean;
}

export interface ListSync {
  removed: Lists;
  unlisted: string[];
  added: string[];
}

export type ListName = "forTrade" | "wishlist";
export type Page = "catalog" | ListName | "trades" | "profile";

export interface ListChange {
  list: ListName;
  key: string;
  present: boolean;
}

export const NO_LISTS: Lists = { forTrade: [], wishlist: [] };
export const LIST_SAVE_DELAY = 1200;

export function withChanges(base: Lists, changes: ListChange[]): Lists {
  const next = { ...base };
  for (const { list, key, present } of changes) {
    const without = next[list].filter((item) => item !== key);
    next[list] = present ? [key, ...without] : without;
  }
  return next;
}

export interface Trader {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  kccName: string | null;
  kccId?: string | null;
  lastSeenAt?: number | null;
}

export const DAY = 24 * 60 * 60 * 1000;
export const INACTIVE_AFTER_DAYS = 30;

export function daysSince(time: number) {
  return Math.max(0, Math.floor((Date.now() - time) / DAY));
}

export function lastSeenLabel(time: number | null | undefined) {
  if (!time) return null;
  const days = daysSince(time);
  if (days === 0) return "Active today";
  if (days === 1) return "Active yesterday";
  if (days < 60) return `Active ${days} days ago`;
  return `Active ${Math.floor(days / 30)} months ago`;
}

export interface TradeMatch {
  trader: Trader;
  theyHave: string[];
  theyWant: string[];
}

export interface TradesState {
  status: "idle" | "loading" | "ready" | "error";
  matches: TradeMatch[];
}

export interface OwnedCards {
  ss: string[];
  sss: string[];
  duplicates?: Record<string, number>;
  hidden: boolean;
  fetchedAt: string;
  nextSyncAt: string;
}

export interface OwnedState {
  status: "idle" | "loading" | "ready" | "hidden" | "unavailable";
  ss: Set<string>;
  sss: Set<string>;
  duplicates: Record<string, number>;
  fetchedAt: string | null;
  nextSyncAt: string | null;
  syncing: boolean;
}

export type FacetId = "rarity" | "type" | "game" | "developer";
export type FacetSelection = Record<FacetId, string[]>;
export type OwnedFilter = "all" | "owned" | "missing" | "duplicates";

export const FACETS: { id: FacetId; label: string; value: (card: Card) => string }[] = [
  { id: "rarity", label: "Rarity", value: (card) => card.rank },
  { id: "type", label: "Type", value: (card) => cardTypeLabel(card) },
  { id: "game", label: "Game", value: (card) => card.game },
  { id: "developer", label: "Developer", value: (card) => card.creator },
];
export const NO_FACETS: FacetSelection = { rarity: [], type: [], game: [], developer: [] };

export interface Filters {
  facets: FacetSelection;
  owned: OwnedFilter;
}

export const NO_FILTERS: Filters = { facets: NO_FACETS, owned: "all" };
export const NO_PAGE_FILTERS: Record<Page, Filters> = {
  catalog: NO_FILTERS,
  forTrade: NO_FILTERS,
  wishlist: NO_FILTERS,
  trades: NO_FILTERS,
  profile: NO_FILTERS,
};

export interface Settings {
  hiddenRarities: string[];
  catalogDefaults: Filters;
  cardEffects: boolean;
}

export const SETTINGS_KEY = "kcc-trader:settings";
export const DEFAULT_SETTINGS: Settings = { hiddenRarities: [], catalogDefaults: NO_FILTERS, cardEffects: false };

export function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null") as {
      hiddenRarities?: unknown;
      catalogDefaults?: { facets?: Partial<Record<FacetId, unknown>>; owned?: unknown; duplicates?: unknown };
      cardEffects?: unknown;
    } | null;
    if (!raw) return DEFAULT_SETTINGS;
    const facets = { ...NO_FACETS };
    for (const facet of FACETS) facets[facet.id] = stringList(raw.catalogDefaults?.facets?.[facet.id]);
    const owned = raw.catalogDefaults?.owned;
    return {
      hiddenRarities: stringList(raw.hiddenRarities),
      catalogDefaults: {
        facets,
        owned:
          owned === "owned" || owned === "missing" || owned === "duplicates"
            ? owned
            : raw.catalogDefaults?.duplicates === true
              ? "duplicates"
              : "all",
      },
      cardEffects: raw.cardEffects === true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function withoutRarities(filters: Filters, hidden: string[]): Filters {
  const rarity = filters.facets.rarity.filter((value) => !hidden.includes(value));
  return rarity.length === filters.facets.rarity.length ? filters : { ...filters, facets: { ...filters.facets, rarity } };
}
export const OWNED_CHOICES: { value: OwnedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "owned", label: "Owned" },
  { value: "missing", label: "Not owned" },
  { value: "duplicates", label: "Duplicates" },
];

export const NO_OWNED: OwnedState = {
  status: "idle",
  ss: new Set(),
  sss: new Set(),
  duplicates: {},
  fetchedAt: null,
  nextSyncAt: null,
  syncing: false,
};

export class SyncCooldownError extends Error {
  constructor(readonly nextSyncAt: string) {
    super("Sync cooldown");
  }
}

export function ownedFromResponse(data: OwnedCards): OwnedState {
  return {
    status: data.hidden ? "hidden" : "ready",
    ss: new Set(data.ss),
    sss: new Set(data.sss),
    duplicates: data.duplicates ?? {},
    fetchedAt: data.fetchedAt,
    nextSyncAt: data.nextSyncAt,
    syncing: false,
  };
}

export async function requestOwned(
  method: "GET" | "POST",
  signal?: AbortSignal,
): Promise<{ state: OwnedState; catalogChanged: boolean; listSync: ListSync | null }> {
  const response = await fetch("/api/owned", { method, signal });
  if (response.status === 429) {
    const body = (await response.json().catch(() => null)) as { nextSyncAt?: string } | null;
    if (body?.nextSyncAt) throw new SyncCooldownError(body.nextSyncAt);
  }
  if (!response.ok) throw new Error("Could not load your collection");
  const data = (await response.json()) as OwnedCards & { catalogChanged?: boolean; listSync?: ListSync | null };
  return {
    state: ownedFromResponse(data),
    catalogChanged: Boolean(data.catalogChanged),
    listSync: data.listSync ?? null,
  };
}

export function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, { timeStyle: "short" });
}

export function isOwned(card: Card, owned: OwnedState): boolean {
  if (card.rank === "SSS") return owned.sss.has(`${card.id}:${card.variantId ?? ""}`);
  if (card.rank === "SS") return owned.ss.has(card.variantId ? `${card.id}:${card.variantId}` : card.id);
  return false;
}

export function cardsInCatalogOrder(keys: Iterable<string>, byKey: Map<string, Card>): Card[] {
  const wanted = new Set(keys);
  return [...byKey.values()].filter((card) => wanted.has(cardKey(card)));
}

export function duplicateCount(card: Card, owned: OwnedState): number {
  const count =
    card.rank === "SSS"
      ? (owned.duplicates[`${card.id}:${card.variantId ?? ""}`] ?? 0)
      : card.rank === "SS"
        ? (owned.duplicates[card.variantId ? `${card.id}:${card.variantId}` : card.id] ?? 0)
        : 0;
  return count > 1 ? count : 0;
}

export function isDuplicate(card: Card, owned: OwnedState): boolean {
  return duplicateCount(card, owned) > 1;
}

export const RANK_ORDER = ["Common", "B", "A", "S", "SS", "SSS"];
export const TYPE_ORDER = ["Character", "Halloween event", "Hidden"];
export const AUTH_ERRORS: Record<string, string> = {
  discord_config: "Discord login still needs a client id and secret.",
  discord_denied: "Discord sign-in was cancelled.",
  discord_failed: "Discord sign-in failed.",
};

export const PAGES: { id: Page; href: string; label: string; icon: LucideIcon; tone: string }[] = [
  { id: "catalog", href: "/", label: "Catalog", icon: LayoutGrid, tone: "text-amber-300" },
  { id: "forTrade", href: "/for-trade", label: "For trade", icon: ArrowLeftRight, tone: "text-sky-300" },
  { id: "wishlist", href: "/wishlist", label: "Wishlist", icon: Heart, tone: "text-rose-300" },
  { id: "trades", href: "/trades", label: "Trades", icon: Handshake, tone: "text-emerald-300" },
];

export const LIST_COPY: Record<
  ListName,
  { title: string; blurb: string; empty: string; icon: LucideIcon; bubble: string; glow: string }
> = {
  forTrade: {
    title: "For trade",
    blurb: "Cards you're happy to swap away.",
    empty: "Search above, or tap Trade on any card in the catalog.",
    icon: ArrowLeftRight,
    bubble: "bg-sky-300/15 text-sky-300",
    glow: "bg-[radial-gradient(110%_130%_at_0%_0%,rgba(125,200,255,0.2),transparent_55%),linear-gradient(160deg,#1a1d33,#141224)]",
  },
  wishlist: {
    title: "Wishlist",
    blurb: "Cards you're hunting for.",
    empty: "Search above, or tap Wishlist on any card in the catalog.",
    icon: Heart,
    bubble: "bg-rose-300/15 text-rose-300",
    glow: "bg-[radial-gradient(110%_130%_at_0%_0%,rgba(255,140,190,0.2),transparent_55%),linear-gradient(160deg,#241a33,#141224)]",
  },
};

export const ACTIONS_HEIGHT = 34;

export function pageFromPath(path: string): Page {
  if (path === "/for-trade") return "forTrade";
  if (path === "/wishlist" || path === "/wanted") return "wishlist";
  if (path === "/trades") return "trades";
  if (profileIdFromPath(path)) return "profile";
  return "catalog";
}

export function profileIdFromPath(path: string): string | null {
  return path.match(/^\/u\/(\d{5,25})\/?$/)?.[1] ?? null;
}

export function profileUrl(userId: string): string {
  return `${window.location.origin}/u/${userId}`;
}

export function kccTradeUrl(trader: Trader): string {
  return `https://koi-card-collector.com/trade?to=${encodeURIComponent(trader.kccId ?? trader.id)}`;
}

export const FACET_PARAMS: Record<FacetId, string> = { rarity: "rarity", type: "type", game: "game", developer: "dev" };
export const OWNED_PARAMS: Record<OwnedFilter, string | null> = {
  all: null,
  owned: "yes",
  missing: "no",
  duplicates: "duplicates",
};

export function readUrlState(search: string): { query: string; filters: Filters } {
  const params = new URLSearchParams(search);
  const facets = { ...NO_FACETS };
  for (const facet of FACETS) {
    facets[facet.id] = [...new Set(params.getAll(FACET_PARAMS[facet.id]).filter(Boolean))];
  }
  const ownedParam = params.get("owned");
  const owned =
    ownedParam === "yes"
      ? "owned"
      : ownedParam === "no"
        ? "missing"
        : ownedParam === "duplicates" || params.get("duplicates") === "yes"
          ? "duplicates"
          : "all";
  return { query: params.get("q") ?? "", filters: { facets, owned } };
}

export function urlSearchFor(query: string, filters: Filters): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  for (const facet of FACETS) {
    for (const value of filters.facets[facet.id]) params.append(FACET_PARAMS[facet.id], value);
  }
  const owned = OWNED_PARAMS[filters.owned];
  if (owned) params.set("owned", owned);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function urlHasFilters(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has("owned") || params.has("duplicates") || FACETS.some((facet) => params.has(FACET_PARAMS[facet.id]));
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function cardTypeLabel(card: Card): string {
  const border = card.border ?? "";
  const eventName = card.eventName ?? "";
  const variantName = card.variantName ?? "";
  if (
    border.startsWith("halloween") ||
    eventName.toLowerCase().includes("halloween") ||
    variantName.toLowerCase().includes("halloween")
  ) {
    return "Halloween event";
  }
  if (card.hidden) return "Hidden";
  return "Character";
}

export function searchableText(card: Card): string {
  return `${card.name} ${card.variantName ?? ""} ${card.game} ${card.creator}`.toLowerCase();
}

export function orderedValues(values: string[], order: string[]): string[] {
  const present = new Set(values);
  const known = order.filter((value) => present.has(value));
  const extra = uniqueSorted([...present]).filter((value) => !order.includes(value));
  return [...known, ...extra];
}

export function facetOptionsFor(cards: Card[]): Record<FacetId, string[]> {
  return {
    rarity: orderedValues(cards.map((card) => card.rank), RANK_ORDER),
    type: orderedValues(cards.map(cardTypeLabel), TYPE_ORDER),
    game: uniqueSorted(cards.map((card) => card.game)),
    developer: uniqueSorted(cards.map((card) => card.creator)),
  };
}

export function ownedFilterActive(filters: Filters, owned: OwnedState): boolean {
  return owned.status === "ready" && (filters.owned === "owned" || filters.owned === "missing");
}

export function duplicatesFilterActive(filters: Filters, owned: OwnedState): boolean {
  return owned.status === "ready" && filters.owned === "duplicates";
}

export function filtersAreActive(filters: Filters, owned: OwnedState): boolean {
  return (
    ownedFilterActive(filters, owned) ||
    duplicatesFilterActive(filters, owned) ||
    FACETS.some((facet) => filters.facets[facet.id].length > 0)
  );
}

export function applyFilters(cards: Card[], filters: Filters, owned: OwnedState, needle: string) {
  const ownedActive = ownedFilterActive(filters, owned);
  const duplicatesActive = duplicatesFilterActive(filters, owned);
  const passes = (card: Card, skip?: FacetId) => {
    if (needle && !searchableText(card).includes(needle)) return false;
    if (ownedActive && isOwned(card, owned) !== (filters.owned === "owned")) return false;
    if (duplicatesActive && !isDuplicate(card, owned)) return false;
    for (const facet of FACETS) {
      if (facet.id === skip) continue;
      const chosen = filters.facets[facet.id];
      if (chosen.length > 0 && !chosen.includes(facet.value(card))) return false;
    }
    return true;
  };
  const counts = Object.fromEntries(
    FACETS.map((facet) => {
      const tally = new Map<string, number>();
      for (const card of cards) {
        if (!passes(card, facet.id)) continue;
        const value = facet.value(card);
        tally.set(value, (tally.get(value) ?? 0) + 1);
      }
      return [facet.id, tally];
    }),
  ) as Record<FacetId, Map<string, number>>;
  return { cards: cards.filter((card) => passes(card)), counts };
}
