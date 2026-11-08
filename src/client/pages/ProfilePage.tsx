import { useEffect, useState } from "react";
import { ArrowLeftRight, ChevronDown, ExternalLink, Heart, SearchX, Star, type LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { cardKey, type Card } from "../../types.ts";
import { type SessionUser, type Lists, type Trader, INACTIVE_AFTER_DAYS, daysSince, lastSeenLabel, type OwnedState, type Filters, kccTradeUrl, cardsInCatalogOrder, priorityFirst, duplicateCount, isOwned, facetOptionsFor, filtersAreActive, applyFilters } from "../model.ts";
import { VirtualGrid } from "../VirtualGrid.tsx";
import { CardFace } from "../components/cards.tsx";
import { type OwnedControls, FilterBar } from "../components/controls.tsx";
import { EmptyState, GridSkeleton, ShareListsButton } from "../components/common.tsx";

export interface PublicLists extends Lists {
  trader: Trader;
}

export function ProfileSection({
  id,
  title,
  icon: Icon,
  tone,
  open,
  onToggle,
  cards,
  highlight,
  highlightLabel,
  priority,
  empty,
  owned,
  ownedMarks,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  tone: string;
  open: boolean;
  onToggle: () => void;
  cards: Card[];
  highlight: Set<string>;
  highlightLabel: string;
  priority?: Set<string>;
  empty: string;
  owned: OwnedState;
  ownedMarks: boolean;
}) {
  const count = `${cards.length.toLocaleString()} ${cards.length === 1 ? "card" : "cards"}`;
  return (
    <section id={id} className="scroll-mt-32 grid gap-4 sm:scroll-mt-[11.5rem] lg:scroll-mt-32">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex min-w-0 items-center gap-2 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronDown className={cn("size-5 shrink-0 text-white/50 transition-transform", !open && "-rotate-90")} />
          <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
        </button>
        <p className="inline-flex items-center gap-1.5 text-sm text-white/55">
          <Icon className={cn("size-4", tone)} />
          {count}
        </p>
      </div>
      {!open ? null : cards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/12 px-4 py-6 text-center text-sm text-white/50">{empty}</p>
      ) : (
        <VirtualGrid
          items={cards}
          actionsHeight={0}
          getKey={cardKey}
          renderItem={(card) => {
            const key = cardKey(card);
            return (
              <>
                <CardFace card={card} copies={duplicateCount(card, owned)} owned={ownedMarks && isOwned(card, owned)} priority={priority?.has(key)} />
                {highlight.has(key) ? (
                  <span className="self-center rounded-full bg-emerald-300/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-200">
                    {highlightLabel}
                  </span>
                ) : null}
              </>
            );
          }}
        />
      )}
    </section>
  );
}

export function ProfilePage({
  profileId,
  user,
  byKey,
  catalogLoaded,
  myWishlist,
  myForTrade,
  myPriority,
  filters,
  onFiltersChange,
  owned,
  ownedMarks,
  ownedControls,
  myAccepting,
}: {
  myAccepting: boolean;
  profileId: string;
  user: SessionUser | null;
  byKey: Map<string, Card>;
  catalogLoaded: boolean;
  myWishlist: Set<string>;
  myForTrade: Set<string>;
  myPriority: Set<string>;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  owned: OwnedState;
  ownedMarks: boolean;
  ownedControls: OwnedControls | null;
}) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "missing" | "error"; lists: PublicLists | null }>({
    status: "loading",
    lists: null,
  });
  const [openSections, setOpenSections] = useState({ "for-trade": true, wishlist: true });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/traders/${profileId}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) return setState({ status: "missing", lists: null });
        if (!response.ok) throw new Error("Could not load lists");
        setState({ status: "ready", lists: (await response.json()) as PublicLists });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setState({ status: "error", lists: null });
      });
    return () => controller.abort();
  }, [profileId]);

  useEffect(() => {
    if (state.status !== "loading") {
      document.title = state.lists
        ? `${state.lists.trader.name} · KCC Trader`
        : state.status === "missing"
          ? "No lists here · KCC Trader"
          : "KCC Trader";
    }
    return () => {
      document.title = "KCC Trader";
    };
  }, [state]);

  if (state.status === "missing" || state.status === "error") {
    return (
      <EmptyState icon={SearchX} title={state.status === "missing" ? "No lists here" : "Couldn't load these lists"}>
        {state.status === "missing"
          ? "This trader hasn't shared any lists on KCC Trader yet."
          : "Something went wrong. Try again in a moment."}
      </EmptyState>
    );
  }

  if (!state.lists || !catalogLoaded) {
    return (
      <>
        <Skeleton className="h-[92px] rounded-[1.75rem] bg-white/[0.05]" />
        <GridSkeleton />
      </>
    );
  }

  const { trader } = state.lists;
  const own = user?.id === trader.id;
  const accepting = own ? myAccepting : state.lists.accepting !== false;
  const lastSeen = own ? null : lastSeenLabel(trader.lastSeenAt);
  const inactive = !own && trader.lastSeenAt != null && daysSince(trader.lastSeenAt) >= INACTIVE_AFTER_DAYS;
  const forTrade = cardsInCatalogOrder(state.lists.forTrade, byKey);
  const priority = own ? myPriority : new Set(state.lists.priority ?? []);
  const wishlist = priorityFirst(cardsInCatalogOrder(state.lists.wishlist, byKey), priority);
  const combined = [...new Set([...forTrade, ...wishlist])];
  const view = applyFilters(combined, filters, owned, "");
  const passing = new Set(view.cards);
  const filtering = filtersAreActive(filters, owned);
  const forTradeCards = forTrade.filter((card) => passing.has(card));
  const wishlistCards = wishlist.filter((card) => passing.has(card));
  const theyHave = own ? [] : forTrade.filter((card) => myWishlist.has(cardKey(card)));
  const theyWant = own ? [] : wishlist.filter((card) => myForTrade.has(cardKey(card)));
  const priorityTheyWant = theyWant.filter((card) => priority.has(cardKey(card))).length;

  function showSection(id: "for-trade" | "wishlist") {
    setOpenSections((current) => ({ ...current, [id]: true }));
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return (
    <>
      <section className="flex flex-wrap items-center gap-4 rounded-[1.75rem] border border-white/10 bg-[radial-gradient(110%_130%_at_0%_0%,rgba(243,213,143,0.16),transparent_55%),linear-gradient(160deg,#221a37,#141224)] px-5 py-4 md:px-8 md:py-5">
        <Avatar className="size-14 ring-2 ring-amber-200/40 ring-offset-2 ring-offset-[#1c1730]">
          <AvatarImage src={trader.avatarUrl} alt="" />
          <AvatarFallback>{trader.name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-2xl leading-tight font-extrabold tracking-tight md:text-3xl">
            <span className="truncate">{trader.name}</span>
            {accepting ? null : (
              <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 font-sans text-xs font-semibold tracking-normal text-white/70">
                Not accepting trades
              </span>
            )}
            {accepting && inactive ? (
              <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 font-sans text-xs font-semibold tracking-normal text-white/70">
                Inactive
              </span>
            ) : null}
          </h1>
          <p className="truncate text-sm text-white/60">
            @{trader.username}
            {trader.kccName ? ` · ${trader.kccName} on KCC` : ""}
            {lastSeen ? ` · ${lastSeen}` : ""}
          </p>
          {own || !user ? null : theyHave.length === 0 && theyWant.length === 0 ? (
            <p className="mt-1.5 text-sm text-white/50">Nothing lines up with your lists.</p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="With your lists">
              <OverlapChip icon={Heart} count={theyHave.length} label="you want" className="bg-rose-300/15 text-rose-100" />
              <OverlapChip icon={ArrowLeftRight} count={theyWant.length} label="they want" className="bg-sky-300/15 text-sky-100" />
              {priorityTheyWant > 0 ? (
                <OverlapChip icon={Star} count={priorityTheyWant} label="priority" filled className="bg-[#f3d58f]/15 text-[#f3d58f]" />
              ) : null}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {own ? (
            <ShareListsButton userId={trader.id} />
          ) : !accepting ? null : (
            <Button asChild size="sm" className="rounded-full bg-emerald-300 text-emerald-950 hover:bg-emerald-200">
              <a href={kccTradeUrl(trader)} target="_blank" rel="noreferrer">
                <ArrowLeftRight />
                Offer a trade on KCC
                <ExternalLink />
              </a>
            </Button>
          )}
        </div>
      </section>

      {combined.length > 0 ? (
        <FilterBar
          options={facetOptionsFor(combined)}
          counts={view.counts}
          filters={filters}
          onChange={onFiltersChange}
          ownedControls={ownedControls}
          shown={view.cards.length}
          total={combined.length}
          noun={combined.length === 1 ? "card" : "cards"}
          showCount={false}
        />
      ) : null}
      <div>
        <nav
          aria-label="Profile lists"
          className="sticky top-[4.375rem] z-30 mb-4 flex gap-1 rounded-full border border-white/10 bg-[#151223] p-1 sm:top-[7.875rem] xl:top-[4.375rem]"
        >
          <button
            type="button"
            onClick={() => showSection("for-trade")}
            className="flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold text-sky-200 outline-none hover:bg-white/[0.06] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ArrowLeftRight className="size-4 shrink-0" />
            <span className="truncate">For trade</span>
            <span className="tabular-nums text-white/45">{forTradeCards.length}</span>
          </button>
          <button
            type="button"
            onClick={() => showSection("wishlist")}
            className="flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold text-rose-200 outline-none hover:bg-white/[0.06] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Heart className="size-4 shrink-0" />
            <span className="truncate">Wishlist</span>
            <span className="tabular-nums text-white/45">{wishlistCards.length}</span>
          </button>
        </nav>
        <div className="grid gap-6">
          <ProfileSection
            id="for-trade"
            title="For trade"
            icon={ArrowLeftRight}
            tone="text-sky-300"
            open={openSections["for-trade"]}
            onToggle={() => setOpenSections((current) => ({ ...current, "for-trade": !current["for-trade"] }))}
            cards={forTradeCards}
            highlight={own ? new Set() : myWishlist}
            highlightLabel="On your wishlist"
            empty={filtering && forTrade.length > 0 ? "No cards for trade match your filters." : "Nothing listed for trade."}
            owned={owned}
            ownedMarks={own ? false : ownedMarks}
          />
          <ProfileSection
            id="wishlist"
            title="Wishlist"
            icon={Heart}
            tone="text-rose-300"
            open={openSections.wishlist}
            onToggle={() => setOpenSections((current) => ({ ...current, wishlist: !current.wishlist }))}
            cards={wishlistCards}
            highlight={own ? new Set() : myForTrade}
            highlightLabel="You have this for trade"
            priority={priority}
            empty={filtering && wishlist.length > 0 ? "No wishlist cards match your filters." : "Nothing on the wishlist."}
            owned={owned}
            ownedMarks={ownedMarks}
          />
        </div>
      </div>
    </>
  );
}

function OverlapChip({
  icon: Icon,
  count,
  label,
  filled = false,
  className,
}: {
  icon: LucideIcon;
  count: number;
  label: string;
  filled?: boolean;
  className: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", className)}>
      <Icon className={cn("size-3", filled && "fill-current")} />
      <span className="tabular-nums">{count.toLocaleString()}</span>
      {label}
    </span>
  );
}
