import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ArrowLeftRight, ExternalLink, Handshake, Heart, LogIn, RotateCcw, SearchX } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { cardKey, type Card } from "../../types.ts";
import { duplicateCount, isOwned, kccTradeUrl, lastSeenLabel, listedCopies, tradeViewHref, type OwnedState, type Page, type SessionUser, type TradeView, type Trader } from "../model.ts";
import { CardFace } from "../components/cards.tsx";
import { EmptyState } from "../components/common.tsx";

const MATCH_GAP = 16;
const MATCH_PREVIEW_DESKTOP = 8;
const MATCH_PREVIEW_MOBILE = 8;
/** Temporary: set false to test whether frame overlays are the mobile scroll bottleneck. */
const TRADE_THUMB_FRAMES = false;

export interface ResolvedMatch {
  trader: Trader;
  theyHave: Card[];
  theyWant: Card[];
  priority: Set<string>;
  theyHaveCopies?: Record<string, number>;
}

export const MATCH_PREVIEW = MATCH_PREVIEW_DESKTOP;

function isMobileTradesLayout(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

export const MatchCards = memo(function MatchCards({
  title,
  cards,
  tone,
  owned,
  ownedMarks,
  priority,
  theyHaveCopies,
  previewCount,
}: {
  title: string;
  cards: Card[];
  tone: string;
  owned: OwnedState;
  ownedMarks: boolean;
  priority: Set<string>;
  theyHaveCopies?: Record<string, number>;
  previewCount: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? cards : cards.slice(0, previewCount);
  return (
    <div className="grid min-w-0 content-start gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.03] p-4">
      <p className="flex min-w-0 items-center justify-between gap-2 text-sm font-semibold">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", tone)} />
          <span className="min-w-0 truncate">{title}</span>
        </span>
        <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-0.5 text-xs text-white/70 tabular-nums">{cards.length}</span>
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(92px,100%),1fr))] gap-2">
        {shown.map((card) => (
          <div key={cardKey(card)} className="trade-thumb min-w-0">
            <CardFace
              card={card}
              copies={theyHaveCopies ? listedCopies(card, theyHaveCopies) : duplicateCount(card, owned)}
              owned={ownedMarks && isOwned(card, owned)}
              priority={priority.has(cardKey(card))}
              lazy
              effects={false}
              showFrame={TRADE_THUMB_FRAMES}
            />
          </div>
        ))}
      </div>
      {cards.length > previewCount ? (
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start rounded-full text-white/70"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : `Show all ${cards.length}`}
        </Button>
      ) : null}
    </div>
  );
});

export const TraderMatch = memo(function TraderMatch({
  match,
  owned,
  ownedMarks,
  previewCount,
  onOpen,
}: {
  match: ResolvedMatch;
  owned: OwnedState;
  ownedMarks: boolean;
  previewCount: number;
  onOpen: (page: Page, href: string) => void;
}) {
  const { trader, theyHave, theyWant, priority, theyHaveCopies } = match;
  const tradeUrl = kccTradeUrl(trader);

  return (
    <article className="grid min-w-0 gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
      <header className="grid min-w-0 gap-3 md:flex md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar className="size-11 shrink-0">
            <AvatarImage src={trader.avatarUrl} alt="" />
            <AvatarFallback>{trader.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <a
              href={`/u/${trader.id}`}
              onClick={(event) => {
                event.preventDefault();
                onOpen("profile", `/u/${trader.id}`);
              }}
              className="block truncate font-display text-lg leading-tight font-bold hover:text-amber-100 hover:underline"
            >
              {trader.name}
            </a>
            <p className="truncate text-sm text-white/55">
              @{trader.username}
              {trader.kccName ? ` · ${trader.kccName} on KCC` : ""}
              {trader.lastSeenAt ? ` · ${lastSeenLabel(trader.lastSeenAt)}` : ""}
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="w-full rounded-full bg-emerald-300 text-emerald-950 hover:bg-emerald-200 md:w-auto">
          <a href={tradeUrl} target="_blank" rel="noreferrer">
            <ArrowLeftRight />
            Offer a trade on KCC
            <ExternalLink className="shrink-0" />
          </a>
        </Button>
      </header>
      <div className={cn("grid min-w-0 gap-3", theyHave.length > 0 && theyWant.length > 0 && "md:grid-cols-2")}>
        {theyHave.length > 0 ? (
          <MatchCards
            title="They have, you want"
            cards={theyHave}
            tone="bg-rose-300"
            owned={owned}
            ownedMarks={ownedMarks}
            priority={priority}
            theyHaveCopies={theyHaveCopies}
            previewCount={previewCount}
          />
        ) : null}
        {theyWant.length > 0 ? (
          <MatchCards
            title="You have, they want"
            cards={theyWant}
            tone="bg-sky-300"
            owned={owned}
            ownedMarks={false}
            priority={priority}
            previewCount={previewCount}
          />
        ) : null}
      </div>
    </article>
  );
});

const VIEWS: { id: TradeView; label: string; icon: typeof Handshake; tone: string; blurb: string }[] = [
  {
    id: "matches",
    label: "Matches",
    icon: Handshake,
    tone: "text-emerald-300",
    blurb: "Traders who have cards you want and want cards you have.",
  },
  {
    id: "you-want",
    label: "You want",
    icon: Heart,
    tone: "text-rose-300",
    blurb: "Traders who have a card on your Wishlist, and don't want one of yours yet.",
  },
  {
    id: "they-want",
    label: "They want",
    icon: ArrowLeftRight,
    tone: "text-sky-300",
    blurb: "Traders who want a card you're offering, and don't have one you want yet.",
  },
];

function inView(match: ResolvedMatch, view: TradeView): boolean {
  const theyHave = match.theyHave.length > 0;
  const theyWant = match.theyWant.length > 0;
  if (view === "matches") return theyHave && theyWant;
  if (view === "you-want") return theyHave && !theyWant;
  return theyWant && !theyHave;
}

function emptyTitle(view: TradeView): string {
  if (view === "you-want") return "Nobody has a card you want";
  if (view === "they-want") return "Nobody wants a card you have";
  return "No matches yet";
}

function emptyBody(view: TradeView, wishlistEmpty: boolean, forTradeEmpty: boolean): string {
  if (view === "you-want" && wishlistEmpty) return "Add cards to your Wishlist to see who has them for trade.";
  if (view === "they-want" && forTradeEmpty) return "Add cards to For trade to see who wants them.";
  if (view === "you-want") return "No one who is accepting trades has a card on your Wishlist right now.";
  if (view === "they-want") return "No one who is accepting trades wants a card you're offering right now.";
  return "Nobody has a card you want while also wanting one of yours. Adding more cards to your Wishlist and For trade list makes a match more likely.";
}

function compareView(view: TradeView) {
  return (a: ResolvedMatch, b: ResolvedMatch) => {
    const cards = (match: ResolvedMatch) => (view === "they-want" ? match.theyWant : match.theyHave);
    const aCards = cards(a);
    const bCards = cards(b);
    const priority = (match: ResolvedMatch, side: Card[]) => side.filter((card) => match.priority.has(cardKey(card))).length;
    return (
      bCards.length - aCards.length ||
      priority(b, bCards) - priority(a, aCards) ||
      a.trader.name.localeCompare(b.trader.name)
    );
  };
}

function estimateMatchSize(match: ResolvedMatch, previewCount: number, stacked: boolean): number {
  const hasHave = match.theyHave.length > 0;
  const hasWant = match.theyWant.length > 0;
  const preview = Math.max(
    hasHave ? Math.min(match.theyHave.length, previewCount) : 0,
    hasWant ? Math.min(match.theyWant.length, previewCount) : 0,
    1,
  );
  const rows = Math.ceil(preview / 3);
  const panel = 88 + rows * 148;
  const panels = (hasHave ? 1 : 0) + (hasWant ? 1 : 0);
  return 150 + (stacked && panels > 1 ? panels * panel : panel);
}

function MatchList({
  matches,
  owned,
  ownedMarks,
  onOpen,
}: {
  matches: ResolvedMatch[];
  owned: OwnedState;
  ownedMarks: boolean;
  onOpen: (page: Page, href: string) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const layout = useMemo(() => {
    const mobile = isMobileTradesLayout();
    return {
      previewCount: mobile ? MATCH_PREVIEW_MOBILE : MATCH_PREVIEW_DESKTOP,
      stacked: mobile,
      overscan: mobile ? 1 : 3,
    };
  }, []);
  const listKey = matches.map((match) => match.trader.id).join("\0");
  const virtualizer = useWindowVirtualizer({
    count: matches.length,
    estimateSize: (index) => estimateMatchSize(matches[index]!, layout.previewCount, layout.stacked),
    overscan: layout.overscan,
    gap: MATCH_GAP,
    scrollMargin,
    getItemKey: (index) => matches[index]!.trader.id,
    measureElement: (element) => (element as HTMLElement).offsetHeight,
  });

  useLayoutEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    // Don't ResizeObserver this node: padding-based virtualization changes its
    // height and would feedback into scrollMargin updates while scrolling.
    const apply = () => {
      const nextMargin = node.getBoundingClientRect().top + window.scrollY;
      setScrollMargin((current) => (Math.abs(current - nextMargin) < 0.5 ? current : nextMargin));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [listKey]);

  const rows = virtualizer.getVirtualItems();
  const first = rows[0];
  const last = rows[rows.length - 1];
  const paddingTop = first ? Math.max(0, first.start - scrollMargin) : 0;
  const paddingBottom = last ? Math.max(0, virtualizer.getTotalSize() - (last.end - scrollMargin)) : 0;

  return (
    <div ref={frameRef} className="virtual-grid min-w-0" data-scrolling={virtualizer.isScrolling ? "" : undefined}>
      <div key={listKey} className="w-full" style={{ paddingTop, paddingBottom }}>
        {rows.map((row, order) => {
          const match = matches[row.index]!;
          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              style={{ marginBottom: order === rows.length - 1 ? 0 : MATCH_GAP }}
            >
              <TraderMatch
                match={match}
                owned={owned}
                ownedMarks={ownedMarks}
                previewCount={layout.previewCount}
                onOpen={onOpen}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TradesPage({
  user,
  loading,
  failed,
  matches,
  needsBothLists,
  wishlistEmpty,
  forTradeEmpty,
  onRetry,
  onOpen,
  accepting,
  owned,
  ownedMarks,
  view,
  onView,
}: {
  accepting: boolean;
  user: SessionUser | null;
  loading: boolean;
  failed: boolean;
  matches: ResolvedMatch[];
  needsBothLists: boolean;
  wishlistEmpty: boolean;
  forTradeEmpty: boolean;
  onRetry: () => void;
  onOpen: (page: Page, href: string) => void;
  owned: OwnedState;
  ownedMarks: boolean;
  view: TradeView;
  onView: (view: TradeView) => void;
}) {
  const counts = useMemo(() => {
    const next: Record<TradeView, number> = { matches: 0, "you-want": 0, "they-want": 0 };
    for (const match of matches) {
      if (inView(match, "matches")) next.matches += 1;
      else if (inView(match, "you-want")) next["you-want"] += 1;
      else if (inView(match, "they-want")) next["they-want"] += 1;
    }
    return next;
  }, [matches]);
  const shown = useMemo(() => {
    const next = matches.filter((match) => inView(match, view));
    if (view !== "matches") next.sort(compareView(view));
    return next;
  }, [matches, view]);
  const blurb = VIEWS.find((item) => item.id === view)?.blurb ?? "";
  const ready = Boolean(user) && !loading && !failed && !needsBothLists;

  return (
    <>
      <section className="flex min-w-0 items-center gap-4 rounded-[1.75rem] border border-white/10 bg-[radial-gradient(110%_130%_at_0%_0%,rgba(110,231,183,0.18),transparent_55%),linear-gradient(160deg,#18242a,#141224)] px-5 py-4 md:px-8 md:py-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-300/15 text-emerald-300">
          <Handshake className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl leading-tight font-extrabold tracking-tight md:text-3xl">Trades</h1>
          <p className="text-sm text-white/65">{blurb}</p>
        </div>
        {ready ? (
          <div className="shrink-0 text-right">
            <p className="font-display text-3xl leading-none font-extrabold tabular-nums">{counts[view]}</p>
            <p className="mt-1 text-xs text-white/60">{counts[view] === 1 ? "trader" : "traders"}</p>
          </div>
        ) : null}
      </section>

      {ready ? (
        <div role="tablist" aria-label="Trade overlaps" className="grid min-w-0 grid-cols-3 gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
          {VIEWS.map((item) => {
            const active = view === item.id;
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href={tradeViewHref(item.id)}
                role="tab"
                aria-selected={active}
                onClick={(event) => {
                  event.preventDefault();
                  onView(item.id);
                }}
                className={cn(
                  "flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full px-1.5 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:gap-2 sm:px-2",
                  active ? "bg-[#f3d58f] text-[#1b1509]" : "text-white/70 hover:bg-white/[0.07] hover:text-white",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active ? "text-[#1b1509]" : item.tone)} />
                <span className="min-w-0 truncate">{item.label}</span>
                <span className={cn("shrink-0 tabular-nums", active ? "text-[#1b1509]/70" : "text-white/45")}>{counts[item.id]}</span>
              </a>
            );
          })}
        </div>
      ) : null}

      {user && !accepting ? (
        <p className="rounded-2xl border border-amber-200/25 bg-amber-200/[0.07] px-4 py-3 text-sm text-amber-100/90">
          You're not accepting trades, so other traders can't see you in their matches. Turn on Accepting trades in
          Settings to show up again.
        </p>
      ) : null}

      {!user ? (
        <EmptyState
          icon={LogIn}
          title="Sign in to find trades"
          action={
            <Button asChild className="mt-1 rounded-full bg-[#5865f2] text-white hover:bg-[#4752c4]">
              <a href="/auth/discord">
                <LogIn />
                Sign in with Discord
              </a>
            </Button>
          }
        >
          We match your lists against every other trader's, so you need to be signed in.
        </EmptyState>
      ) : needsBothLists ? (
        <EmptyState
          icon={Handshake}
          title="Fill in both lists"
          action={
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => onOpen("wishlist", "/wishlist")}>
                <Heart />
                Build your wishlist
              </Button>
              <Button variant="outline" className="rounded-full" onClick={() => onOpen("forTrade", "/for-trade")}>
                <ArrowLeftRight />
                Pick cards to trade
              </Button>
            </div>
          }
        >
          Add cards you want to your Wishlist, or cards you can give away to For trade.
        </EmptyState>
      ) : failed ? (
        <EmptyState
          icon={SearchX}
          title="Couldn't find trades"
          action={
            <Button variant="outline" className="mt-1 rounded-full" onClick={onRetry}>
              <RotateCcw />
              Try again
            </Button>
          }
        >
          Something went wrong while comparing lists.
        </EmptyState>
      ) : loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-64 rounded-3xl bg-white/[0.05]" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState icon={view === "you-want" ? Heart : view === "they-want" ? ArrowLeftRight : Handshake} title={emptyTitle(view)}>
          {emptyBody(view, wishlistEmpty, forTradeEmpty)}
        </EmptyState>
      ) : (
        <MatchList matches={shown} owned={owned} ownedMarks={ownedMarks} onOpen={onOpen} />
      )}
    </>
  );
}
