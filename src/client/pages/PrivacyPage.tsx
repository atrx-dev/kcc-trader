import type { ReactNode } from "react";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Page } from "../model.ts";

const SECTIONS = [
  { id: "collect", label: "What we collect" },
  { id: "use", label: "How we use it" },
  { id: "public", label: "What others can see" },
  { id: "cookies", label: "Cookies and local storage" },
  { id: "third-parties", label: "Third parties" },
  { id: "retention", label: "Retention and deletion" },
] as const;

export function PrivacyPage({
  embedded = false,
}: {
  onOpen?: (page: Page, href: string) => void;
  embedded?: boolean;
}) {
  return (
    <div className={cn("mx-auto grid w-full gap-6", embedded ? "max-w-none gap-3" : "max-w-3xl")}>
      {embedded ? null : (
        <section className="flex items-center gap-4 rounded-[1.75rem] border border-white/10 bg-[radial-gradient(110%_130%_at_0%_0%,rgba(186,176,255,0.18),transparent_55%),linear-gradient(160deg,#1c1833,#141224)] px-5 py-4 md:px-8 md:py-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-200/15 text-violet-200">
            <Shield className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-tight font-extrabold tracking-tight md:text-3xl">
              Privacy policy
            </h1>
            <p className="text-sm text-white/65">How KCC Trader handles your account and trading data.</p>
            <p className="mt-1 text-xs text-white/45">Effective November 9, 2026</p>
          </div>
        </section>
      )}

      <nav
        aria-label="Privacy sections"
        className={cn(
          "flex gap-2",
          embedded
            ? "-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [mask-image:linear-gradient(90deg,#000_85%,transparent)] [&::-webkit-scrollbar]:hidden"
            : "flex-wrap",
        )}
      >
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            onClick={(event) => {
              if (!embedded) return;
              event.preventDefault();
              document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/75 outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <Article id="collect" title="What we collect" compact={embedded}>
        <p>
          When you sign in with Discord, we receive the identity Discord shares for the{" "}
          <strong className="font-semibold text-white">identify</strong> scope: your Discord user id, username, display
          name, and avatar. We do not ask Discord for your email, friends list, or guilds.
        </p>
        <p>
          If your Koi Card Collector (KCC) profile is linked to that Discord account, we also store your KCC profile id,
          KCC display name, and—when the collection is public—summary stats such as card counts, SSS count, level, and
          collection value, plus a cached copy of your owned cards used for syncing and trades.
        </p>
        <p>
          On KCC Trader we store the lists and preferences you set: For trade, Wishlist, priority stars, skipped and kept
          cards, whether you are accepting trades, and related list settings. We also record when you last used the site
          so inactive traders can be left out of matches.
        </p>
      </Article>

      <Article id="use" title="How we use it" compact={embedded}>
        <p>
          We use this data to keep you signed in, sync your collection, match trades, show public trader pages and the
          leaderboard, and remember the preferences you choose in Settings.
        </p>
        <p>We do not sell your personal information, and we do not use it for advertising.</p>
      </Article>

      <Article id="public" title="What others can see" compact={embedded}>
        <p>
          Your public trader page can show your display name, avatar, KCC name, For trade and Wishlist, whether you are
          accepting trades, and whether you look inactive. Traders with a public KCC collection can also appear in search
          and on the leaderboard with their synced collection stats.
        </p>
        <p>
          Traders whose KCC collection is private are kept out of public discovery and the leaderboard. Their account
          data on KCC Trader can still exist for their own lists until they delete it or it is purged as described below.
        </p>
      </Article>

      <Article id="cookies" title="Cookies and local storage" compact={embedded}>
        <p>
          After Discord sign-in we set an HttpOnly session cookie so the site can recognize you. It lasts up to 14 days.
          A short-lived cookie is used only during the Discord login redirect.
        </p>
        <p>
          Your browser may also keep local settings (for example hidden rarities and catalog defaults), which feature
          notes you have already seen, and which trade matches you have opened. That data stays on your device.
        </p>
      </Article>

      <Article id="third-parties" title="Third parties" compact={embedded}>
        <p>
          <strong className="font-semibold text-white">Discord</strong> authenticates you. Their handling of your Discord
          account is covered by Discord’s own privacy policy.
        </p>
        <p>
          <strong className="font-semibold text-white">Koi Card Collector</strong> is the source of public profile and
          collection data we sync. Their site and APIs are separate from KCC Trader.
        </p>
        <p>
          The app runs on <strong className="font-semibold text-white">Cloudflare</strong> (Workers, D1, and KV). Request
          handling and storage happen on that infrastructure.
        </p>
      </Article>

      <Article id="retention" title="Retention and deletion" compact={embedded}>
        <p>
          Account data stays while your trader record exists. Private traders who have not used the site for 30 days may
          be removed automatically, including their lists and synced collection cache.
        </p>
        <p>
          When you agree to the terms of service and this privacy policy, we store which version you accepted so we know
          you have seen the current rules.
        </p>
        <p>
          You can delete your account anytime in Settings → Delete account. That removes your trader row, lists, trade
          preferences, agreement record, and synced collection cache from KCC Trader, and signs you out. Catalog card
          data shared by everyone is not personal account data and is not deleted with your account.
        </p>
        <p>
          Browser local storage is not cleared by account deletion; you can remove it yourself in your browser if you
          want.
        </p>
      </Article>

    </div>
  );
}

function Article({
  id,
  title,
  children,
  compact = false,
}: {
  id: string;
  title: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <article
      id={id}
      className={cn(
        "grid gap-3 rounded-3xl border border-white/10 bg-white/[0.03]",
        compact ? "scroll-mt-3 p-4" : "scroll-mt-28 p-5 md:p-6",
      )}
    >
      <h2 className={cn("font-display font-bold tracking-tight", compact ? "text-lg" : "text-xl")}>{title}</h2>
      <div className="grid gap-3 text-sm leading-relaxed text-white/70">{children}</div>
    </article>
  );
}
