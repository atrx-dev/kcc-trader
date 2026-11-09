import { cn } from "@/lib/utils";
import type { Page } from "../model.ts";
import { BrandLink, TradeMark } from "./brand.tsx";

const LINKS: { page: Page; href: string; label: string }[] = [
  { page: "help", href: "/help", label: "Help" },
  { page: "terms", href: "/terms", label: "Terms of service" },
  { page: "privacy", href: "/privacy", label: "Privacy policy" },
];

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
              Fan-made for Koi Card Collector players. Not affiliated with KCC or Discord.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-2 lg:justify-end">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                aria-current={page === link.page ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onOpen(link.page, link.href);
                }}
                className={cn(
                  "rounded-2xl border px-3.5 py-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                  page === link.page
                    ? "border-amber-200/30 bg-amber-200/10 text-amber-50"
                    : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                {link.label}
              </a>
            ))}
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
            Found a bug? Message{" "}
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
