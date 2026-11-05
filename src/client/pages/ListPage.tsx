import { type ReactNode } from "react";
import { Check, Copy, Info, LogIn, Plus, RotateCcw, SearchX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { cardKey, type Card } from "../../types.ts";
import { VirtualGrid } from "../VirtualGrid.tsx";
import { type SessionUser, type ListName, type OwnedState, LIST_COPY, ACTIONS_HEIGHT, duplicateCount } from "../model.ts";
import { CardFace } from "../components/cards.tsx";
import { SearchField } from "../components/controls.tsx";
import { EmptyState, SectionHeading, ShareListsButton } from "../components/common.tsx";

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
  unlistedDuplicates,
  owned,
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
  unlistedDuplicates: Card[];
  owned: OwnedState;
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
          <>
            <ShareListsButton userId={user.id} className="hidden sm:inline-flex" />
            <div className="shrink-0 text-right">
              <p className="font-display text-3xl leading-none font-extrabold tabular-nums">{selected.length}</p>
              <p className="mt-1 text-xs text-white/60">{selected.length === 1 ? "card" : "cards"}</p>
            </div>
          </>
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
                        <CardFace card={card} copies={duplicateCount(card, owned)} />
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
            <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-sky-300/20 bg-sky-300/[0.06] px-4 py-3 md:px-5">
              <Copy className="size-5 shrink-0 text-sky-300" />
              <p className="min-w-0 flex-1 text-sm text-white/75">
                {unlistedDuplicates.length === 1
                  ? "You have a duplicate that isn't listed for trade yet."
                  : `You have ${unlistedDuplicates.length} duplicates that aren't listed for trade yet.`}
              </p>
              <Button
                size="sm"
                className="rounded-full bg-sky-300 text-sky-950 hover:bg-sky-200"
                onClick={() => unlistedDuplicates.forEach((card) => onToggle(list, cardKey(card), true))}
              >
                <Plus />
                {unlistedDuplicates.length === 1 ? "List it" : "List them"}
              </Button>
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
              renderItem={(card) => (
                <>
                  <CardFace card={card} copies={duplicateCount(card, owned)} />
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
