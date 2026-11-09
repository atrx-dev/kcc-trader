import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Page } from "../model.ts";

const LINKS: { page: Page; href: string; label: string }[] = [
  { page: "help", href: "/help", label: "Help" },
  { page: "terms", href: "/terms", label: "Terms of service" },
  { page: "privacy", href: "/privacy", label: "Privacy policy" },
];

export function SiteFooter({
  page,
  catalogSyncedAt,
  onOpen,
}: {
  page: Page;
  catalogSyncedAt?: string | null;
  onOpen: (page: Page, href: string) => void;
}) {
  return (
    <footer className="mt-auto border-t border-white/[0.08] bg-[radial-gradient(80%_120%_at_10%_0%,rgba(243,213,143,0.08),transparent_45%),radial-gradient(70%_100%_at_90%_100%,rgba(186,176,255,0.1),transparent_50%),linear-gradient(180deg,#161325,#12101f)]">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 pt-8 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:pb-10 md:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <a
              href="/"
              aria-label="KCC Trader"
              className="inline-flex items-center gap-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/50">
              A fan-made helper for finding Koi Card Collector trades. Not affiliated with KCC or Discord.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-1 gap-y-1 sm:justify-end">
            {LINKS.map((link, index) => (
              <span key={link.href} className="contents">
                {index > 0 ? <span className="px-1.5 text-white/20" aria-hidden="true">·</span> : null}
                <FooterLink
                  href={link.href}
                  active={page === link.page}
                  onClick={() => onOpen(link.page, link.href)}
                >
                  {link.label}
                </FooterLink>
              </span>
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

function FooterLink({
  href,
  children,
  onClick,
  active,
}: {
  href: string;
  children: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      className={cn(
        "rounded-full px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "bg-white/[0.08] text-white" : "text-white/65 hover:bg-white/[0.06] hover:text-white",
      )}
    >
      {children}
    </a>
  );
}
