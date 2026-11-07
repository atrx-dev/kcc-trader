import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CircleHelp, LogIn, LogOut, Search, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PAGES, type Page, type SessionUser, type Trader } from "../model.ts";

export function formatSyncedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function Brand({ onOpen }: { onOpen: (page: Page, href: string) => void }) {
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

export function NavTabs({
  page,
  counts,
  attention,
  onOpen,
  className,
  stacked = false,
}: {
  page: Page;
  counts: Record<Page, number | null>;
  attention?: Partial<Record<Page, boolean>>;
  onOpen: (page: Page, href: string) => void;
  className?: string;
  stacked?: boolean;
}) {
  return (
    <nav
      aria-label="Sections"
      className={cn(
        "border border-white/10 bg-white/[0.04] p-1",
        stacked ? "grid grid-cols-4 gap-1 rounded-2xl" : "flex items-center gap-1 rounded-full",
        className,
      )}
    >
      {PAGES.map((item) => {
        const active = page === item.id;
        const Icon = item.icon;
        const count = counts[item.id];
        const fresh = attention?.[item.id] === true && count !== null && count > 0;
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
              "flex min-w-0 items-center justify-center font-medium whitespace-nowrap transition-colors",
              stacked
                ? "h-[52px] flex-col gap-1 rounded-xl text-[0.7rem]"
                : "h-9 flex-1 gap-2 rounded-full px-3.5 text-sm lg:flex-none",
              active
                ? "bg-[#f3d58f] text-[#1b1509] shadow-[0_8px_22px_-10px_rgba(243,213,143,0.8)]"
                : "text-white/70 hover:bg-white/[0.07] hover:text-white",
            )}
          >
            <span className="relative shrink-0">
              <Icon className={cn(stacked ? "size-[18px]" : "size-4", active ? "text-[#1b1509]" : item.tone)} />
              {stacked && item.id !== "catalog" && count !== null && count > 0 ? (
                <span
                  className={cn(
                    "absolute -top-1.5 left-3 min-w-4 rounded-full px-1 text-center text-[0.6rem] leading-4 font-bold tabular-nums",
                    active ? "bg-[#1b1509] text-[#f3d58f]" : fresh ? "bg-emerald-300 text-emerald-950" : "bg-white/90 text-[#151223]",
                  )}
                >
                  {count > 99 ? "99+" : count}
                  {fresh ? <span className="sr-only">, new</span> : null}
                </span>
              ) : null}
            </span>
            <span className="truncate">{item.label}</span>
            {count !== null && !stacked ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[0.7rem] leading-none font-semibold tabular-nums",
                  active ? "bg-black/15" : fresh ? "bg-emerald-300 text-emerald-950" : "bg-white/10 text-white/70",
                )}
              >
                {count.toLocaleString()}
                {fresh ? <span className="sr-only">, new</span> : null}
              </span>
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}

export function TraderSearch({ onOpen }: { onOpen: (page: Page, href: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [traders, setTraders] = useState<Trader[] | null>(null);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const needle = query.trim();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    if (needle.length < 2) {
      setTraders(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/traders?q=${encodeURIComponent(needle)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error("search failed"))))
        .then((body: { traders?: Trader[] }) => {
          setTraders(body.traders ?? []);
          setActive(0);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setTraders([]);
        });
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [needle]);

  function choose(trader: Trader) {
    setOpen(false);
    setQuery("");
    setTraders(null);
    onOpen("profile", `/u/${trader.id}`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!traders || traders.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + traders.length) % traders.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const trader = traders[Math.min(active, traders.length - 1)];
      if (trader) choose(trader);
    }
  }

  return (
    <div ref={rootRef} className="sm:relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            aria-label="Find a trader"
            aria-expanded={open}
            aria-controls={listId}
            className={cn("rounded-full text-white/70", open && "bg-white/10 text-white")}
            onClick={() => setOpen((current) => !current)}
          >
            <Search />
            <span className="hidden xl:inline">Find a trader</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Find a trader</TooltipContent>
      </Tooltip>
      {open ? (
        <div className="absolute top-full right-4 left-4 z-50 mt-2 rounded-2xl border border-white/10 bg-[#1c1830] p-2 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.8)] sm:top-auto sm:right-0 sm:left-auto sm:w-[min(22rem,calc(100vw-2rem))]">
          <input
            autoFocus
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={traders?.[active] ? `${listId}-${traders[active].id}` : undefined}
            aria-label="Search traders"
            value={query}
            placeholder="Name, Discord, or KCC name"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            className="h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm outline-none placeholder:text-white/40 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
          />
          <div id={listId} role="listbox" aria-label="Traders" className="mt-1">
            {needle.length < 2 ? (
              <p className="px-2 py-3 text-sm text-white/45">Type at least 2 characters.</p>
            ) : traders === null ? (
              <p className="px-2 py-3 text-sm text-white/45">Searching…</p>
            ) : traders.length === 0 ? (
              <p className="px-2 py-3 text-sm text-white/45">No traders match.</p>
            ) : (
              traders.map((trader, index) => (
                <button
                  key={trader.id}
                  id={`${listId}-${trader.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(trader)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left outline-none",
                    index === active ? "bg-white/10" : "hover:bg-white/[0.06]",
                  )}
                >
                  <Avatar className="size-8">
                    <AvatarImage src={trader.avatarUrl} alt="" />
                    <AvatarFallback>{trader.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{trader.name}</span>
                    <span className="block truncate text-xs text-white/50">
                      @{trader.username}
                      {trader.kccName ? ` · ${trader.kccName} on KCC` : ""}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function HelpButton({ onOpen }: { onOpen: (page: Page, href: string) => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="ghost" size="icon" className="rounded-full text-white/70">
          <a
            href="/help"
            aria-label="Help"
            onClick={(event) => {
              event.preventDefault();
              onOpen("help", "/help");
            }}
          >
            <CircleHelp />
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Help</TooltipContent>
    </Tooltip>
  );
}

export function AccountMenu({
  user,
  privateProfile,
  onOpen,
}: {
  user: SessionUser | null;
  privateProfile: boolean;
  onOpen: (page: Page, href: string) => void;
}) {
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
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={`/u/${user.id}`}
            aria-label="Your public lists"
            onClick={(event) => {
              event.preventDefault();
              onOpen("profile", `/u/${user.id}`);
            }}
            className="group flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="hidden text-right leading-tight whitespace-nowrap sm:block">
              <p className="text-sm font-semibold group-hover:text-amber-100">{label}</p>
              <p className="text-xs text-white/55">
                {user.profile
                  ? privateProfile
                    ? "Private KCC profile"
                    : `Level ${user.profile.level}`
                  : "No public KCC profile"}
              </p>
            </div>
            <Avatar className="size-9 ring-2 ring-amber-200/50 ring-offset-2 ring-offset-[#151223] transition group-hover:ring-amber-200">
              <AvatarImage src={user.avatarUrl} alt="" />
              <AvatarFallback>{label.slice(0, 1)}</AvatarFallback>
            </Avatar>
          </a>
        </TooltipTrigger>
        <TooltipContent>Your public lists</TooltipContent>
      </Tooltip>
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
