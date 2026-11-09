import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Eye, EyeOff, RotateCcw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type Card } from "../../types.ts";
import { type OwnedState, type FacetId, FACETS, type Filters, NO_FILTERS, type Settings, applyFilters } from "../model.ts";
import { FacetFilter, OwnedToggle, SortToggle, Switch } from "./controls.tsx";

export function SettingsSheet({
  settings,
  onChange,
  rarities,
  cards,
  options,
  owned,
  ownedAvailable,
  accepting,
  onAcceptingChange,
  pruneWishlist,
  onPruneWishlistChange,
  listDuplicates,
  onListDuplicatesChange,
  signedIn,
  onShowFeatures,
  onOpenAdmin,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
  rarities: string[];
  cards: Card[];
  options: Record<FacetId, string[]>;
  owned: OwnedState;
  ownedAvailable: boolean;
  accepting: boolean | null;
  onAcceptingChange: (accepting: boolean) => void;
  pruneWishlist: boolean | null;
  onPruneWishlistChange: (pruneWishlist: boolean) => void;
  listDuplicates: boolean | null;
  onListDuplicatesChange: (listDuplicates: boolean) => void;
  signedIn: boolean;
  onShowFeatures: () => void;
  onOpenAdmin?: () => void;
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
        aria-describedby={undefined}
        className="gap-0 border-white/10 bg-[#1a1528] data-[side=right]:w-full data-[side=right]:sm:max-w-md"
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
        </SheetHeader>
        <div className="flex flex-col gap-6 overflow-y-auto px-6 pt-2 pb-6">
          <SettingsGroup title="Trading">
            <section className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 id="accepting-label" className="font-display text-base font-bold">
                    Accepting trades
                  </h4>
                  <p className="text-sm text-white/60">
                    {accepting === null
                      ? "Sign in to choose whether other traders can find you."
                      : accepting
                        ? "You show up in other traders' matches, and your public page invites offers."
                        : "You're hidden from other traders' matches, and your public page says you're not trading."}
                  </p>
                </div>
                <Switch
                  labelledBy="accepting-label"
                  checked={accepting ?? false}
                  disabled={accepting === null}
                  onChange={onAcceptingChange}
                />
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 id="prune-wishlist-label" className="font-display text-base font-bold">
                    Clear owned from Wishlist
                  </h4>
                  <p className="text-sm text-white/60">
                    {pruneWishlist === null
                      ? "Sign in to have cards taken off your Wishlist once you own them."
                      : pruneWishlist
                        ? "When your collection syncs, any card you now own is taken off your Wishlist. Manage kept cards, on Wishlist, leaves chosen cards on the list even after you own them."
                        : "Cards you own stay on your Wishlist until you remove them yourself. Manage kept cards, on Wishlist, still lets you mark cards to keep if you turn this back on."}
                  </p>
                </div>
                <Switch
                  labelledBy="prune-wishlist-label"
                  checked={pruneWishlist ?? false}
                  disabled={pruneWishlist === null}
                  onChange={onPruneWishlistChange}
                />
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 id="list-duplicates-label" className="font-display text-base font-bold">
                    List duplicates for trade
                  </h4>
                  <p className="text-sm text-white/60">
                    {listDuplicates === null
                      ? "Sign in to have spare copies listed for trade when your collection syncs."
                      : listDuplicates
                        ? "When your collection syncs, new spare copies go on your For trade list, and come off once they're no longer spare. So do cards you add with List them. Manage skipped cards, on For trade, keeps chosen cards off duplicates listing, even before they are spare copies. Cards you add yourself stay listed."
                        : "Spare copies are only listed for trade when you add them yourself. Manage skipped cards, on For trade, keeps chosen cards off duplicates listing, even before they are spare copies."}
                  </p>
                </div>
                <Switch
                  labelledBy="list-duplicates-label"
                  checked={listDuplicates ?? false}
                  disabled={listDuplicates === null}
                  onChange={onListDuplicatesChange}
                />
              </div>
            </section>
          </SettingsGroup>

          <SettingsGroup title="Display">
            <section className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 id="card-effects-label" className="font-display text-base font-bold">
                    Card effects
                  </h4>
                  <p className="text-sm text-white/60">
                    Foil shine and sparkles on cards.{" "}
                    <span className="text-amber-200">Enabling this may cause the page to lag.</span>
                  </p>
                </div>
                <Switch
                  labelledBy="card-effects-label"
                  checked={settings.cardEffects}
                  onChange={(cardEffects) => onChange({ ...settings, cardEffects })}
                />
              </div>
            </section>
            <section className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 id="owned-marks-label" className="font-display text-base font-bold">
                    Owned tags
                  </h4>
                  <p className="text-sm text-white/60">A check in the corner of a card you own.</p>
                </div>
                <Switch
                  labelledBy="owned-marks-label"
                  checked={settings.ownedMarks}
                  onChange={(ownedMarks) => onChange({ ...settings, ownedMarks })}
                />
              </div>
            </section>
            <section className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 id="wishlist-marks-label" className="font-display text-base font-bold">
                    Wishlist counts
                  </h4>
                  <p className="text-sm text-white/60">
                    A heart on catalog, For trade, and Wishlist cards showing how many traders have that card on their Wishlist.
                  </p>
                </div>
                <Switch
                  labelledBy="wishlist-marks-label"
                  checked={settings.wishlistMarks}
                  onChange={(wishlistMarks) => onChange({ ...settings, wishlistMarks })}
                />
              </div>
            </section>
            {signedIn ? (
              <section className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 id="feature-notes-label" className="font-display text-base font-bold">
                      New features
                    </h4>
                    <p className="text-sm text-white/60">
                      When you open the site, show features added since you were last here.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 w-fit rounded-full"
                      onClick={() => {
                        setOpen(false);
                        onShowFeatures();
                      }}
                    >
                      Show what's new
                    </Button>
                  </div>
                  <Switch
                    labelledBy="feature-notes-label"
                    checked={settings.featureNotes}
                    onChange={(featureNotes) => onChange({ ...settings, featureNotes })}
                  />
                </div>
              </section>
            ) : null}
          </SettingsGroup>

          <SettingsGroup title="Browsing">
            <section className="flex flex-col gap-3">
              <div>
                <h4 className="font-display text-base font-bold">Hidden rarities</h4>
                <p className="text-sm text-white/60">
                  Hidden rarities disappear from the catalog, your lists, and search.
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
                <h4 className="font-display text-base font-bold">Default catalog sort</h4>
                <p className="text-sm text-white/60">
                  Applied whenever you open the catalog without a sort in the link.
                </p>
              </div>
              <SortToggle
                field
                value={settings.catalogSort}
                defaultValue="rarity"
                onChange={(catalogSort) => onChange({ ...settings, catalogSort })}
              />
            </section>

            <section className="flex flex-col gap-3">
              <div>
                <h4 className="font-display text-base font-bold">Default catalog filters</h4>
                <p className="text-sm text-white/60">
                  Applied whenever you open the catalog without filters in the link.
                </p>
              </div>
              <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
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
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span className="w-[4.5rem] shrink-0 text-sm font-medium text-white/70">Owned</span>
                {ownedAvailable ? (
                  <OwnedToggle
                    value={defaults.owned}
                    disabled={false}
                    onChange={(value) => setDefaults({ ...defaults, owned: value })}
                    className="w-fit max-w-full [&>button]:px-1.5"
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
          </SettingsGroup>

          {onOpenAdmin ? (
            <SettingsGroup title="Admin">
              <section className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-display text-base font-bold">Admin panel</h4>
                  <p className="text-sm text-white/60">Resync the catalog, or every trader's profile and collection.</p>
                </div>
                <Button
                  variant="outline"
                  className="shrink-0 rounded-full"
                  onClick={() => {
                    setOpen(false);
                    onOpenAdmin();
                  }}
                >
                  Open
                </Button>
              </section>
            </SettingsGroup>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="px-1 text-xs font-semibold tracking-wider text-white/45 uppercase">{title}</h3>
      <div className="flex flex-col divide-y divide-white/[0.06] rounded-lg border border-white/10 bg-white/[0.03] [&>section]:p-4">
        {children}
      </div>
    </div>
  );
}
