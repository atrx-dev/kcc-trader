import { CircleHelp, Scale, Shield, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Page } from "../model.ts";
import { BrandLink, TradeMark } from "./brand.tsx";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2C6.477 2 2 6.584 2 12.253c0 4.526 2.865 8.363 6.839 9.718.5.094.682-.222.682-.493 0-.243-.009-.888-.014-1.743-2.782.62-3.369-1.375-3.369-1.375-.454-1.184-1.11-1.5-1.11-1.5-.908-.638.069-.625.069-.625 1.004.072 1.532 1.057 1.532 1.057.892 1.568 2.341 1.115 2.91.853.091-.663.35-1.115.636-1.372-2.22-.259-4.555-1.143-4.555-5.086 0-1.123.39-2.042 1.029-2.762-.103-.26-.446-1.302.098-2.714 0 0 .84-.276 2.75 1.055A9.32 9.32 0 0 1 12 6.912a9.32 9.32 0 0 1 2.504.346c1.909-1.331 2.748-1.055 2.748-1.055.546 1.412.203 2.454.1 2.714.64.72 1.028 1.639 1.028 2.762 0 3.952-2.338 4.824-4.566 5.078.359.317.679.943.679 1.901 0 1.372-.012 2.479-.012 2.816 0 .273.18.591.688.491C19.138 20.613 22 16.777 22 12.253 22 6.584 17.523 2 12 2Z" />
    </svg>
  );
}

const LINKS: { page: Page; href: string; label: string; icon: LucideIcon }[] = [
  { page: "help", href: "/help", label: "Help", icon: CircleHelp },
  { page: "terms", href: "/terms", label: "Terms of service", icon: Scale },
  { page: "privacy", href: "/privacy", label: "Privacy policy", icon: Shield },
];

const linkClass = (active?: boolean) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
    active
      ? "border-amber-200/30 bg-amber-200/10 text-amber-50"
      : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.06] hover:text-white",
  );

export function SiteFooter({
  page,
  catalogSyncedAt,
  onOpen,
  className,
}: {
  page: Page;
  catalogSyncedAt?: string | null;
  onOpen: (page: Page, href: string) => void;
  className?: string;
}) {
  return (
    <footer className={cn("mt-auto relative overflow-hidden border-t border-white/[0.08]", className)}>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(55%_80%_at_0%_0%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(50%_70%_at_100%_100%,rgba(253,231,176,0.07),transparent_55%),linear-gradient(180deg,#16141f,#100e16)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.28),rgba(253,231,176,0.25),transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-6 right-[12%] size-24 rounded-full bg-white/5 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-[30%] size-32 rounded-full bg-amber-200/6 blur-3xl"
      />
      <TradeMark className="pointer-events-none absolute -right-8 -bottom-16 size-64 opacity-[0.07] select-none sm:-right-6 sm:-bottom-20 sm:size-80" />

      <div className="relative mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 pt-10 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:pb-12 md:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-xl">
            <BrandLink onOpen={onOpen} size="lg" />
            <p className="mt-4 max-w-md font-display text-lg leading-snug font-semibold tracking-tight text-white/70">
              Find the trade. Keep the collection moving.
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/45">
              Fan-made for Koi Card Collector players. Not affiliated with KCC or Discord.{" "}
              <a
                href="https://github.com/atrx-dev/kcc-trader"
                target="_blank"
                rel="noreferrer"
                className="text-white/55 outline-none transition-colors hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Open source on GitHub
              </a>
              .
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-2 lg:justify-end">
            {LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={page === link.page ? "page" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpen(link.page, link.href);
                  }}
                  className={linkClass(page === link.page)}
                >
                  <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden="true" />
                  {link.label}
                </a>
              );
            })}
            <a
              href="https://github.com/atrx-dev/kcc-trader"
              target="_blank"
              rel="noreferrer"
              className={linkClass()}
            >
              <GitHubIcon className="size-3.5 shrink-0 opacity-80" />
              GitHub
            </a>
          </nav>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/[0.08] pt-4 text-xs leading-relaxed text-white/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p>
            Card data and art from{" "}
            <a
              href="https://koi-card-collector.com"
              target="_blank"
              rel="noreferrer"
              className="text-white/55 outline-none transition-colors hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Koi Card Collector
            </a>
            {catalogSyncedAt ? ` · synced ${catalogSyncedAt}` : ""}
          </p>
          <p>
            Found a bug?{" "}
            <a
              href="https://github.com/atrx-dev/kcc-trader/issues/new"
              target="_blank"
              rel="noreferrer"
              className="text-white/55 outline-none transition-colors hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Open a GitHub issue
            </a>{" "}
            or message{" "}
            <a
              href="https://discord.com/users/204699700316602369"
              target="_blank"
              rel="noreferrer"
              className="text-white/55 outline-none transition-colors hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              @atrx
            </a>{" "}
            on Discord.
          </p>
        </div>
      </div>
    </footer>
  );
}
