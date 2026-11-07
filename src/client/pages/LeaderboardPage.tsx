import { useEffect, useState } from "react";
import { Award, Crown, Medal, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { leaderboardHref, type LeaderboardBy } from "../model.ts";
import { EmptyState } from "../components/common.tsx";

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  kccName: string | null;
  sss: number;
  level: number;
  value: number;
}

const BOARDS: { id: LeaderboardBy; label: string; short?: string }[] = [
  { id: "sss", label: "SSS" },
  { id: "value", label: "Collection value", short: "Value" },
  { id: "level", label: "Level" },
];

const RANK_TONE = ["text-amber-200", "text-slate-200", "text-orange-300"];

function score(entry: LeaderboardEntry, by: LeaderboardBy): number {
  return entry[by];
}

function scoreLabel(by: LeaderboardBy): string {
  if (by === "sss") return "SSS";
  if (by === "level") return "level";
  return "value";
}

export function LeaderboardPage({
  by,
  onBy,
  userId,
  onOpenProfile,
}: {
  by: LeaderboardBy;
  onBy: (by: LeaderboardBy) => void;
  userId: string | null;
  onOpenProfile: (id: string) => void;
}) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; traders: LeaderboardEntry[] }>({
    status: "loading",
    traders: [],
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/leaderboard?by=${by}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load the leaderboard");
        return response.json() as Promise<{ traders: LeaderboardEntry[] }>;
      })
      .then((data) => setState({ status: "ready", traders: data.traders }))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setState({ status: "error", traders: [] });
      });
    return () => controller.abort();
  }, [by]);

  useEffect(() => {
    document.title = "Leaderboard · KCC Trader";
    return () => {
      document.title = "KCC Trader";
    };
  }, []);

  const blurb =
    by === "value"
      ? "Public collections, ranked by collection value."
      : by === "level"
        ? "Public collections, ranked by KCC level."
        : "Public collections, ranked by SSS cards.";

  return (
    <>
      <section className="flex items-center gap-4 rounded-[1.75rem] border border-white/10 bg-[radial-gradient(110%_130%_at_0%_0%,rgba(243,213,143,0.18),transparent_55%),linear-gradient(160deg,#221a37,#141224)] px-5 py-4 md:px-8 md:py-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-200/15 text-amber-200">
          <Trophy className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl leading-tight font-extrabold tracking-tight md:text-3xl">Leaderboard</h1>
          <p className="text-sm text-white/65">{blurb}</p>
        </div>
      </section>

      <div role="tablist" aria-label="Leaderboard ranking" className="grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
        {BOARDS.map((item) => {
          const active = by === item.id;
          return (
            <a
              key={item.id}
              href={leaderboardHref(item.id)}
              role="tab"
              aria-selected={active}
              onClick={(event) => {
                event.preventDefault();
                onBy(item.id);
              }}
              className={cn(
                "flex h-9 min-w-0 items-center justify-center rounded-full px-2 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? "bg-[#f3d58f] text-[#1b1509]" : "text-white/70 hover:bg-white/[0.07] hover:text-white",
              )}
            >
              <span className="sm:hidden">{item.short ?? item.label}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </a>
          );
        })}
      </div>

      {state.status === "loading" ? (
        <div className="grid gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-[72px] rounded-2xl bg-white/[0.05]" />
          ))}
        </div>
      ) : state.status === "error" ? (
        <EmptyState icon={Trophy} title="Couldn't load the leaderboard">
          Something went wrong. Try again in a moment.
        </EmptyState>
      ) : state.traders.length === 0 ? (
        <EmptyState icon={Trophy} title="No collections on the board yet">
          A trader shows up here after they visit with a public KCC collection.
        </EmptyState>
      ) : (
        <ol className="grid gap-2">
          {state.traders.map((trader) => {
            const value = score(trader, by);
            const own = trader.id === userId;
            const RankIcon = trader.rank === 1 ? Crown : trader.rank === 2 ? Medal : trader.rank === 3 ? Award : null;
            return (
              <li key={trader.id} className="min-w-0">
                <a
                  href={`/u/${trader.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenProfile(trader.id);
                  }}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-2xl border py-3 pr-5 pl-2.5 outline-none transition-colors hover:bg-white/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50 sm:gap-3 sm:pr-6 sm:pl-3 md:gap-4 md:pr-7 md:pl-4",
                    own ? "border-amber-200/40 bg-amber-200/[0.06]" : "border-white/10 bg-white/[0.03]",
                  )}
                >
                  <span
                    className={cn(
                      "grid w-8 shrink-0 place-items-center font-display text-lg font-extrabold tabular-nums sm:w-10",
                      RANK_TONE[trader.rank - 1] ?? "text-white/45",
                    )}
                  >
                    {RankIcon ? <RankIcon className="size-5" aria-hidden="true" /> : trader.rank}
                    <span className="sr-only">Rank {trader.rank}</span>
                  </span>
                  <Avatar className="size-9 sm:size-11">
                    <AvatarImage src={trader.avatarUrl} alt="" />
                    <AvatarFallback>{trader.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="min-w-0 truncate font-semibold">{trader.name}</span>
                      {own ? (
                        <span className="rounded-full bg-amber-200/15 px-2 py-0.5 text-[0.7rem] font-semibold text-amber-100">
                          You
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-sm text-white/55">
                      @{trader.username}
                      {trader.kccName ? ` · ${trader.kccName}` : ""}
                      {by === "sss" ? ` · Level ${trader.level.toLocaleString()}` : ` · ${trader.sss.toLocaleString()} SSS`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-lg leading-none font-extrabold tabular-nums sm:text-xl">
                      {value.toLocaleString()}
                    </span>
                    <span className="mt-1 block text-xs text-white/55">{scoreLabel(by)}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
