import { useEffect, useState } from "react";
import { ArrowLeftRight, ExternalLink, Heart, SearchX, type LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { cardKey, type Card } from "../../types.ts";
import { type SessionUser, type Lists, type Trader, INACTIVE_AFTER_DAYS, daysSince, lastSeenLabel, type OwnedState, type Filters, kccTradeUrl, cardsInCatalogOrder, duplicateCount, facetOptionsFor, filtersAreActive, applyFilters } from "../model.ts";
import { CardFace } from "../components/cards.tsx";
import { type OwnedControls, FilterBar } from "../components/controls.tsx";
import { EmptyState, GridSkeleton, SectionHeading, ShareListsButton } from "../components/common.tsx";

export interface PublicLists extends Lists {
  trader: Trader;
}

export function ProfileSection({
  title,
  icon: Icon,
  tone,
  cards,
  highlight,
  highlightLabel,
  empty,
  owned,
}: {
  title: string;
  icon: LucideIcon;
  tone: string;
  cards: Card[];
  highlight: Set<string>;
  highlightLabel: string;
  empty: string;
  owned: OwnedState;
}) {
  return (
    <section className="grid gap-4">
      <SectionHeading
        title={title}
        meta={
          <span className="inline-flex items-center gap-1.5">
            <Icon className={cn("size-4", tone)} />
            {cards.length.toLocaleString()} {cards.length === 1 ? "card" : "cards"}
          </span>
        }
      />
      {cards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/12 px-4 py-6 text-center text-sm text-white/50">{empty}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-5">
          {cards.map((card) => {
            const key = cardKey(card);
            return (
              <div key={key} className="grid gap-2">
                <CardFace card={card} copies={duplicateCount(card, owned)} />
                {highlight.has(key) ? (
                  <span className="justify-self-center rounded-full bg-emerald-300/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-200">
                    {highlightLabel}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
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
  filters,
  onFiltersChange,
  owned,
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
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  owned: OwnedState;
  ownedControls: OwnedControls | null;
}) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "missing" | "error"; lists: PublicLists | null }>({
    status: "loading",
    lists: null,
  });

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
  const wishlist = cardsInCatalogOrder(state.lists.wishlist, byKey);
  const combined = [...new Set([...forTrade, ...wishlist])];
  const view = applyFilters(combined, filters, owned, "");
  const passing = new Set(view.cards);
  const filtering = filtersAreActive(filters, owned);

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
        />
      ) : null}
      <ProfileSection
        title="For trade"
        icon={ArrowLeftRight}
        tone="text-sky-300"
        cards={forTrade.filter((card) => passing.has(card))}
        highlight={own ? new Set() : myWishlist}
        highlightLabel="On your wishlist"
        empty={filtering && forTrade.length > 0 ? "No cards for trade match your filters." : "Nothing listed for trade."}
        owned={owned}
      />
      <ProfileSection
        title="Wishlist"
        icon={Heart}
        tone="text-rose-300"
        cards={wishlist.filter((card) => passing.has(card))}
        highlight={own ? new Set() : myForTrade}
        highlightLabel="You have this for trade"
        empty={filtering && wishlist.length > 0 ? "No wishlist cards match your filters." : "Nothing on the wishlist."}
        owned={owned}
      />
    </>
  );
}
