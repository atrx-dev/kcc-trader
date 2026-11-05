import { useState } from "react";
import { ArrowLeftRight, ExternalLink, Handshake, Heart, LogIn, RotateCcw, SearchX } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { cardKey, type Card } from "../../types.ts";
import { kccTradeUrl, lastSeenLabel, type Page, type SessionUser, type Trader } from "../model.ts";
import { CardFace } from "../components/cards.tsx";
import { EmptyState } from "../components/common.tsx";

export interface ResolvedMatch {
  trader: Trader;
  theyHave: Card[];
  theyWant: Card[];
}

export const MATCH_PREVIEW = 8;

export function MatchCards({ title, cards, tone }: { title: string; cards: Card[]; tone: string }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? cards : cards.slice(0, MATCH_PREVIEW);
  return (
    <div className="grid content-start gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.03] p-4">
      <p className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", tone)} />
          {title}
        </span>
        <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-xs text-white/70 tabular-nums">{cards.length}</span>
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
        {shown.map((card) => (
          <CardFace key={cardKey(card)} card={card} />
        ))}
      </div>
      {cards.length > MATCH_PREVIEW ? (
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
}

export function TraderMatch({ match, onOpen }: { match: ResolvedMatch; onOpen: (page: Page, href: string) => void }) {
  const { trader, theyHave, theyWant } = match;
  const tradeUrl = kccTradeUrl(trader);

  return (
    <article className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
      <header className="flex flex-wrap items-center gap-3">
        <Avatar className="size-11">
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
        <Button asChild size="sm" className="rounded-full bg-emerald-300 text-emerald-950 hover:bg-emerald-200">
          <a href={tradeUrl} target="_blank" rel="noreferrer">
            <ArrowLeftRight />
            Offer a trade on KCC
            <ExternalLink />
          </a>
        </Button>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        <MatchCards
          title="They have, you want"
          cards={theyHave}
          tone="bg-rose-300"
        />
        <MatchCards title="You have, they want" cards={theyWant} tone="bg-sky-300" />
      </div>
    </article>
  );
}

export function TradesPage({
  user,
  loading,
  failed,
  matches,
  needsBothLists,
  onRetry,
  onOpen,
  accepting,
}: {
  accepting: boolean;
  user: SessionUser | null;
  loading: boolean;
  failed: boolean;
  matches: ResolvedMatch[];
  needsBothLists: boolean;
  onRetry: () => void;
  onOpen: (page: Page, href: string) => void;
}) {
  return (
    <>
      <section className="flex items-center gap-4 rounded-[1.75rem] border border-white/10 bg-[radial-gradient(110%_130%_at_0%_0%,rgba(110,231,183,0.18),transparent_55%),linear-gradient(160deg,#18242a,#141224)] px-5 py-4 md:px-8 md:py-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-300/15 text-emerald-300">
          <Handshake className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl leading-tight font-extrabold tracking-tight md:text-3xl">Trades</h1>
          <p className="text-sm text-white/65">Traders who have cards you want and want cards you have.</p>
        </div>
        {user && !loading && !failed ? (
          <div className="shrink-0 text-right">
            <p className="font-display text-3xl leading-none font-extrabold tabular-nums">{matches.length}</p>
            <p className="mt-1 text-xs text-white/60">{matches.length === 1 ? "trader" : "traders"}</p>
          </div>
        ) : null}
      </section>

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
          Trades go both ways, so add cards you want to your Wishlist and cards you can give away to For trade.
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
      ) : matches.length === 0 ? (
        <EmptyState icon={Handshake} title="No matches yet">
          Nobody has a card you want while also wanting one of yours. Adding more cards to your Wishlist and For trade list
          makes a match more likely.
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          {matches.map((match) => (
            <TraderMatch key={match.trader.id} match={match} onOpen={onOpen} />
          ))}
        </div>
      )}
    </>
  );
}
