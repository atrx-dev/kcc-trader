import type { ReactNode } from "react";
import { ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Page } from "../model.ts";

const SECTIONS = [
  { id: "service", label: "The service" },
  { id: "accounts", label: "Accounts" },
  { id: "conduct", label: "Conduct" },
  { id: "trades", label: "Trades" },
  { id: "availability", label: "Availability" },
  { id: "changes", label: "Changes" },
] as const;

export function TermsPage({
  onOpen,
  embedded = false,
}: {
  onOpen: (page: Page, href: string) => void;
  embedded?: boolean;
}) {
  return (
    <div className={cn("mx-auto grid w-full gap-6", embedded ? "max-w-none gap-4" : "max-w-3xl")}>
      {embedded ? (
        <p className="text-xs text-white/45">Effective November 9, 2026</p>
      ) : (
        <section className="flex items-center gap-4 rounded-[1.75rem] border border-white/10 bg-[radial-gradient(110%_130%_at_0%_0%,rgba(186,176,255,0.18),transparent_55%),linear-gradient(160deg,#1c1833,#141224)] px-5 py-4 md:px-8 md:py-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-200/15 text-violet-200">
            <ScrollText className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-tight font-extrabold tracking-tight md:text-3xl">
              Terms of service
            </h1>
            <p className="text-sm text-white/65">The rules for using KCC Trader.</p>
            <p className="mt-1 text-xs text-white/45">Effective November 9, 2026</p>
          </div>
        </section>
      )}

      <nav aria-label="Terms sections" className="flex flex-wrap gap-2">
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/75 outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <Article id="service" title="The service">
        <p>
          KCC Trader is a fan-made helper for finding card trades using public Koi Card Collector (KCC) collection data
          and the lists you keep here. It is not affiliated with, endorsed by, or operated by Koi Card Collector or
          Discord.
        </p>
        <p>
          By using the site you agree to these terms. If you do not agree, do not use KCC Trader.
        </p>
      </Article>

      <Article id="accounts" title="Accounts">
        <p>
          You sign in with Discord. You are responsible for the Discord account you use and for activity that happens
          while you are signed in.
        </p>
        <p>
          You can delete your KCC Trader account in Settings. We may also remove accounts that stay private and unused,
          or that we believe are being used in a way that harms the service or other traders, as described in the{" "}
          <PageLink page="privacy" href="/privacy" onOpen={onOpen}>
            privacy policy
          </PageLink>
          .
        </p>
      </Article>

      <Article id="conduct" title="Conduct">
        <p>
          Use the site for its intended purpose: managing trade lists and finding potential trades. Do not try to disrupt
          the service, scrape it aggressively, impersonate others, or use it to harass people.
        </p>
        <p>
          Public pages show the display names, avatars, and lists you publish through the site. Keep that content
          appropriate for a trading community.
        </p>
      </Article>

      <Article id="trades" title="Trades">
        <p>
          Matches and profile pages are tools to help traders find each other. KCC Trader does not complete trades, hold
          cards, mediate disputes, or guarantee that another trader will respond or honor an offer.
        </p>
        <p>
          Any trade you arrange happens between you and the other person, usually on KCC or elsewhere outside this site.
          Use your own judgment.
        </p>
      </Article>

      <Article id="availability" title="Availability">
        <p>
          The service is provided as is. Features may change, break, or go offline. Syncing depends on Discord login and
          on KCC remaining available and readable for public profiles.
        </p>
        <p>
          To the fullest extent allowed by law, KCC Trader and its operators are not liable for lost data, missed trades,
          downtime, or other damages that come from using or being unable to use the site.
        </p>
      </Article>

      <Article id="changes" title="Changes">
        <p>
          These terms may be updated from time to time. The effective date at the top of this page will change when they
          do. Continued use of the site after an update means you accept the revised terms.
        </p>
      </Article>

      <p className="text-sm text-white/55">
        How we handle account data is in the{" "}
        <PageLink page="privacy" href="/privacy" onOpen={onOpen}>
          privacy policy
        </PageLink>
        . For day-to-day use, see{" "}
        <PageLink page="help" href="/help" onOpen={onOpen}>
          Help
        </PageLink>
        .
      </p>
    </div>
  );
}

function Article({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <article id={id} className="scroll-mt-28 grid gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      <div className="grid gap-3 text-sm leading-relaxed text-white/70">{children}</div>
    </article>
  );
}

function PageLink({
  page,
  href,
  onOpen,
  children,
}: {
  page: Page;
  href: string;
  onOpen: (page: Page, href: string) => void;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onOpen(page, href);
      }}
      className="font-semibold text-white underline decoration-white/30 underline-offset-2 hover:decoration-white"
    >
      {children}
    </a>
  );
}
