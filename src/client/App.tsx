import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cardKey, type Card, type Catalog } from "../types.ts";
import { VirtualGrid } from "./VirtualGrid.tsx";
import { type SessionUser, type Lists, type ListSync, type ListName, type Page, type ListChange, NO_LISTS, LIST_SAVE_DELAY, withChanges, type TradeMatch, type TradesState, type OwnedState, type Filters, NO_FILTERS, NO_PAGE_FILTERS, type Settings, SETTINGS_KEY, loadSettings, withoutRarities, NO_OWNED, SyncCooldownError, requestOwned, formatTime, VISIT_SYNC_MS, isOwned, isDuplicate, duplicateCount, cardsInCatalogOrder, priorityFirst, byName, newestFirst, mostDesired, type CatalogSort, RANK_ORDER, AUTH_ERRORS, ACTIONS_HEIGHT, pageFromPath, profileIdFromPath, readUrlState, urlSearchFor, urlHasFilters, tradeViewFromPath, tradeViewHref, type TradeView, searchableText, orderedValues, facetOptionsFor, filtersAreActive, applyFilters, seenTradesKey, tradeSignature, readSeenTrades } from "./model.ts";
import { CardFace } from "./components/cards.tsx";
import { formatSyncedAt, Brand, NavTabs, AccountMenu, HelpButton, TraderSearch } from "./components/header.tsx";
import { SearchField, type OwnedControls, FilterBar, CatalogActions } from "./components/controls.tsx";
import { SettingsSheet } from "./components/SettingsSheet.tsx";
import { EmptyState, Banner, GridSkeleton, Showcase, StatPill, WelcomeDialog } from "./components/common.tsx";
import { ProfilePage } from "./pages/ProfilePage.tsx";
import { TradesPage } from "./pages/TradesPage.tsx";
import { ListPage } from "./pages/ListPage.tsx";
import { HelpPage } from "./pages/HelpPage.tsx";
import { FeatureDialog } from "./components/FeatureDialog.tsx";
import { FEATURES, SEEN_FEATURE_KEY, unseenFeatures } from "./features.ts";

const INITIAL_PAGE = pageFromPath(window.location.pathname);
const INITIAL_URL_STATE = readUrlState(window.location.search);
const INITIAL_SETTINGS = loadSettings();

function matchSignature(match: { trader: { id: string }; theyHave: Card[]; theyWant: Card[] }): string {
  return tradeSignature(match.trader.id, match.theyHave.map(cardKey), match.theyWant.map(cardKey));
}
const INITIAL_PAGE_FILTERS: Record<Page, Filters> = {
  ...NO_PAGE_FILTERS,
  catalog: INITIAL_SETTINGS.catalogDefaults,
  ...(INITIAL_PAGE !== "catalog" || urlHasFilters(window.location.search)
    ? { [INITIAL_PAGE]: INITIAL_URL_STATE.filters }
    : {}),
};

export function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogSort, setCatalogSort] = useState<CatalogSort>("rarity");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [lists, setLists] = useState<Lists>(NO_LISTS);
  const savedLists = useRef<Lists>(NO_LISTS);
  const pendingChanges = useRef<ListChange[]>([]);
  const savingLists = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const [listsSaved, setListsSaved] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [listsReady, setListsReady] = useState(false);
  const [featureNotes, setFeatureNotes] = useState(() => unseenFeatures(window.localStorage.getItem(SEEN_FEATURE_KEY)));
  const [replayFeatures, setReplayFeatures] = useState(false);
  const [page, setPage] = useState<Page>(INITIAL_PAGE);
  const [tradeView, setTradeView] = useState<TradeView>(() => tradeViewFromPath(window.location.pathname));
  const [profileId, setProfileId] = useState(() => profileIdFromPath(window.location.pathname));
  const [query, setQuery] = useState(INITIAL_URL_STATE.query);
  const [pageFilters, setPageFilters] = useState<Record<Page, Filters>>(INITIAL_PAGE_FILTERS);
  const [settings, setSettings] = useState<Settings>(INITIAL_SETTINGS);
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute("data-no-card-effects", !settings.cardEffects);
  }, [settings.cardEffects]);
  const [owned, setOwned] = useState<OwnedState>(NO_OWNED);
  const [ownedSyncFailed, setOwnedSyncFailed] = useState(false);
  const [, setSyncTick] = useState(0);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [trades, setTrades] = useState<TradesState>({ status: "idle", matches: [], demand: {} });
  const [tradesVersion, setTradesVersion] = useState(0);
  const [seenTrades, setSeenTrades] = useState<Set<string>>(new Set());

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
      setTradeView(tradeViewFromPath(window.location.pathname));
      setProfileId(profileIdFromPath(window.location.pathname));
      setQuery(state.query);
      setPageFilters((current) => ({ ...current, [next]: state.filters }));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const currentFilters = pageFilters[page];
  useEffect(() => {
    if (pageFilters.forTrade.owned === "all" || pageFilters.forTrade.owned === "duplicates") return;
    setPageFilters((current) => ({ ...current, forTrade: { ...current.forTrade, owned: "all" } }));
  }, [pageFilters.forTrade.owned]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const search = urlSearchFor(query, currentFilters);
      if (search === window.location.search) return;
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${window.location.hash}`);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [page, query, currentFilters]);

  useEffect(() => {
    pendingChanges.current = [];
    savedLists.current = NO_LISTS;
    if (!userLoaded) return;
    if (!user) {
      setLists(NO_LISTS);
      setListsReady(true);
      return;
    }
    setListsReady(false);
    const controller = new AbortController();
    fetch("/api/lists", { signal: controller.signal })
      .then((response) => {
        if (response.status === 401) return NO_LISTS;
        if (!response.ok) throw new Error("Could not load your lists");
        return response.json() as Promise<Lists>;
      })
      .then(receiveLists)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setListError(cause instanceof Error ? cause.message : "Could not load your lists");
      })
      .finally(() => {
        if (!controller.signal.aborted) setListsReady(true);
      });
    return () => controller.abort();
  }, [user?.id, userLoaded]);

  useEffect(() => {
    if (!user) {
      setOwned(NO_OWNED);
      if (userLoaded) {
        setPageFilters((current) => ({
          ...current,
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
      .then(({ state, catalogChanged, listSync }) => {
        if (controller.signal.aborted) return;
        setOwned(state);
        if (catalogChanged) setCatalogVersion((version) => version + 1);
        applyListSync(listSync);
        const fetched = state.fetchedAt ? Date.parse(state.fetchedAt) : NaN;
        if (!Number.isFinite(fetched) || Date.now() - fetched >= VISIT_SYNC_MS) void syncOwned();
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setOwned({ ...NO_OWNED, status: "unavailable" });
      });
    return () => controller.abort();
  }, [user?.id, userLoaded]);

  useEffect(() => {
    if (!user) {
      setTrades({ status: "idle", matches: [], demand: {} });
      setSeenTrades(new Set());
      return;
    }
    setSeenTrades(readSeenTrades(user.id));
    setTrades((current) => (current.status === "ready" ? current : { ...current, status: "loading" }));
    const controller = new AbortController();
    fetch("/api/trades", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Could not find trades");
        return response.json() as Promise<{ matches: TradeMatch[]; demand?: Record<string, number> }>;
      })
      .then((data) => setTrades({ status: "ready", matches: data.matches, demand: data.demand ?? {} }))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setTrades((current) => ({ ...current, status: "error" }));
      });
    return () => controller.abort();
  }, [user?.id, listsSaved, tradesVersion]);

  async function syncOwned(force = false) {
    setOwnedSyncFailed(false);
    setOwned((current) => ({ ...current, syncing: true }));
    try {
      const { state, catalogChanged, listSync, user: refreshed } = await requestOwned("POST", undefined, force);
      setOwned(state);
      if (refreshed) setUser(refreshed);
      if (catalogChanged) setCatalogVersion((version) => version + 1);
      applyListSync(listSync);
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
    setTradeView(tradeViewFromPath(href));
    setProfileId(profileIdFromPath(href));
    setQuery("");
    setListError(null);
    setNotice(null);
    window.scrollTo({ top: 0 });
  }

  function openTradeView(next: TradeView) {
    const href = tradeViewHref(next);
    if (window.location.pathname !== href) {
      window.history.pushState(null, "", `${href}${window.location.search}${window.location.hash}`);
    }
    setTradeView(next);
  }

  function receiveLists(data: Lists & { welcome?: boolean }) {
    const { welcome, ...lists } = data;
    savedLists.current = lists;
    setLists(withChanges(lists, pendingChanges.current));
    if (welcome) {
      const latest = FEATURES.at(-1);
      if (latest) window.localStorage.setItem(SEEN_FEATURE_KEY, latest.id);
      setFeatureNotes([]);
      setWelcomeOpen(true);
    }
  }

  function dismissWelcome() {
    setWelcomeOpen(false);
    void fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ introduced: true }),
    });
  }

  function confirmProfilePublic() {
    dismissWelcome();
    void syncOwned(true);
  }

  function dismissFeatures() {
    const latest = FEATURES.at(-1);
    if (latest) window.localStorage.setItem(SEEN_FEATURE_KEY, latest.id);
    setFeatureNotes([]);
    setReplayFeatures(false);
  }

  function disableFeatures() {
    dismissFeatures();
    updateSettings({ ...settings, featureNotes: false });
  }

  function applyListSync(sync: ListSync | null | undefined) {
    if (!sync) return;
    const { removed, unlisted, added } = sync;
    if (removed.forTrade.length + removed.wishlist.length + unlisted.length + added.length === 0) return;
    const goneForTrade = new Set([...removed.forTrade, ...unlisted]);
    const goneWishlist = new Set(removed.wishlist);
    const saved = savedLists.current;
    const keptForTrade = saved.forTrade.filter((key) => !goneForTrade.has(key));
    receiveLists({
      ...saved,
      forTrade: [...added.filter((key) => !keptForTrade.includes(key)), ...keptForTrade],
      wishlist: saved.wishlist.filter((key) => !goneWishlist.has(key)),
      priority: (saved.priority ?? []).filter((key) => !goneWishlist.has(key)),
    });
    setListsSaved((version) => version + 1);

    const cards = (count: number) => (count === 1 ? "1 card" : `${count} cards`);
    const sentences = [];
    if (added.length > 0) {
      sentences.push(
        added.length === 1 ? "Listed 1 duplicate for trade." : `Listed ${added.length} duplicates for trade.`,
      );
    }
    const removals = [
      removed.forTrade.length > 0
        ? `${cards(removed.forTrade.length)} from For trade that ${removed.forTrade.length === 1 ? "isn't" : "aren't"} in your KCC collection anymore`
        : null,
      unlisted.length > 0
        ? `${cards(unlisted.length)} from For trade that ${unlisted.length === 1 ? "isn't a duplicate" : "aren't duplicates"} anymore`
        : null,
      removed.wishlist.length > 0 ? `${cards(removed.wishlist.length)} from your Wishlist that you now own` : null,
    ].filter(Boolean);
    if (removals.length > 0) sentences.push(`Removed ${removals.join(", and ")}.`);
    setNotice(sentences.join(" "));
  }

  function queueChange(change: ListChange) {
    if (!user) {
      setListError("Sign in with Discord to edit your lists.");
      return;
    }
    setListError(null);
    pendingChanges.current = [
      ...pendingChanges.current.filter((item) => item.list !== change.list || item.key !== change.key),
      change,
    ];
    setLists((current) => withChanges(current, [change]));
    scheduleListSave();
  }

  function toggle(list: ListName, key: string, present: boolean, auto = false) {
    queueChange({ list, key, present, ...(auto ? { auto: true } : {}) });
  }

  function setPriority(key: string, priority: boolean) {
    queueChange({ list: "wishlist", key, present: true, priority });
  }

  function scheduleListSave() {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void saveLists(false), LIST_SAVE_DELAY);
  }

  async function saveLists(keepalive: boolean) {
    if (pendingChanges.current.length === 0) return;
    if (savingLists.current) {
      if (!keepalive) scheduleListSave();
      return;
    }
    window.clearTimeout(saveTimer.current);
    const changes = pendingChanges.current;
    pendingChanges.current = [];
    savingLists.current = true;
    try {
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ changes }),
        keepalive,
      });
      if (response.status === 401) {
        setListError("Sign in with Discord to edit your lists.");
        return;
      }
      const data = (await response.json()) as Lists & { error?: string; rejected?: string };
      if (!response.ok) {
        setListError(data.error ?? "Couldn't save your list changes.");
        return;
      }
      if (data.rejected) setListError(data.rejected);
      savedLists.current = data;
      setListsSaved((version) => version + 1);
    } catch {
      setListError("Couldn't save your list changes. Check your connection and try again.");
    } finally {
      savingLists.current = false;
      setLists(withChanges(savedLists.current, pendingChanges.current));
    }
  }

  useEffect(() => {
    const flush = () => void saveLists(true);
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", flushWhenHidden);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flushWhenHidden);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  async function savePreference(preference: Partial<Pick<Lists, "accepting" | "pruneWishlist" | "listDuplicates">>) {
    const previous = {
      accepting: lists.accepting,
      pruneWishlist: lists.pruneWishlist,
      listDuplicates: lists.listDuplicates,
    };
    setLists((current) => ({ ...current, ...preference }));
    const response = await fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(preference),
    }).catch(() => null);
    if (!response?.ok) {
      setLists((current) => ({ ...current, ...previous }));
      setListError("Couldn't save that setting. Try again in a moment.");
      return;
    }
    const data = (await response.json()) as Lists & { listSync?: ListSync };
    receiveLists(data);
    applyListSync(data.listSync);
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
      cardEffects: next.cardEffects,
      featureNotes: next.featureNotes,
      wishlistMarks: next.wishlistMarks,
    };
    setSettings(cleaned);
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(cleaned));
    setPageFilters((current) => ({
      ...current,
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
  const sortedCatalog = useMemo(
    () =>
      [...(catalog?.cards ?? [])].sort(
        (a, b) =>
          RANK_ORDER.indexOf(b.rank) - RANK_ORDER.indexOf(a.rank) ||
          a.name.localeCompare(b.name) ||
          (a.variantName ?? "").localeCompare(b.variantName ?? ""),
      ),
    [catalog],
  );
  const cards = useMemo(() => {
    const hidden = settings.hiddenRarities;
    return hidden.length > 0 ? sortedCatalog.filter((card) => !hidden.includes(card.rank)) : sortedCatalog;
  }, [sortedCatalog, settings.hiddenRarities]);
  const byKey = useMemo(() => new Map(cards.map((card) => [cardKey(card), card])), [cards]);
  const listName: ListName | null = page === "forTrade" || page === "wishlist" ? page : null;
  const selectedKeys = listName ? lists[listName] : [];
  const priorityKeys = new Set(lists.priority ?? []);
  const selected = priorityFirst(
    cardsInCatalogOrder(selectedKeys, byKey),
    listName === "wishlist" ? priorityKeys : new Set(),
  );
  const needle = query.trim().toLowerCase();
  const catalogOptions = useMemo(() => facetOptionsFor(cards), [cards]);
  const heroStats = useMemo(() => {
    const options = facetOptionsFor(sortedCatalog);
    return {
      cards: sortedCatalog.length,
      sss: sortedCatalog.filter((card) => card.rank === "SSS").length,
      developers: options.developer.length,
      games: options.game.length,
    };
  }, [sortedCatalog]);
  const showcase = useMemo(() => {
    const pool = (catalog?.cards ?? []).filter((card) => card.rank === "SSS" && card.image);
    if (pool.length < 3) return [];
    for (let index = pool.length - 1; index > pool.length - 4; index--) {
      const pick = Math.floor(Math.random() * (index + 1));
      [pool[index], pool[pick]] = [pool[pick], pool[index]];
    }
    return pool.slice(-3);
  }, [catalog]);
  const filters = pageFilters[page];
  const listFilters =
    listName === "forTrade" && filters.owned !== "duplicates" ? { ...filters, owned: "all" as const } : filters;
  const catalogView = listName ? null : applyFilters(cards, filters, owned, needle);
  const filteredCatalog = catalogView?.cards ?? [];
  const listView = listName ? applyFilters(selected, listFilters, owned, "") : null;
  const listOptions = listName ? facetOptionsFor(selected) : null;
  const ownedReady = owned.status === "ready";
  const unlistedDuplicates = useMemo(() => {
    if (page !== "forTrade" || !ownedReady) return [];
    const listed = new Set(lists.forTrade);
    return cards.filter((card) => isDuplicate(card, owned) && !listed.has(cardKey(card)));
  }, [page, ownedReady, owned, cards, lists.forTrade]);
  const needsPublicProfile = Boolean(
    user &&
      owned.status !== "ready" &&
      (owned.status === "hidden" || !user.profile || user.profile.publicCollection === false),
  );
  const publicProfileMessage = "Make your KCC profile public if you want your collection to sync.";
  const tradeUnavailableReason = !user
    ? null
    : owned.status === "loading" || owned.status === "idle"
      ? "Loading your KCC collection…"
      : needsPublicProfile
        ? publicProfileMessage
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
  const searchHint = listName === "forTrade" ? tradeUnavailableReason : null;
  const tradeKeys = new Set(lists.forTrade);
  const wishKeys = new Set(lists.wishlist);
  const ownedProblem = ownedSyncFailed
    ? "Couldn't sync your KCC collection. Try again in a moment."
    : needsPublicProfile
      ? null
      : owned.status === "unavailable"
        ? "Couldn't read your KCC collection, so the Owned filter is off."
        : null;
  const syncHint = owned.syncing
    ? "Syncing your collection from KCC…"
    : owned.status === "loading"
      ? "Loading your collection…"
      : [
          owned.fetchedAt ? `Synced ${formatSyncedAt(owned.fetchedAt)}.` : null,
          syncCoolingDown && owned.nextSyncAt
            ? `Next sync at ${formatTime(owned.nextSyncAt)}.`
            : needsPublicProfile
              ? publicProfileMessage
              : "Sync from KCC now.",
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
        onSync: () => void syncOwned(),
      }
    : null;
  const counts: Record<Page, number | null> = {
    catalog: catalog ? cards.length : null,
    forTrade: user && catalog ? lists.forTrade.filter((key) => byKey.has(key)).length : null,
    wishlist: user && catalog ? lists.wishlist.filter((key) => byKey.has(key)).length : null,
    trades: null,
    profile: null,
    help: null,
  };
  const tradeMatches = useMemo(
    () =>
      trades.matches.flatMap((match) => {
        const priority = new Set(match.priority ?? []);
        const theyHave = priorityFirst(cardsInCatalogOrder(match.theyHave, byKey), priority);
        const theyWant = priorityFirst(cardsInCatalogOrder(match.theyWant, byKey), priority);
        return theyHave.length > 0 || theyWant.length > 0 ? [{ trader: match.trader, theyHave, theyWant, priority }] : [];
      }),
    [trades.matches, byKey],
  );
  const wantedBy = useMemo(() => {
    const counts = new Map<string, number>();
    if (trades.status !== "ready") return counts;
    for (const [key, count] of Object.entries(trades.demand)) if (count > 0) counts.set(key, count);
    return counts;
  }, [trades.status, trades.demand]);
  const catalogCards =
    catalogSort === "added"
      ? newestFirst(filteredCatalog)
      : catalogSort === "name"
        ? byName(filteredCatalog)
        : catalogSort === "desired"
          ? mostDesired(filteredCatalog, wantedBy)
          : filteredCatalog;
  const mutualMatches = useMemo(
    () => tradeMatches.filter((match) => match.theyHave.length > 0 && match.theyWant.length > 0),
    [tradeMatches],
  );
  useEffect(() => {
    if (!user || page !== "trades" || trades.status !== "ready" || !catalog) return;
    const next = mutualMatches.map(matchSignature);
    setSeenTrades((current) => {
      if (current.size === next.length && next.every((item) => current.has(item))) return current;
      window.localStorage.setItem(seenTradesKey(user.id), JSON.stringify(next));
      return new Set(next);
    });
  }, [user?.id, page, trades.status, catalog, mutualMatches]);
  if (trades.status === "ready" && catalog) counts.trades = mutualMatches.length;
  const tradeAttention = page !== "trades" && mutualMatches.some((match) => !seenTrades.has(matchSignature(match)));

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#151223]/95">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 md:px-8">
          <Brand onOpen={openPage} />
          <NavTabs page={page} counts={counts} attention={{ trades: tradeAttention }} onOpen={openPage} className="mx-auto hidden lg:flex" />
          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <TraderSearch onOpen={openPage} />
            <HelpButton onOpen={openPage} />
            <SettingsSheet
              settings={settings}
              onChange={updateSettings}
              rarities={allRarities}
              cards={cards}
              options={catalogOptions}
              owned={owned}
              ownedAvailable={Boolean(user?.profile)}
              accepting={user ? lists.accepting !== false : null}
              onAcceptingChange={(accepting) => void savePreference({ accepting })}
              pruneWishlist={user ? lists.pruneWishlist !== false : null}
              onPruneWishlistChange={(pruneWishlist) => void savePreference({ pruneWishlist })}
              listDuplicates={user ? lists.listDuplicates === true : null}
              onListDuplicatesChange={(listDuplicates) => void savePreference({ listDuplicates })}
              signedIn={user !== null}
              onShowFeatures={() => setReplayFeatures(true)}
            />
            {userLoaded ? <AccountMenu user={user} privateProfile={needsPublicProfile} onOpen={openPage} /> : null}
          </div>
        </div>
        <div className="hidden px-4 pb-3 sm:block lg:hidden">
          <NavTabs page={page} counts={counts} attention={{ trades: tradeAttention }} onOpen={openPage} />
        </div>
      </header>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#151223]/95 px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] sm:hidden">
        <NavTabs
          page={page}
          counts={counts}
          attention={{ trades: tradeAttention }}
          onOpen={openPage}
          stacked
          className="rounded-none border-0 bg-transparent p-0"
        />
      </div>

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        {authError ? <Banner>{authError}</Banner> : null}
        {error ? <Banner>{error}</Banner> : null}
        {listError ? <Banner onDismiss={() => setListError(null)}>{listError}</Banner> : null}
        {notice ? (
          <Banner tone="info" onDismiss={() => setNotice(null)}>
            {notice}
          </Banner>
        ) : null}
        {needsPublicProfile && !welcomeOpen ? (
          <Banner tone="info">
            {publicProfileMessage}{" "}
            <button
              type="button"
              onClick={() => setWelcomeOpen(true)}
              className="font-semibold underline decoration-sky-100/50 underline-offset-2 outline-none hover:decoration-sky-100 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Show me how
            </button>
          </Banner>
        ) : null}
        <WelcomeDialog
          open={welcomeOpen}
          onDismiss={dismissWelcome}
          onConfirm={confirmProfilePublic}
          profileHref={`https://koi-card-collector.com/profile/${user?.id ?? ""}`}
        />
        <FeatureDialog
          key={replayFeatures ? "replay" : "auto"}
          open={
            Boolean(user) &&
            listsReady &&
            !welcomeOpen &&
            (replayFeatures || (settings.featureNotes && featureNotes.length > 0))
          }
          notes={replayFeatures ? [...FEATURES].reverse() : featureNotes}
          onDismiss={dismissFeatures}
          onDisable={disableFeatures}
        />

        {page === "help" ? (
          <HelpPage onOpen={openPage} />
        ) : page === "profile" && profileId ? (
          <ProfilePage
            key={profileId}
            profileId={profileId}
            user={user}
            byKey={byKey}
            catalogLoaded={catalog !== null}
            myWishlist={wishKeys}
            myForTrade={tradeKeys}
            myPriority={priorityKeys}
            filters={pageFilters.profile}
            onFiltersChange={(next) => setFiltersFor("profile", next)}
            owned={owned}
            ownedControls={ownedControls}
            myAccepting={lists.accepting !== false}
          />
        ) : page === "trades" ? (
          <TradesPage
            user={user}
            loading={trades.status === "loading" || trades.status === "idle" || !catalog}
            failed={trades.status === "error"}
            matches={tradeMatches}
            needsBothLists={lists.forTrade.length === 0 && lists.wishlist.length === 0}
            wishlistEmpty={lists.wishlist.length === 0}
            forTradeEmpty={lists.forTrade.length === 0}
            onRetry={() => setTradesVersion((version) => version + 1)}
            onOpen={openPage}
            accepting={lists.accepting !== false}
            owned={owned}
            view={tradeView}
            onView={openTradeView}
          />
        ) : listName ? (
          <ListPage
            list={listName}
            user={user}
            catalogLoaded={catalog !== null}
            selected={selected}
            selectedKeys={selectedKeys}
            visible={listView!.cards}
            filtersActive={filtersAreActive(listFilters, owned)}
            onClearFilters={() => setFiltersFor(listName, NO_FILTERS)}
            filterBar={
              <FilterBar
                options={listOptions!}
                counts={listView!.counts}
                filters={listFilters}
                onChange={(next) => setFiltersFor(listName, next)}
                ownedControls={ownedControls}
                ownedChoices={listName === "forTrade" ? ["all", "duplicates"] : undefined}
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
            priority={priorityKeys}
            onPriority={setPriority}
            unlistedDuplicates={unlistedDuplicates}
            owned={owned}
            wanted={settings.wishlistMarks ? wantedBy : undefined}
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
                    <StatPill value={heroStats.cards} label="cards" />
                    <StatPill value={heroStats.sss} label="SSS" />
                    <StatPill value={heroStats.developers} label="developers" />
                    <StatPill value={heroStats.games} label="games" />
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
              sort={catalogSort}
              onSort={(next) => {
                if (next === catalogSort) return;
                setCatalogSort(next);
                window.scrollTo({ top: 0 });
              }}
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
                    <CardFace
                      card={card}
                      copies={duplicateCount(card, owned)}
                      priority={onWishlist && priorityKeys.has(key)}
                      wanted={settings.wishlistMarks ? (wantedBy.get(key) ?? 0) : 0}
                      onPriority={() => setPriority(key, !(onWishlist && priorityKeys.has(key)))}
                    />
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

      <footer className="mx-auto flex w-full max-w-[1400px] flex-col gap-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] text-xs text-white/40 sm:pb-10 md:px-8">
        <p>
          Card data and art from Koi Card Collector
          {catalog?.syncedAt ? ` · synced ${formatSyncedAt(catalog.syncedAt)}` : ""}
        </p>
        <p>
          <a
            href="/help"
            onClick={(event) => {
              event.preventDefault();
              openPage("help", "/help");
            }}
            className="text-white/60 underline-offset-2 hover:text-white hover:underline"
          >
            Help
          </a>
          {" · "}
          Found a bug? Message{" "}
          <a
            href="https://discord.com/users/204699700316602369"
            target="_blank"
            rel="noreferrer"
            className="text-white/60 underline-offset-2 hover:text-white hover:underline"
          >
            @atrx
          </a>{" "}
          on Discord.
        </p>
      </footer>
    </div>
  );
}
