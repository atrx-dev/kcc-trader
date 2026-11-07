import { ArrowLeftRight, Heart, RefreshCw, RotateCcw, Search, SlidersHorizontal, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type CatalogSort, type FacetId, type OwnedFilter, FACETS, type Filters, NO_FILTERS, OWNED_CHOICES } from "../model.ts";

export function SearchField({
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

export function FacetFilter({
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
      <ComboboxContent className="w-[min(18rem,calc(100vw-1.5rem))] min-w-0">
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

export function OwnedToggle({
  value,
  disabled,
  onChange,
  choices = OWNED_CHOICES.map((choice) => choice.value),
  className,
}: {
  value: OwnedFilter;
  disabled: boolean;
  onChange: (value: OwnedFilter) => void;
  choices?: OwnedFilter[];
  className?: string;
}) {
  const options = OWNED_CHOICES.filter((choice) => choices.includes(choice.value));
  return (
    <div
      role="radiogroup"
      aria-label="Owned"
      className={cn(
        "inline-flex h-9 max-w-full items-center rounded-full border border-white/10 bg-white/[0.04] p-1",
        disabled && "opacity-50",
        className,
      )}
    >
      {options.map((choice) => {
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

const SORT_CHOICES: { value: CatalogSort; label: string }[] = [
  { value: "rarity", label: "Rarity" },
  { value: "name", label: "Name" },
  { value: "added", label: "Newest" },
  { value: "desired", label: "Most desired" },
];

export function SortToggle({
  value,
  onChange,
  field = false,
}: {
  value: CatalogSort;
  onChange: (value: CatalogSort) => void;
  field?: boolean;
}) {
  const current = SORT_CHOICES.find((choice) => choice.value === value) ?? SORT_CHOICES[0];
  const custom = value !== "rarity";
  return (
    <Combobox
      items={SORT_CHOICES.map((choice) => choice.label)}
      value={current.label}
      filter={null}
      onValueChange={(next: string | null) => {
        const choice = SORT_CHOICES.find((item) => item.label === next);
        if (choice) onChange(choice.value);
      }}
    >
      <ComboboxTrigger
        aria-label={`Sort, ${current.label}`}
        className={cn(
          "h-9 items-center border text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          field
            ? "flex w-full min-w-0 gap-2 rounded-xl px-3 text-left"
            : "inline-flex gap-1.5 rounded-full px-3.5 font-medium",
          custom
            ? "border-amber-200/40 bg-amber-200/[0.1] text-amber-50"
            : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white",
        )}
      >
        {field ? null : "Sort"}
        <span
          className={cn(
            "truncate",
            field ? "min-w-0 flex-1" : "max-w-36",
            custom ? "text-amber-100/75" : field ? "text-white/80" : "text-white/55",
          )}
        >
          {current.label}
        </span>
      </ComboboxTrigger>
      <ComboboxContent className={field ? "w-[min(18rem,calc(100vw-1.5rem))] min-w-0" : "w-44"}>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export function FilterChip({ prefix, label, onRemove }: { prefix?: string; label: string; onRemove: () => void }) {
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

export function Switch({
  checked,
  disabled,
  onChange,
  labelledBy,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  labelledBy: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "border-emerald-300/50 bg-emerald-300" : "border-white/15 bg-white/[0.08]",
      )}
    >
      <span
        className={cn(
          "size-[18px] rounded-full shadow transition-transform",
          checked ? "translate-x-[22px] bg-emerald-950" : "translate-x-[3px] bg-white/80",
        )}
      />
    </button>
  );
}

export interface OwnedControls {
  ready: boolean;
  problem: string | null;
  syncHint: string;
  syncing: boolean;
  syncDisabled: boolean;
  onSync: () => void;
}

function OwnedField({
  value,
  disabled,
  choices = OWNED_CHOICES.map((choice) => choice.value),
  onChange,
}: {
  value: OwnedFilter;
  disabled: boolean;
  choices?: OwnedFilter[];
  onChange: (value: OwnedFilter) => void;
}) {
  const options = OWNED_CHOICES.filter((choice) => choices.includes(choice.value));
  const current = options.find((choice) => choice.value === value) ?? options[0];
  const custom = current.value !== "all";
  return (
    <Combobox
      items={options.map((choice) => choice.label)}
      value={current.label}
      disabled={disabled}
      filter={null}
      onValueChange={(next: string | null) => {
        const choice = options.find((item) => item.label === next);
        if (choice) onChange(choice.value);
      }}
    >
      <ComboboxTrigger
        aria-label={`Collection, ${current.label}`}
        className={cn(
          "flex h-9 w-full min-w-0 items-center gap-2 rounded-xl border px-3 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          custom
            ? "border-amber-200/40 bg-amber-200/[0.08] text-amber-50"
            : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", custom ? "text-amber-100/75" : "text-white/80")}>{current.label}</span>
      </ComboboxTrigger>
      <ComboboxContent className="w-[min(18rem,calc(100vw-1.5rem))] min-w-0">
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function SyncCollectionButton({ controls, className }: { controls: OwnedControls; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex rounded-full",
            controls.syncDisabled && "cursor-not-allowed outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
          tabIndex={controls.syncDisabled ? 0 : undefined}
          aria-label={controls.syncDisabled ? controls.syncHint : undefined}
        >
          <Button
            variant="ghost"
            size="icon"
            className={cn("rounded-full text-white/70", className)}
            aria-label="Sync collection"
            disabled={controls.syncDisabled}
            onClick={controls.onSync}
          >
            <RefreshCw className={cn(controls.syncing && "animate-spin")} />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{controls.syncHint}</TooltipContent>
    </Tooltip>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <span className="px-1 text-xs font-medium text-white/50">{children}</span>;
}

export function FilterBar({
  options,
  counts,
  filters,
  onChange,
  ownedControls,
  ownedChoices,
  shown,
  total,
  query,
  onClearQuery,
  sort,
  onSort,
  noun = "cards",
  showCount = true,
}: {
  options: Record<FacetId, string[]>;
  counts: Record<FacetId, Map<string, number>>;
  filters: Filters;
  onChange: (filters: Filters) => void;
  ownedControls: OwnedControls | null;
  ownedChoices?: OwnedFilter[];
  shown: number | null;
  total: number;
  query?: string;
  onClearQuery?: () => void;
  sort?: CatalogSort;
  onSort?: (sort: CatalogSort) => void;
  noun?: string;
  showCount?: boolean;
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
    <section aria-label="Filters" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-3 xl:hidden">
        <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-4 sm:gap-x-3">
          {FACETS.map((facet) => (
            <label key={facet.id} className="flex min-w-0 flex-col gap-1">
              <FieldLabel>{facet.label}</FieldLabel>
              <FacetFilter
                field
                label={facet.label}
                options={options[facet.id]}
                counts={counts[facet.id]}
                selected={filters.facets[facet.id]}
                onChange={(values) => setFacet(facet.id, values)}
              />
            </label>
          ))}
          {sort && onSort ? (
            <label className="col-span-2 flex min-w-0 flex-col gap-1">
              <FieldLabel>Sort</FieldLabel>
              <SortToggle field value={sort} onChange={onSort} />
            </label>
          ) : null}
          {ownedControls ? (
            <div className={cn("col-span-2 flex min-w-0 items-end gap-1", sort && onSort ? undefined : "sm:col-span-4")}>
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <FieldLabel>Collection</FieldLabel>
                <OwnedField
                  value={filters.owned}
                  disabled={!ownedControls.ready}
                  choices={ownedChoices}
                  onChange={(value) => onChange({ ...filters, owned: value })}
                />
              </label>
              <SyncCollectionButton controls={ownedControls} className="size-9" />
            </div>
          ) : null}
        </div>
      </div>
      <div className="hidden flex-wrap items-center gap-2 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-2 xl:flex">
        <span className="inline-flex items-center gap-1.5 pr-1 pl-2.5 text-sm font-semibold text-white/55">
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
        {ownedControls || onSort ? (
          <div className="ml-auto flex items-center gap-1">
            {sort && onSort ? <SortToggle value={sort} onChange={onSort} /> : null}
            {ownedControls ? (
              <>
                <OwnedToggle
                  value={filters.owned}
                  disabled={!ownedControls.ready}
                  choices={ownedChoices}
                  onChange={(value) => onChange({ ...filters, owned: value })}
                />
                <SyncCollectionButton controls={ownedControls} />
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {ownedControls?.problem ? <p className="px-3 text-xs text-white/55">{ownedControls.problem}</p> : null}
      {!showCount && !active ? null : (
      <div className="flex min-h-7 flex-wrap items-center gap-2 px-1 text-sm">
        {showCount ? (
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
        ) : null}
        {search && onClearQuery ? <FilterChip prefix="Search" label={`“${search}”`} onRemove={onClearQuery} /> : null}
        {ownedActive ? (
          <FilterChip
            label={filters.owned === "owned" ? "Owned" : filters.owned === "missing" ? "Not owned" : "Duplicates"}
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
      )}
    </section>
  );
}

export function ToggleAction({
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

export function CatalogActions({
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
