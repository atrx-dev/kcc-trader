import { useState, type ReactNode } from "react";
import { Ban, Check, Copy, Info, LogIn, Plus, RotateCcw, SearchX, Star, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { cardKey, type Card } from "../../types.ts";
import { VirtualGrid } from "../VirtualGrid.tsx";
import { type SessionUser, type ListName, type OwnedState, LIST_COPY, ACTIONS_HEIGHT, duplicateCount, isOwned, searchableText } from "../model.ts";
import { CardFace } from "../components/cards.tsx";
import { SearchField, ToggleAction } from "../components/controls.tsx";
import { EmptyState, SectionHeading, ShareListsButton } from "../components/common.tsx";

function skipNotice(automatic: boolean, count: number): string {
  if (count === 0) {
    return automatic
      ? "Duplicates listing is on."
      : "Leave cards out of duplicates listing.";
  }
  const cards = count === 1 ? "1 card is" : `${count} cards are`;
  return `${cards} left out of duplicates listing.`;
}

export function ListPage({
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
  priority,
  onPriority,
  unlistedDuplicates,
  listDuplicates,
  skippedCards,
  candidates,
  onSkip,
  owned,
  ownedMarks,
  wanted,
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
  onToggle: (list: ListName, key: string, present: boolean, auto?: boolean) => void;
  priority: Set<string>;
  onPriority: (key: string, priority: boolean) => void;
  unlistedDuplicates: Card[];
  listDuplicates: boolean;
  skippedCards: Card[];
  candidates: Card[];
  onSkip: (key: string, skip: boolean) => void;
  owned: OwnedState;
  ownedMarks: boolean;
  wanted?: ReadonlyMap<string, number>;
}) {
  const [skipsOpen, setSkipsOpen] = useState(false);
  const copy = LIST_COPY[list];
  const Icon = copy.icon;
  const searching = query.trim().length > 0;
  const showOwned = list !== "forTrade" && ownedMarks;
  const duplicateBanner = (
    <div className="flex flex-wrap items-center gap-3">
      <Copy className="size-5 shrink-0 text-sky-300" />
      <p className="min-w-0 flex-1 text-sm text-white/75">
        {unlistedDuplicates.length === 1
          ? "You have a duplicate that isn't listed for trade yet."
          : `You have ${unlistedDuplicates.length} duplicates that aren't listed for trade yet.`}
      </p>
      <Button
        size="sm"
        className="rounded-full bg-sky-300 text-sky-950 hover:bg-sky-200"
        onClick={() => unlistedDuplicates.forEach((card) => onToggle(list, cardKey(card), true, true))}
      >
        <Plus />
        {unlistedDuplicates.length === 1 ? "List it" : "List them"}
      </Button>
    </div>
  );

  return (
    <>
      <section
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[1.75rem] border border-white/10 px-5 py-4 md:px-8 md:py-5",
          copy.glow,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", copy.bubble)}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-tight font-extrabold tracking-tight md:text-3xl">{copy.title}</h1>
            <p className="text-sm text-white/65">{copy.blurb}</p>
          </div>
        </div>
        {user && list === "forTrade" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                className="order-last w-full basis-full rounded-full bg-sky-300 text-sky-950 hover:bg-sky-200 md:order-none md:w-auto md:basis-auto"
                onClick={() => setSkipsOpen(true)}
              >
                <Ban />
                Manage skipped cards
              </Button>
            </TooltipTrigger>
            <TooltipContent>{skipNotice(listDuplicates, skippedCards.length)}</TooltipContent>
          </Tooltip>
        ) : null}
        {user ? (
          <div className="flex shrink-0 items-center gap-3">
            <ShareListsButton userId={user.id} className="hidden sm:inline-flex" />
            <div className="text-right">
              <p className="font-display text-3xl leading-none font-extrabold tabular-nums">{selected.length}</p>
              <p className="mt-1 text-xs text-white/60">{selected.length === 1 ? "card" : "cards"}</p>
            </div>
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
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <SearchField
                  id="list-search"
                  label="Find cards to add"
                  value={query}
                  placeholder="Find cards to add by name, game, or developer"
                  onChange={onQuery}
                />
              </div>
              {searchOwnedOnly && !searchHint ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 rounded-full text-white/55"
                      aria-label="Only cards in your KCC collection show up here."
                    >
                      <Info />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Only cards in your KCC collection show up here.</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
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
                        <CardFace card={card} copies={duplicateCount(card, owned)} owned={showOwned && isOwned(card, owned)} />
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

          {unlistedDuplicates.length > 0 ? (
            <section className="rounded-3xl border border-sky-300/20 bg-sky-300/[0.06] px-4 py-3 md:px-5">
              {duplicateBanner}
            </section>
          ) : null}

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
              renderItem={(card) => {
                const key = cardKey(card);
                const starred = list === "wishlist" && priority.has(key);
                return (
                  <>
                    <CardFace
                      card={card}
                      copies={duplicateCount(card, owned)}
                      owned={showOwned && isOwned(card, owned)}
                      priority={starred}
                      wanted={wanted?.get(key) ?? 0}
                    />
                    {list === "wishlist" ? (
                      <div className="grid grid-cols-2 gap-1.5">
                        <ToggleAction
                          active={starred}
                          icon={Star}
                          label="Priority"
                          activeClass="bg-[#f3d58f] text-[#1b1509] hover:bg-[#ffe7a8]"
                          addLabel="Mark as priority"
                          removeLabel="Remove priority"
                          onClick={() => onPriority(key, !starred)}
                        />
                        <Button
                          variant="ghost"
                          className="h-[34px] rounded-full bg-white/[0.06] text-white/75 hover:bg-white/[0.11]"
                          onClick={() => onToggle(list, key, false)}
                        >
                          <X />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        className="h-[34px] rounded-full bg-white/[0.06] text-white/75 hover:bg-white/[0.11]"
                        onClick={() => onToggle(list, key, false)}
                      >
                        <X />
                        Remove
                      </Button>
                    )}
                  </>
                );
              }}
            />
          )}
        </>
      )}
      {list === "forTrade" ? (
        <SkippedDialog
          open={skipsOpen}
          skipped={skippedCards}
          candidates={candidates}
          onOpenChange={setSkipsOpen}
          onSkip={onSkip}
        />
      ) : null}
    </>
  );
}

function SkippedDialog({
  open,
  skipped,
  candidates,
  onOpenChange,
  onSkip,
}: {
  open: boolean;
  skipped: Card[];
  candidates: Card[];
  onOpenChange: (open: boolean) => void;
  onSkip: (key: string, skip: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const skippedKeys = new Set(skipped.map(cardKey));
  const matches = needle
    ? candidates.filter((card) => searchableText(card).includes(needle)).slice(0, 40)
    : [];

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(36rem,calc(100dvh-2rem))] w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#1a1528] text-white shadow-lg outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <div className="px-6 pt-6 pr-14">
            <Dialog.Title className="font-display text-xl font-bold">Manage skipped cards</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-white/65">
              Skipped cards stay off duplicates listing, even before you have a spare. A spare that was listed automatically comes off For trade.
            </Dialog.Description>
          </div>
          <Dialog.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close"
              className="absolute top-3 right-3 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X />
            </Button>
          </Dialog.Close>
          <div className="px-6 pt-4">
            <SearchField
              id="skip-search"
              label="Find a card to skip"
              value={query}
              placeholder="Find a card to skip"
              onChange={setQuery}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {needle ? (
              matches.length === 0 ? (
                <p className="text-sm text-white/55">No cards match “{query.trim()}”.</p>
              ) : (
                <ul className="grid gap-2">
                  {matches.map((card) => {
                    const key = cardKey(card);
                    const already = skippedKeys.has(key);
                    return (
                      <SpareRow
                        key={key}
                        card={card}
                        action={
                          <Button
                            size="sm"
                            variant={already ? "secondary" : "outline"}
                            className="shrink-0 rounded-full"
                            onClick={() => onSkip(key, !already)}
                          >
                            {already ? "Include" : "Skip"}
                          </Button>
                        }
                      />
                    );
                  })}
                </ul>
              )
            ) : skipped.length === 0 ? (
              <p className="text-sm text-white/55">Nothing is skipped. Search for a card to leave it out if you get a spare.</p>
            ) : (
              <ul className="grid gap-2">
                {skipped.map((card) => (
                  <SpareRow
                    key={cardKey(card)}
                    card={card}
                    action={
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 rounded-full text-white/75"
                        onClick={() => onSkip(cardKey(card), false)}
                      >
                        Include
                      </Button>
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SpareRow({ card, action }: { card: Card; action: ReactNode }) {
  const detail = [card.variantName, card.rank].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-3">
      {card.image ? (
        <img src={card.image} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="h-14 w-10 shrink-0 rounded-md bg-white/10" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{card.name}</span>
        <span className="block truncate text-xs text-white/55">{detail}</span>
      </span>
      {action}
    </li>
  );
}
