import { Fragment, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  ArrowLeftRight,
  Check,
  Eye,
  EyeOff,
  Heart,
  LayoutGrid,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SearchX,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { cardKey, type Card, type Catalog } from "../types.ts";
import { frameUrl, namePlateStyle } from "./frame.ts";
import { useGridScrolling, VirtualGrid } from "./VirtualGrid.tsx";

interface SessionProfile {
  id: string;
  name: string;
  discordUsername: string;
  level: number;
  publicCollection: boolean;
  cards: number;
  sss: number;
}

interface SessionUser {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string;
  profile: SessionProfile | null;
}

interface Lists {
  forTrade: string[];
  wishlist: string[];
}

type ListName = keyof Lists;
type Page = "catalog" | ListName;

interface OwnedCards {
  characters: string[];
  ss: string[];
  sss: string[];
  hidden: boolean;
  fetchedAt: string;
  nextSyncAt: string;
}

interface OwnedState {
  status: "idle" | "loading" | "ready" | "hidden" | "unavailable";
  characters: Set<string>;
  ss: Set<string>;
  sss: Set<string>;
  fetchedAt: string | null;
  nextSyncAt: string | null;
  syncing: boolean;
}

type FacetId = "rarity" | "type" | "game" | "developer";
type FacetSelection = Record<FacetId, string[]>;
type OwnedFilter = "all" | "owned" | "missing";

const FACETS: { id: FacetId; label: string; value: (card: Card) => string }[] = [
  { id: "rarity", label: "Rarity", value: (card) => card.rank },
  { id: "type", label: "Type", value: (card) => cardTypeLabel(card) },
  { id: "game", label: "Game", value: (card) => card.game },
  { id: "developer", label: "Developer", value: (card) => card.creator },
];
const NO_FACETS: FacetSelection = { rarity: [], type: [], game: [], developer: [] };

interface Filters {
  facets: FacetSelection;
  owned: OwnedFilter;
}

const NO_FILTERS: Filters = { facets: NO_FACETS, owned: "all" };
const NO_PAGE_FILTERS: Record<Page, Filters> = { catalog: NO_FILTERS, forTrade: NO_FILTERS, wishlist: NO_FILTERS };

interface Settings {
  hiddenRarities: string[];
  catalogDefaults: Filters;
}

const SETTINGS_KEY = "kcc-trader:settings";
const DEFAULT_SETTINGS: Settings = { hiddenRarities: [], catalogDefaults: NO_FILTERS };

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function loadSettings(): Settings {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null") as {
      hiddenRarities?: unknown;
      catalogDefaults?: { facets?: Partial<Record<FacetId, unknown>>; owned?: unknown };
    } | null;
    if (!raw) return DEFAULT_SETTINGS;
    const facets = { ...NO_FACETS };
    for (const facet of FACETS) facets[facet.id] = stringList(raw.catalogDefaults?.facets?.[facet.id]);
    const owned = raw.catalogDefaults?.owned;
    return {
      hiddenRarities: stringList(raw.hiddenRarities),
      catalogDefaults: { facets, owned: owned === "owned" || owned === "missing" ? owned : "all" },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function withoutRarities(filters: Filters, hidden: string[]): Filters {
  const rarity = filters.facets.rarity.filter((value) => !hidden.includes(value));
  return rarity.length === filters.facets.rarity.length ? filters : { ...filters, facets: { ...filters.facets, rarity } };
}
const OWNED_CHOICES: { value: OwnedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "owned", label: "Owned" },
  { value: "missing", label: "Not owned" },
];

const NO_OWNED: OwnedState = {
  status: "idle",
  characters: new Set(),
  ss: new Set(),
  sss: new Set(),
  fetchedAt: null,
  nextSyncAt: null,
  syncing: false,
};

class SyncCooldownError extends Error {
  constructor(readonly nextSyncAt: string) {
    super("Sync cooldown");
  }
}

function ownedFromResponse(data: OwnedCards): OwnedState {
  return {
    status: data.hidden ? "hidden" : "ready",
    characters: new Set(data.characters),
    ss: new Set(data.ss),
    sss: new Set(data.sss),
    fetchedAt: data.fetchedAt,
    nextSyncAt: data.nextSyncAt,
    syncing: false,
  };
}

async function requestOwned(
  method: "GET" | "POST",
  signal?: AbortSignal,
): Promise<{ state: OwnedState; catalogChanged: boolean }> {
  const response = await fetch("/api/owned", { method, signal });
  if (response.status === 429) {
    const body = (await response.json().catch(() => null)) as { nextSyncAt?: string } | null;
    if (body?.nextSyncAt) throw new SyncCooldownError(body.nextSyncAt);
  }
  if (!response.ok) throw new Error("Could not load your collection");
  const data = (await response.json()) as OwnedCards & { catalogChanged?: boolean };
  return { state: ownedFromResponse(data), catalogChanged: Boolean(data.catalogChanged) };
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, { timeStyle: "short" });
}

function isOwned(card: Card, owned: OwnedState): boolean {
  if (card.rank === "SSS") return owned.sss.has(`${card.id}:${card.variantId ?? ""}`);
  if (card.rank === "SS") return owned.ss.has(card.id);
  return owned.characters.has(card.id);
}

const RANK_ORDER = ["Common", "B", "A", "S", "SS", "SSS"];
const TYPE_ORDER = ["Character", "Halloween event", "Hidden"];
const AUTH_ERRORS: Record<string, string> = {
  discord_config: "Discord login still needs a client id and secret.",
  discord_denied: "Discord sign-in was cancelled.",
  discord_failed: "Discord sign-in failed.",
};

const PAGES: { id: Page; href: string; label: string; icon: LucideIcon; tone: string }[] = [
  { id: "catalog", href: "/", label: "Catalog", icon: LayoutGrid, tone: "text-amber-300" },
  { id: "forTrade", href: "/for-trade", label: "For trade", icon: ArrowLeftRight, tone: "text-sky-300" },
  { id: "wishlist", href: "/wishlist", label: "Wishlist", icon: Heart, tone: "text-rose-300" },
];

const LIST_COPY: Record<
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

const ACTIONS_HEIGHT = 34;

function pageFromPath(path: string): Page {
  if (path === "/for-trade") return "forTrade";
  if (path === "/wishlist" || path === "/wanted") return "wishlist";
  return "catalog";
}

const FACET_PARAMS: Record<FacetId, string> = { rarity: "rarity", type: "type", game: "game", developer: "dev" };
const OWNED_PARAMS: Record<OwnedFilter, string | null> = { all: null, owned: "yes", missing: "no" };

function readUrlState(search: string): { query: string; filters: Filters } {
  const params = new URLSearchParams(search);
  const facets = { ...NO_FACETS };
  for (const facet of FACETS) {
    facets[facet.id] = [...new Set(params.getAll(FACET_PARAMS[facet.id]).filter(Boolean))];
  }
  const ownedParam = params.get("owned");
  const owned = ownedParam === "yes" ? "owned" : ownedParam === "no" ? "missing" : "all";
  return { query: params.get("q") ?? "", filters: { facets, owned } };
}

function urlSearchFor(query: string, filters: Filters): string {
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

function urlHasFilters(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has("owned") || FACETS.some((facet) => params.has(FACET_PARAMS[facet.id]));
}

const INITIAL_PAGE = pageFromPath(window.location.pathname);
const INITIAL_URL_STATE = readUrlState(window.location.search);
const INITIAL_SETTINGS = loadSettings();
const INITIAL_PAGE_FILTERS: Record<Page, Filters> = {
  ...NO_PAGE_FILTERS,
  catalog: INITIAL_SETTINGS.catalogDefaults,
  ...(INITIAL_PAGE !== "catalog" || urlHasFilters(window.location.search)
    ? { [INITIAL_PAGE]: INITIAL_URL_STATE.filters }
    : {}),
};

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function cardTypeLabel(card: Card): string {
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

function searchableText(card: Card): string {
  return `${card.name} ${card.variantName ?? ""} ${card.game} ${card.creator}`.toLowerCase();
}

function orderedValues(values: string[], order: string[]): string[] {
  const present = new Set(values);
  const known = order.filter((value) => present.has(value));
  const extra = uniqueSorted([...present]).filter((value) => !order.includes(value));
  return [...known, ...extra];
}

function facetOptionsFor(cards: Card[]): Record<FacetId, string[]> {
  return {
    rarity: orderedValues(cards.map((card) => card.rank), RANK_ORDER),
    type: orderedValues(cards.map(cardTypeLabel), TYPE_ORDER),
    game: uniqueSorted(cards.map((card) => card.game)),
    developer: uniqueSorted(cards.map((card) => card.creator)),
  };
}

function ownedFilterActive(filters: Filters, owned: OwnedState): boolean {
  return owned.status === "ready" && filters.owned !== "all";
}

function filtersAreActive(filters: Filters, owned: OwnedState): boolean {
  return ownedFilterActive(filters, owned) || FACETS.some((facet) => filters.facets[facet.id].length > 0);
}

function applyFilters(cards: Card[], filters: Filters, owned: OwnedState, needle: string) {
  const ownedActive = ownedFilterActive(filters, owned);
  const passes = (card: Card, skip?: FacetId) => {
    if (needle && !searchableText(card).includes(needle)) return false;
    if (ownedActive && isOwned(card, owned) !== (filters.owned === "owned")) return false;
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

const SSS_STARS = [
  [9, 12], [82, 8], [24, 31], [69, 23], [94, 41], [14, 58],
  [78, 63], [41, 10], [90, 72], [8, 82], [59, 48], [31, 70],
] as const;

const BESTIES_STARS = [
  [6, 10], [92, 14], [14, 69], [86, 57], [5, 89], [94, 82], [22, 92], [80, 94],
] as const;

function isBesties(card: Card): boolean {
  const name = `${card.eventName ?? ""} ${card.variantName ?? ""}`.toLowerCase();
  return name.includes("besties");
}

function tiltFoil(event: ReactPointerEvent<HTMLDivElement>) {
  if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  event.currentTarget.style.setProperty("--foil-x", `${x * 100}%`);
  event.currentTarget.style.setProperty("--foil-y", `${y * 100}%`);
  event.currentTarget.style.setProperty("--tilt-x", `${(0.5 - y) * 8}deg`);
  event.currentTarget.style.setProperty("--tilt-y", `${(x - 0.5) * 10}deg`);
}

function resetFoil(event: ReactPointerEvent<HTMLDivElement>) {
  event.currentTarget.style.setProperty("--tilt-x", "0deg");
  event.currentTarget.style.setProperty("--tilt-y", "0deg");
}

function FoilCard({ card, children }: { card: Card; children: ReactNode }) {
  const scrolling = useGridScrolling();
  const besties = isBesties(card);
  const border = card.border || "starry";
  const halloween = border.startsWith("halloween-");
  const stars = besties ? BESTIES_STARS : SSS_STARS;
  return (
    <div className="foil-stage">
      <div
        className="foil-sample"
        data-tier={besties ? "SS" : card.rank}
        data-holo={besties ? "besties" : card.rank === "SSS" ? border : undefined}
        data-effects={scrolling ? "false" : "true"}
        data-paused={scrolling ? "true" : undefined}
        data-frame-only={halloween ? "true" : "false"}
        style={{
          ["--foil-strength" as string]: halloween ? 0.36 : 0.8,
          ["--foil-frame" as string]: `url("${frameUrl(card)}")`,
        }}
        onPointerMove={scrolling ? undefined : tiltFoil}
        onPointerLeave={scrolling ? undefined : resetFoil}
      >
        {children}
        {scrolling ? null : (
          <div className="foil-treatment" aria-hidden="true">
            <div className="foil-color" />
            <div className="foil-grain" />
            <div className="foil-sweep" />
            <div className="foil-glare" />
            {card.rank === "SSS" ? (
              <div className="foil-stars">
                {stars.map(([left, top], index) => (
                  <i
                    key={`${left}-${top}`}
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      animationDelay: `-${index * 0.47}s`,
                      width: index % 3 === 0 ? 16 : 9,
                      height: index % 3 === 0 ? 16 : 9,
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function CardFace({ card }: { card: Card }) {
  const holo = card.rank === "S" || card.rank === "SS" || card.rank === "SSS";
  const face = (
    <div
      className={holo ? "card framed-card foil" : "card framed-card"}
      data-rank={card.rank}
      data-sss-border={card.rank === "SSS" ? card.border || "starry" : undefined}
      aria-label={`${card.name}, ${card.rank}, ${card.game} by ${card.creator}`}
    >
      {card.image ? (
        <img className="card-artwork" src={card.image} alt="" decoding="async" />
      ) : (
        <div className="art-fallback" />
      )}
      <img className="card-border" src={frameUrl(card)} alt="" decoding="async" />
      <footer style={namePlateStyle(card)}>
        <strong title={card.name}>{card.name}</strong>
        <span title={card.game}>{card.game}</span>
        {card.creator ? <span title={`by ${card.creator}`}>by {card.creator}</span> : null}
      </footer>
    </div>
  );
  return holo ? <FoilCard card={card}>{face}</FoilCard> : face;
}

function formatSyncedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function Brand({ onOpen }: { onOpen: (page: Page, href: string) => void }) {
  return (
    <a
      href="/"
      className="flex shrink-0 items-center gap-2.5"
      onClick={(event) => {
        event.preventDefault();
        onOpen("catalog", "/");
      }}
    >
      <span className="grid size-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#fde7b0,#f3c46f_45%,#f59cc0)] text-[#2a1a08] shadow-[0_8px_24px_-10px_rgba(245,156,192,0.9)]">
        <Sparkles className="size-[1.1rem]" strokeWidth={2.4} />
      </span>
      <span className="font-display text-xl leading-none font-extrabold tracking-tight">
        KCC <span className="text-amber-200">Trader</span>
      </span>
    </a>
  );
}

function NavTabs({
  page,
  counts,
  onOpen,
  className,
}: {
  page: Page;
  counts: Record<Page, number | null>;
  onOpen: (page: Page, href: string) => void;
  className?: string;
}) {
  return (
    <nav
      aria-label="Sections"
      className={cn("flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1", className)}
    >
      {PAGES.map((item) => {
        const active = page === item.id;
        const Icon = item.icon;
        const count = counts[item.id];
        return (
          <a
            key={item.id}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              onOpen(item.id, item.href);
            }}
            className={cn(
              "flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-medium whitespace-nowrap transition-colors sm:gap-2 sm:px-3.5 md:flex-none",
              active
                ? "bg-[#f3d58f] text-[#1b1509] shadow-[0_8px_22px_-10px_rgba(243,213,143,0.8)]"
                : "text-white/70 hover:bg-white/[0.07] hover:text-white",
            )}
          >
            <Icon className={cn("size-4", active ? "text-[#1b1509]" : item.tone)} />
            {item.label}
            {count !== null ? (
              <span
                className={cn(
                  "hidden rounded-full px-1.5 py-0.5 text-[0.7rem] leading-none font-semibold tabular-nums min-[420px]:inline",
                  active ? "bg-black/15" : "bg-white/10 text-white/70",
                )}
              >
                {count.toLocaleString()}
              </span>
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}

function AccountMenu({ user }: { user: SessionUser | null }) {
  if (!user) {
    return (
      <Button asChild className="h-9 rounded-full bg-[#5865f2] px-4 text-white hover:bg-[#4752c4]">
        <a href="/auth/discord">
          <LogIn />
          <span className="hidden sm:inline">Sign in with Discord</span>
          <span className="sm:hidden">Sign in</span>
        </a>
      </Button>
    );
  }

  const label = user.globalName ?? user.username;
  return (
    <div className="flex items-center gap-2.5">
      <div className="hidden text-right leading-tight sm:block">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-white/55">
          {user.profile ? `Level ${user.profile.level}` : "No public KCC profile"}
        </p>
      </div>
      <Avatar className="size-9 ring-2 ring-amber-200/50 ring-offset-2 ring-offset-[#151223]">
        <AvatarImage src={user.avatarUrl} alt="" />
        <AvatarFallback>{label.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <form method="post" action="/auth/logout">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="submit" size="icon" variant="ghost" className="rounded-full text-white/60" aria-label="Sign out">
              <LogOut />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sign out</TooltipContent>
        </Tooltip>
      </form>
    </div>
  );
}

function SearchField({
  id,
  value,
  placeholder,
  label,
  large = false,
  onChange,
}: {
  id: string;
  value: string;
  placeholder: string;
  label: string;
  large?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Search
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-white/45",
          large ? "left-5 size-5" : "left-4 size-4",
        )}
      />
      <Input
        id={id}
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "rounded-full border-white/12 bg-black/25 placeholder:text-white/40 [&::-webkit-search-cancel-button]:hidden",
          large ? "h-14 pr-12 pl-13 text-base md:text-base" : "h-11 pr-11 pl-11",
        )}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2.5 grid size-8 -translate-y-1/2 place-items-center rounded-full text-white/55 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

function FacetFilter({
  label,
  options,
  counts,
  selected,
  onChange,
  field = false,
}: {
  label: string;
  options: string[];
  counts: Map<string, number>;
  selected: string[];
  onChange: (values: string[]) => void;
  field?: boolean;
}) {
  const active = selected.length > 0;
  return (
    <Combobox multiple items={options} value={selected} onValueChange={(next: string[]) => onChange(next)}>
      {field ? (
        <ComboboxTrigger
          aria-label={label}
          className={cn(
            "flex h-9 w-full min-w-0 items-center gap-2 rounded-xl border px-3 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            active
              ? "border-amber-200/40 bg-amber-200/[0.08] text-amber-50"
              : "border-white/10 bg-white/[0.04] text-white/45 hover:bg-white/[0.08]",
          )}
        >
          <span className="min-w-0 flex-1 truncate">{active ? selected.join(", ") : "Any"}</span>
          {selected.length > 1 ? (
            <span className="rounded-full bg-[#f3d58f] px-1.5 text-xs font-semibold text-[#1b1509] tabular-nums">
              {selected.length}
            </span>
          ) : null}
        </ComboboxTrigger>
      ) : (
        <ComboboxTrigger
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            active
              ? "border-amber-200/40 bg-amber-200/[0.1] text-amber-50"
              : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white",
          )}
        >
          {label}
          {selected.length === 1 ? <span className="max-w-36 truncate text-amber-100/75">{selected[0]}</span> : null}
          {selected.length > 1 ? (
            <span className="rounded-full bg-[#f3d58f] px-1.5 text-xs font-semibold text-[#1b1509] tabular-nums">
              {selected.length}
            </span>
          ) : null}
        </ComboboxTrigger>
      )}
      <ComboboxContent className="w-72">
        <ComboboxInput showTrigger={false} placeholder={`Search ${label.toLowerCase()}…`} />
        <ComboboxEmpty>No matches.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => {
            const count = counts.get(item) ?? 0;
            return (
              <ComboboxItem key={item} value={item} className={cn(count === 0 && !selected.includes(item) && "opacity-45")}>
                <span className="min-w-0 flex-1 truncate">{item}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{count.toLocaleString()}</span>
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function OwnedToggle({
  value,
  disabled,
  onChange,
  className,
}: {
  value: OwnedFilter;
  disabled: boolean;
  onChange: (value: OwnedFilter) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Owned"
      className={cn(
        "inline-flex h-9 items-center rounded-full border border-white/10 bg-white/[0.04] p-1",
        disabled && "opacity-50",
        className,
      )}
    >
      {OWNED_CHOICES.map((choice) => {
        const active = value === choice.value;
        return (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(choice.value)}
            className={cn(
              "h-7 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "bg-[#f3d58f] text-[#1b1509]" : "text-white/70 enabled:hover:text-white",
            )}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}

function FilterChip({ prefix, label, onRemove }: { prefix?: string; label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${prefix ? `${prefix} ` : ""}${label} filter`}
      className="inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-white/[0.08] pr-1.5 pl-3 text-xs font-medium text-white/85 transition-colors hover:bg-white/[0.14] hover:text-white"
    >
      {prefix ? <span className="text-white/50">{prefix}</span> : null}
      <span className="truncate">{label}</span>
      <X className="size-3.5 shrink-0 text-white/60" />
    </button>
  );
}

function SettingsSheet({
  settings,
  onChange,
  rarities,
  cards,
  options,
  owned,
  ownedAvailable,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
  rarities: string[];
  cards: Card[];
  options: Record<FacetId, string[]>;
  owned: OwnedState;
  ownedAvailable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const visibleRarities = rarities.filter((rarity) => !settings.hiddenRarities.includes(rarity));
  const defaults = settings.catalogDefaults;
  const counts = useMemo(
    () => (open ? applyFilters(cards, defaults, owned, "").counts : null),
    [open, cards, defaults, owned],
  );
  const defaultsActive = defaults.owned !== "all" || FACETS.some((facet) => defaults.facets[facet.id].length > 0);

  function toggleRarity(rarity: string) {
    const hidden = settings.hiddenRarities.includes(rarity)
      ? settings.hiddenRarities.filter((value) => value !== rarity)
      : [...settings.hiddenRarities, rarity];
    onChange({ ...settings, hiddenRarities: hidden });
  }

  function setDefaults(next: Filters) {
    onChange({ ...settings, catalogDefaults: next });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full text-white/70" aria-label="Settings">
              <Settings2 />
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent>Settings</TooltipContent>
      </Tooltip>
      <SheetContent
        className="w-full gap-0 border-white/10 bg-[#1a1528] sm:max-w-md"
        onInteractOutside={(event) => {
          const target = event.target as Element | null;
          if (target?.closest?.("[data-slot=combobox-content]")) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          const target = event.target as Element | null;
          if (target?.closest?.("[data-slot=combobox-content], [role=combobox][aria-expanded=true]")) {
            event.preventDefault();
          }
        }}
      >
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle className="font-display text-xl font-bold">Settings</SheetTitle>
          <SheetDescription>Saved in this browser and applied across the whole app.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-8 overflow-y-auto px-6 py-4">
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="font-display text-base font-bold">Hidden rarities</h3>
              <p className="text-sm text-white/60">
                Hidden rarities disappear from the catalog, your lists, search, and every count.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {rarities.map((rarity) => {
                const hidden = settings.hiddenRarities.includes(rarity);
                const last = !hidden && visibleRarities.length === 1;
                return (
                  <button
                    key={rarity}
                    type="button"
                    aria-pressed={hidden}
                    disabled={last}
                    title={last ? "At least one rarity has to stay visible" : undefined}
                    onClick={() => toggleRarity(rarity)}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                      hidden
                        ? "border-white/10 bg-transparent text-white/45 line-through"
                        : "border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.1]",
                    )}
                  >
                    {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    {rarity}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div>
              <h3 className="font-display text-base font-bold">Default catalog filters</h3>
              <p className="text-sm text-white/60">
                Applied whenever you open the catalog without filters in the link.
              </p>
            </div>
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
              {FACETS.map((facet) => (
                <Fragment key={facet.id}>
                  <span className="text-sm font-medium text-white/70">{facet.label}</span>
                  <FacetFilter
                    field
                    label={facet.label}
                    options={options[facet.id]}
                    counts={counts?.[facet.id] ?? new Map()}
                    selected={defaults.facets[facet.id]}
                    onChange={(values) => setDefaults({ ...defaults, facets: { ...defaults.facets, [facet.id]: values } })}
                  />
                </Fragment>
              ))}
              <span className="text-sm font-medium text-white/70">Owned</span>
              {ownedAvailable ? (
                <OwnedToggle
                  value={defaults.owned}
                  disabled={false}
                  onChange={(value) => setDefaults({ ...defaults, owned: value })}
                  className="flex w-full [&>button]:flex-1"
                />
              ) : (
                <p className="text-xs text-white/50">Sign in to set this default.</p>
              )}
            </div>
            {defaultsActive ? (
              <Button
                variant="ghost"
                size="sm"
                className="self-start rounded-full text-white/70"
                onClick={() => setDefaults(NO_FILTERS)}
              >
                <RotateCcw />
                Reset defaults
              </Button>
            ) : null}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface OwnedControls {
  ready: boolean;
  problem: string | null;
  syncHint: string;
  syncing: boolean;
  syncDisabled: boolean;
  onSync: () => void;
}

function FilterBar({
  options,
  counts,
  filters,
  onChange,
  ownedControls,
  shown,
  total,
  query,
  onClearQuery,
  noun = "cards",
}: {
  options: Record<FacetId, string[]>;
  counts: Record<FacetId, Map<string, number>>;
  filters: Filters;
  onChange: (filters: Filters) => void;
  ownedControls: OwnedControls | null;
  shown: number | null;
  total: number;
  query?: string;
  onClearQuery?: () => void;
  noun?: string;
}) {
  const search = query?.trim() ?? "";
  const ownedActive = Boolean(ownedControls?.ready) && filters.owned !== "all";
  const facetsActive = FACETS.some((facet) => filters.facets[facet.id].length > 0);
  const active = Boolean(search) || ownedActive || facetsActive;

  function setFacet(id: FacetId, values: string[]) {
    onChange({ ...filters, facets: { ...filters.facets, [id]: values } });
  }

  function clearAll() {
    onChange(NO_FILTERS);
    onClearQuery?.();
  }

  return (
    <section aria-label="Filters" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-2">
        <span className="hidden items-center gap-1.5 pr-1 pl-2.5 text-sm font-semibold text-white/55 sm:inline-flex">
          <SlidersHorizontal className="size-4" />
          Filter
        </span>
        {FACETS.map((facet) => (
          <FacetFilter
            key={facet.id}
            label={facet.label}
            options={options[facet.id]}
            counts={counts[facet.id]}
            selected={filters.facets[facet.id]}
            onChange={(values) => setFacet(facet.id, values)}
          />
        ))}
        {ownedControls ? (
          <div className="flex items-center gap-1 sm:ml-auto">
            <OwnedToggle
              value={filters.owned}
              disabled={!ownedControls.ready}
              onChange={(value) => onChange({ ...filters, owned: value })}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-white/70"
                  aria-label="Sync collection"
                  disabled={ownedControls.syncDisabled}
                  onClick={ownedControls.onSync}
                >
                  <RefreshCw className={cn(ownedControls.syncing && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{ownedControls.syncHint}</TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </div>
      {ownedControls?.problem ? <p className="px-3 text-xs text-white/55">{ownedControls.problem}</p> : null}
      <div className="flex min-h-7 flex-wrap items-center gap-2 px-1 text-sm">
        <p className="mr-1 text-white/65">
          {shown === null ? (
            "Loading cards…"
          ) : (
            <>
              <span className="font-semibold text-white tabular-nums">{shown.toLocaleString()}</span>
              {active ? ` of ${total.toLocaleString()}` : ""} {noun}
            </>
          )}
        </p>
        {search && onClearQuery ? <FilterChip prefix="Search" label={`“${search}”`} onRemove={onClearQuery} /> : null}
        {ownedActive ? (
          <FilterChip
            label={filters.owned === "owned" ? "Owned" : "Not owned"}
            onRemove={() => onChange({ ...filters, owned: "all" })}
          />
        ) : null}
        {FACETS.flatMap((facet) =>
          filters.facets[facet.id].map((value) => (
            <FilterChip
              key={`${facet.id}:${value}`}
              prefix={facet.label}
              label={value}
              onRemove={() => setFacet(facet.id, filters.facets[facet.id].filter((item) => item !== value))}
            />
          )),
        )}
        {active ? (
          <Button variant="ghost" size="sm" className="ml-auto rounded-full text-white/70" onClick={clearAll}>
            <RotateCcw />
            Clear all
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function ToggleAction({
  active,
  icon: Icon,
  label,
  activeClass,
  addLabel,
  removeLabel,
  onClick,
  disabledReason,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  activeClass: string;
  addLabel: string;
  removeLabel: string;
  onClick: () => void;
  disabledReason?: string | null;
}) {
  const disabled = !active && Boolean(disabledReason);
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? removeLabel : addLabel}
      title={disabled ? disabledReason! : active ? removeLabel : addLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-[34px] min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-[0.8rem] font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
        active ? activeClass : "bg-white/[0.06] text-white/75 enabled:hover:bg-white/[0.11] enabled:hover:text-white",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active && "fill-current")} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function CatalogActions({
  onWishlist,
  onTrade,
  onToggleWishlist,
  onToggleTrade,
  tradeBlockedReason,
}: {
  onWishlist: boolean;
  onTrade: boolean;
  onToggleWishlist: () => void;
  onToggleTrade: () => void;
  tradeBlockedReason: string | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <ToggleAction
        active={onWishlist}
        icon={Heart}
        label="Wishlist"
        activeClass="bg-rose-300 text-rose-950 hover:bg-rose-200"
        addLabel="Add to wishlist"
        removeLabel="Remove from wishlist"
        onClick={onToggleWishlist}
      />
      <ToggleAction
        active={onTrade}
        icon={ArrowLeftRight}
        label="Trade"
        activeClass="bg-sky-300 text-sky-950 hover:bg-sky-200"
        addLabel="Add to For trade"
        removeLabel="Remove from For trade"
        onClick={onToggleTrade}
        disabledReason={tradeBlockedReason}
      />
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-3 rounded-3xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-white/[0.06]">
        <Icon className="size-6 text-white/70" />
      </span>
      <p className="font-display text-xl font-bold">{title}</p>
      <p className="max-w-sm text-sm text-white/60">{children}</p>
      {action}
    </div>
  );
}

function Banner({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-200">{children}</p>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-x-4 gap-y-[22px]">
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className="grid gap-2">
          <Skeleton className="aspect-[2/3] rounded-xl bg-white/[0.06]" />
          <Skeleton className="h-[34px] rounded-full bg-white/[0.05]" />
        </div>
      ))}
    </div>
  );
}

function SectionHeading({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      {meta ? <p className="text-sm text-white/55">{meta}</p> : null}
    </div>
  );
}

function Showcase({ cards }: { cards: Card[] }) {
  if (cards.length < 3) return null;
  const placements = [
    "left-0 top-10 -rotate-[10deg]",
    "left-[118px] top-0 z-10 rotate-[1deg]",
    "left-[236px] top-12 rotate-[11deg]",
  ];
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-10 bottom-3 z-20 hidden h-[330px] w-[416px] origin-bottom-right scale-[0.7] lg:block"
    >
      {cards.slice(0, 3).map((card, index) => (
        <div
          key={cardKey(card)}
          className={cn("absolute w-[180px] drop-shadow-[0_24px_40px_rgba(0,0,0,0.55)]", placements[index])}
        >
          <CardFace card={card} />
        </div>
      ))}
    </div>
  );
}

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-sm font-bold tabular-nums">{value.toLocaleString()}</dd>
      <span aria-hidden="true" className="text-xs text-white/60">
        {label}
      </span>
    </div>
  );
}

export function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [lists, setLists] = useState<Lists>({ forTrade: [], wishlist: [] });
  const [listError, setListError] = useState<string | null>(null);
  const [page, setPage] = useState<Page>(INITIAL_PAGE);
  const [query, setQuery] = useState(INITIAL_URL_STATE.query);
  const [pageFilters, setPageFilters] = useState<Record<Page, Filters>>(INITIAL_PAGE_FILTERS);
  const [settings, setSettings] = useState<Settings>(INITIAL_SETTINGS);
  const [owned, setOwned] = useState<OwnedState>(NO_OWNED);
  const [ownedSyncFailed, setOwnedSyncFailed] = useState(false);
  const [, setSyncTick] = useState(0);
  const [catalogVersion, setCatalogVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/cards", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load cards (${response.status})`);
        return response.json() as Promise<Catalog>;
      })
      .then((data) => {
        setCatalog(data);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Could not load cards");
      });
    return () => controller.abort();
  }, [catalogVersion]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error");
    setAuthError(code ? (AUTH_ERRORS[code] ?? "Discord sign-in failed.") : null);
    const controller = new AbortController();
    fetch("/api/me", { signal: controller.signal })
      .then((response) => response.json() as Promise<{ user: SessionUser | null }>)
      .then((data) => {
        setUser(data.user);
        setUserLoaded(true);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setUser(null);
        setUserLoaded(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onPop = () => {
      const next = pageFromPath(window.location.pathname);
      const state = readUrlState(window.location.search);
      setPage(next);
      setQuery(state.query);
      setPageFilters((current) => ({ ...current, [next]: state.filters }));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const currentFilters = pageFilters[page];
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const search = urlSearchFor(query, currentFilters);
      if (search === window.location.search) return;
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${window.location.hash}`);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [page, query, currentFilters]);

  useEffect(() => {
    if (!user) {
      setLists({ forTrade: [], wishlist: [] });
      return;
    }
    const controller = new AbortController();
    fetch("/api/lists", { signal: controller.signal })
      .then((response) => {
        if (response.status === 401) return { forTrade: [], wishlist: [] };
        if (!response.ok) throw new Error("Could not load your lists");
        return response.json() as Promise<Lists>;
      })
      .then(setLists)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setListError(cause instanceof Error ? cause.message : "Could not load your lists");
      });
    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setOwned(NO_OWNED);
      if (userLoaded) {
        setPageFilters((current) => ({
          catalog: { ...current.catalog, owned: "all" },
          forTrade: { ...current.forTrade, owned: "all" },
          wishlist: { ...current.wishlist, owned: "all" },
        }));
      }
      return;
    }
    if (!user.profile) {
      setOwned({ ...NO_OWNED, status: "unavailable" });
      return;
    }
    setOwned({ ...NO_OWNED, status: "loading" });
    const controller = new AbortController();
    requestOwned("GET", controller.signal)
      .then(({ state, catalogChanged }) => {
        setOwned(state);
        if (catalogChanged) setCatalogVersion((version) => version + 1);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setOwned({ ...NO_OWNED, status: "unavailable" });
      });
    return () => controller.abort();
  }, [user, userLoaded]);

  async function syncOwned() {
    setOwnedSyncFailed(false);
    setOwned((current) => ({ ...current, syncing: true }));
    try {
      const { state, catalogChanged } = await requestOwned("POST");
      setOwned(state);
      if (catalogChanged) setCatalogVersion((version) => version + 1);
    } catch (cause) {
      if (cause instanceof SyncCooldownError) {
        setOwned((current) => ({ ...current, nextSyncAt: cause.nextSyncAt, syncing: false }));
        return;
      }
      setOwned((current) => ({ ...current, syncing: false }));
      setOwnedSyncFailed(true);
    }
  }

  const syncCoolingDown = owned.nextSyncAt !== null && Date.parse(owned.nextSyncAt) > Date.now();

  useEffect(() => {
    if (!owned.nextSyncAt) return;
    const wait = Date.parse(owned.nextSyncAt) - Date.now();
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setSyncTick((tick) => tick + 1), wait + 250);
    return () => window.clearTimeout(timer);
  }, [owned.nextSyncAt]);

  function openPage(next: Page, href: string) {
    if (window.location.pathname !== href) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${urlSearchFor(query, currentFilters)}`);
      window.history.pushState(null, "", `${href}${urlSearchFor("", pageFilters[next])}`);
    }
    setPage(next);
    setQuery("");
    setListError(null);
    window.scrollTo({ top: 0 });
  }

  async function toggle(list: ListName, key: string, present: boolean) {
    if (!user) {
      setListError("Sign in with Discord to edit your lists.");
      return;
    }
    setListError(null);
    const response = await fetch("/api/lists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ list, key, present }),
    });
    if (response.status === 401) {
      setListError("Sign in with Discord to edit your lists.");
      return;
    }
    const data = (await response.json()) as Lists & { error?: string };
    if (!response.ok) {
      setListError(data.error ?? "Could not update that list");
      return;
    }
    setLists(data);
  }

  function clearFilters() {
    setQuery("");
    setPageFilters((current) => ({ ...current, [page]: NO_FILTERS }));
  }

  function setFiltersFor(target: Page, filters: Filters) {
    setPageFilters((current) => ({ ...current, [target]: filters }));
  }

  function updateSettings(next: Settings) {
    const cleaned: Settings = {
      hiddenRarities: next.hiddenRarities,
      catalogDefaults: withoutRarities(next.catalogDefaults, next.hiddenRarities),
    };
    setSettings(cleaned);
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(cleaned));
    setPageFilters((current) => ({
      catalog:
        cleaned.catalogDefaults !== settings.catalogDefaults
          ? cleaned.catalogDefaults
          : withoutRarities(current.catalog, cleaned.hiddenRarities),
      forTrade: withoutRarities(current.forTrade, cleaned.hiddenRarities),
      wishlist: withoutRarities(current.wishlist, cleaned.hiddenRarities),
    }));
  }

  const allRarities = useMemo(
    () => orderedValues((catalog?.cards ?? []).map((card) => card.rank), RANK_ORDER),
    [catalog],
  );
  const cards = useMemo(() => {
    const all = catalog?.cards ?? [];
    const hidden = settings.hiddenRarities;
    return hidden.length > 0 ? all.filter((card) => !hidden.includes(card.rank)) : all;
  }, [catalog, settings.hiddenRarities]);
  const byKey = useMemo(() => new Map(cards.map((card) => [cardKey(card), card])), [cards]);
  const listName: ListName | null = page === "catalog" ? null : page;
  const selectedKeys = listName ? lists[listName] : [];
  const selected = selectedKeys.flatMap((key) => {
    const card = byKey.get(key);
    return card ? [card] : [];
  });
  const needle = query.trim().toLowerCase();
  const catalogOptions = useMemo(() => facetOptionsFor(cards), [cards]);
  const sssCount = useMemo(() => cards.filter((card) => card.rank === "SSS").length, [cards]);
  const showcase = useMemo(() => {
    const pool = cards.filter((card) => card.rank === "SSS" && card.image && (card.border ?? "starry") === "starry");
    if (pool.length < 3) return [];
    return [pool[Math.floor(pool.length * 0.21)], pool[Math.floor(pool.length * 0.47)], pool[Math.floor(pool.length * 0.78)]];
  }, [cards]);
  const filters = pageFilters[page];
  const catalogView = listName ? null : applyFilters(cards, filters, owned, needle);
  const catalogCards = catalogView?.cards ?? [];
  const listView = listName ? applyFilters(selected, filters, owned, "") : null;
  const listOptions = listName ? facetOptionsFor(selected) : null;
  const ownedReady = owned.status === "ready";
  const tradeUnavailableReason = !user
    ? null
    : owned.status === "loading" || owned.status === "idle"
      ? "Loading your KCC collection…"
      : owned.status === "hidden"
        ? "Make your KCC collection public to list cards for trade."
        : owned.status === "unavailable"
          ? "Couldn't read your KCC collection, so cards can't be listed for trade."
          : null;
  const tradeBlockedReasonFor = (card: Card) =>
    tradeUnavailableReason ?? (ownedReady && !isOwned(card, owned) ? "You don't own this card." : null);
  const searchOwnedOnly = listName === "forTrade";
  const matches =
    listName && needle && (!searchOwnedOnly || ownedReady)
      ? cards
          .filter((card) => searchableText(card).includes(needle) && (!searchOwnedOnly || isOwned(card, owned)))
          .slice(0, 24)
      : [];
  const searchHint = listName === "forTrade" ? (tradeUnavailableReason ?? "Only cards in your KCC collection show up here.") : null;
  const tradeKeys = new Set(lists.forTrade);
  const wishKeys = new Set(lists.wishlist);
  const ownedProblem = ownedSyncFailed
    ? "Couldn't sync your KCC collection. Try again in a moment."
    : owned.status === "hidden"
      ? "Your KCC collection is private. Make it public on KCC, then sync again."
      : owned.status === "unavailable"
        ? "Couldn't read your KCC collection, so the Owned filter is off."
        : null;
  const syncHint = owned.syncing
    ? "Syncing your collection from KCC…"
    : owned.status === "loading"
      ? "Loading your collection…"
      : [
          owned.fetchedAt ? `Synced ${formatSyncedAt(owned.fetchedAt)}.` : null,
          syncCoolingDown && owned.nextSyncAt ? `Next sync at ${formatTime(owned.nextSyncAt)}.` : "Sync from KCC now.",
        ]
          .filter(Boolean)
          .join(" ");
  const ownedControls: OwnedControls | null = user?.profile
    ? {
        ready: owned.status === "ready",
        problem: ownedProblem,
        syncHint,
        syncing: owned.syncing,
        syncDisabled: owned.syncing || owned.status === "loading" || syncCoolingDown,
        onSync: syncOwned,
      }
    : null;
  const counts: Record<Page, number | null> = {
    catalog: catalog ? cards.length : null,
    forTrade: user && catalog ? lists.forTrade.filter((key) => byKey.has(key)).length : null,
    wishlist: user && catalog ? lists.wishlist.filter((key) => byKey.has(key)).length : null,
  };

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#151223]/95">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 md:px-8">
          <Brand onOpen={openPage} />
          <NavTabs page={page} counts={counts} onOpen={openPage} className="mx-auto hidden md:flex" />
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <SettingsSheet
              settings={settings}
              onChange={updateSettings}
              rarities={allRarities}
              cards={cards}
              options={catalogOptions}
              owned={owned}
              ownedAvailable={Boolean(user?.profile)}
            />
            {userLoaded ? <AccountMenu user={user} /> : null}
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <NavTabs page={page} counts={counts} onOpen={openPage} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        {authError ? <Banner>{authError}</Banner> : null}
        {error ? <Banner>{error}</Banner> : null}
        {listError ? <Banner>{listError}</Banner> : null}

        {listName ? (
          <ListPage
            list={listName}
            user={user}
            catalogLoaded={catalog !== null}
            selected={selected}
            selectedKeys={selectedKeys}
            visible={listView!.cards}
            filtersActive={filtersAreActive(filters, owned)}
            onClearFilters={() => setFiltersFor(listName, NO_FILTERS)}
            filterBar={
              <FilterBar
                options={listOptions!}
                counts={listView!.counts}
                filters={filters}
                onChange={(next) => setFiltersFor(listName, next)}
                ownedControls={ownedControls}
                shown={listView!.cards.length}
                total={selected.length}
                noun={selected.length === 1 ? "card" : "cards"}
              />
            }
            matches={matches}
            searchHint={searchHint}
            searchOwnedOnly={searchOwnedOnly}
            searchBlocked={searchOwnedOnly && !ownedReady}
            query={query}
            onQuery={setQuery}
            onToggle={toggle}
          />
        ) : (
          <>
            <section className="relative rounded-[1.75rem] border border-white/10 lg:mt-8 bg-[radial-gradient(120%_140%_at_0%_0%,rgba(255,138,190,0.16),transparent_55%),radial-gradient(120%_140%_at_100%_100%,rgba(120,190,255,0.14),transparent_55%),linear-gradient(160deg,#221a37,#151225)] px-5 py-5 md:px-8 md:py-6">
              <div className="relative z-10 max-w-xl">
                <h1 className="font-display text-3xl leading-tight font-extrabold tracking-tight md:text-4xl">
                  Find your next{" "}
                  <span className="bg-gradient-to-r from-amber-200 via-rose-200 to-sky-200 bg-clip-text text-transparent">
                    trade.
                  </span>
                </h1>
                {catalog ? (
                  <dl className="mt-3 flex flex-wrap gap-2">
                    <StatPill value={cards.length} label="cards" />
                    <StatPill value={sssCount} label="SSS" />
                    <StatPill value={catalogOptions.developer.length} label="developers" />
                    <StatPill value={catalogOptions.game.length} label="games" />
                  </dl>
                ) : (
                  <p className="mt-1.5 text-sm text-white/60">Loading the catalog…</p>
                )}
                <div className="mt-4">
                  <SearchField
                    id="catalog-search"
                    label="Search cards"
                    value={query}
                    placeholder="Search by name, variant, game, or developer"
                    onChange={setQuery}
                  />
                </div>
              </div>
              <Showcase cards={showcase} />
            </section>

            <FilterBar
              options={catalogOptions}
              counts={catalogView!.counts}
              filters={filters}
              onChange={(next) => setFiltersFor("catalog", next)}
              ownedControls={ownedControls}
              shown={catalog ? catalogCards.length : null}
              total={cards.length}
              query={query}
              onClearQuery={() => setQuery("")}
            />

            {!catalog && !error ? <GridSkeleton /> : null}
            {catalog && catalogCards.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No cards match"
                action={
                  <Button variant="outline" className="mt-1 rounded-full" onClick={clearFilters}>
                    <RotateCcw />
                    Clear filters
                  </Button>
                }
              >
                Try a different search, or loosen one of the filters.
              </EmptyState>
            ) : null}
            <VirtualGrid
              items={catalogCards}
              actionsHeight={ACTIONS_HEIGHT}
              getKey={cardKey}
              renderItem={(card) => {
                const key = cardKey(card);
                const onWishlist = wishKeys.has(key);
                const onTrade = tradeKeys.has(key);
                return (
                  <>
                    <CardFace card={card} />
                    <CatalogActions
                      onWishlist={onWishlist}
                      onTrade={onTrade}
                      onToggleWishlist={() => toggle("wishlist", key, !onWishlist)}
                      onToggleTrade={() => toggle("forTrade", key, !onTrade)}
                      tradeBlockedReason={tradeBlockedReasonFor(card)}
                    />
                  </>
                );
              }}
            />
          </>
        )}
      </main>

      <footer className="mx-auto w-full max-w-[1400px] px-4 pb-10 text-xs text-white/40 md:px-8">
        Card data and art from Koi Card Collector
        {catalog?.syncedAt ? ` · synced ${formatSyncedAt(catalog.syncedAt)}` : ""}
      </footer>
    </div>
  );
}

function ListPage({
  list,
  user,
  catalogLoaded,
  selected,
  selectedKeys,
  visible,
  filtersActive,
  onClearFilters,
  filterBar,
  matches,
  searchHint,
  searchOwnedOnly,
  searchBlocked,
  query,
  onQuery,
  onToggle,
}: {
  list: ListName;
  user: SessionUser | null;
  catalogLoaded: boolean;
  selected: Card[];
  selectedKeys: string[];
  visible: Card[];
  filtersActive: boolean;
  onClearFilters: () => void;
  filterBar: ReactNode;
  matches: Card[];
  searchHint: string | null;
  searchOwnedOnly: boolean;
  searchBlocked: boolean;
  query: string;
  onQuery: (value: string) => void;
  onToggle: (list: ListName, key: string, present: boolean) => void;
}) {
  const copy = LIST_COPY[list];
  const Icon = copy.icon;
  const searching = query.trim().length > 0;

  return (
    <>
      <section
        className={cn(
          "flex items-center gap-4 rounded-[1.75rem] border border-white/10 px-5 py-4 md:px-8 md:py-5",
          copy.glow,
        )}
      >
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", copy.bubble)}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl leading-tight font-extrabold tracking-tight md:text-3xl">{copy.title}</h1>
          <p className="text-sm text-white/65">{copy.blurb}</p>
        </div>
        {user ? (
          <div className="shrink-0 text-right">
            <p className="font-display text-3xl leading-none font-extrabold tabular-nums">{selected.length}</p>
            <p className="mt-1 text-xs text-white/60">{selected.length === 1 ? "card" : "cards"}</p>
          </div>
        ) : null}
      </section>

      {!user ? (
        <EmptyState
          icon={LogIn}
          title="Sign in to build your list"
          action={
            <Button asChild className="mt-1 rounded-full bg-[#5865f2] text-white hover:bg-[#4752c4]">
              <a href="/auth/discord">
                <LogIn />
                Sign in with Discord
              </a>
            </Button>
          }
        >
          Your lists are tied to your Discord account, so other traders can see what you have and what you want.
        </EmptyState>
      ) : (
        <>
          <section className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
            <SearchField
              id="list-search"
              label="Find cards to add"
              value={query}
              placeholder="Find cards to add by name, game, or developer"
              onChange={onQuery}
            />
            {searchHint ? <p className="-mt-2 px-1 text-xs text-white/50">{searchHint}</p> : null}
            {searching && matches.length > 0 ? (
                <VirtualGrid
                  items={matches}
                  actionsHeight={ACTIONS_HEIGHT}
                  getKey={cardKey}
                  renderItem={(card) => {
                    const key = cardKey(card);
                    const already = selectedKeys.includes(key);
                    return (
                      <>
                        <CardFace card={card} />
                        <Button
                          className="h-[34px] rounded-full"
                          variant={already ? "secondary" : "default"}
                          disabled={already}
                          onClick={() => onToggle(list, key, true)}
                        >
                          {already ? <Check /> : <Plus />}
                          {already ? "On your list" : "Add"}
                        </Button>
                      </>
                    );
                  }}
                />
            ) : null}
            {searching && matches.length === 0 && catalogLoaded && !searchBlocked ? (
              <p className="px-1 text-sm text-white/55">
                {searchOwnedOnly ? "No cards in your collection match" : "No cards match"} “{query.trim()}”.
              </p>
            ) : null}
          </section>

          <SectionHeading title="On your list" />
          {selected.length > 0 ? filterBar : null}
          {selected.length === 0 ? (
            <EmptyState icon={Icon} title="Nothing here yet">
              {copy.empty}
            </EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No cards on this list match"
              action={
                filtersActive ? (
                  <Button variant="outline" className="mt-1 rounded-full" onClick={onClearFilters}>
                    <RotateCcw />
                    Clear filters
                  </Button>
                ) : undefined
              }
            >
              Loosen one of the filters to see the rest of your list.
            </EmptyState>
          ) : (
            <VirtualGrid
              items={visible}
              actionsHeight={ACTIONS_HEIGHT}
              getKey={cardKey}
              renderItem={(card) => (
                <>
                  <CardFace card={card} />
                  <Button
                    variant="ghost"
                    className="h-[34px] rounded-full bg-white/[0.06] text-white/75 hover:bg-white/[0.11]"
                    onClick={() => onToggle(list, cardKey(card), false)}
                  >
                    <X />
                    Remove
                  </Button>
                </>
              )}
            />
          )}
        </>
      )}
    </>
  );
}
