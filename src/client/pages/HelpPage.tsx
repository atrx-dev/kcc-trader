import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import type { Page } from "../model.ts";

const ARTICLES = [
  { id: "sync", label: "Make your collection sync" },
  { id: "lists", label: "For trade and Wishlist" },
  { id: "trades", label: "Finding a trade" },
  { id: "catalog", label: "Browsing the catalog" },
] as const;

export function HelpPage({ onOpen }: { onOpen: (page: Page, href: string) => void }) {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <section className="flex items-center gap-4 rounded-[1.75rem] border border-white/10 bg-[radial-gradient(110%_130%_at_0%_0%,rgba(186,176,255,0.18),transparent_55%),linear-gradient(160deg,#1c1833,#141224)] px-5 py-4 md:px-8 md:py-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-200/15 text-violet-200">
          <CircleHelp className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl leading-tight font-extrabold tracking-tight md:text-3xl">Help</h1>
          <p className="text-sm text-white/65">How syncing, lists, and trades work.</p>
        </div>
      </section>

      <nav aria-label="Help articles" className="flex flex-wrap gap-2">
        {ARTICLES.map((article) => (
          <a
            key={article.id}
            href={`#${article.id}`}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/75 outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {article.label}
          </a>
        ))}
      </nav>

      <Article id="sync" title="Make your collection sync">
        <p>
          Sign in with Discord. Your lists are saved on that account, and your collection is read from Koi Card
          Collector.
        </p>
        <p>
          KCC Trader can only read a public profile. On KCC, open your profile, choose Edit profile, and turn on{" "}
          <strong className="font-semibold text-white">Show my collection to other players</strong>.
        </p>
        <p>
          Your collection syncs when you sign in, when you visit and the last sync was more than 3 hours ago, and when
          you press the sync button. The button waits an hour between tries. While it is waiting, its tooltip says when
          the next sync is.
        </p>
        <p>
          After you make the profile public, the first-visit popup can sync right away: open your KCC profile from it,
          then choose <strong className="font-semibold text-white">I've made it public</strong>. The notice at the top
          of the page can open that popup again.
        </p>
      </Article>

      <Article id="lists" title="For trade and Wishlist">
        <p>
          <PageLink page="forTrade" href="/for-trade" onOpen={onOpen}>
            For trade
          </PageLink>{" "}
          is cards you're happy to give away. You can only list cards you own, and the search on that page only offers
          cards from your collection.
        </p>
        <p>
          <PageLink page="wishlist" href="/wishlist" onOpen={onOpen}>
            Wishlist
          </PageLink>{" "}
          is cards you're hunting for. Other traders see both lists on your public page.{" "}
          <strong className="font-semibold text-white">Priority</strong> marks the ones you want most. Star them in the
          catalog or on your Wishlist. Those stay at the top, and the star shows on your page and in trades.
        </p>
        <p>
          <strong className="font-semibold text-white">List duplicates for trade</strong> is off until you turn it on
          in Settings. While it's on, a sync puts new spare SS and SSS copies on For trade, and takes them off once you
          no longer have a spare. Cards you add with List them follow the same rule. Cards you add yourself stay listed
          for as long as you own them.
        </p>
        <p>A card you no longer own always leaves For trade, however it was added.</p>
        <p>
          <strong className="font-semibold text-white">Clear owned from Wishlist</strong> is on by default. A sync takes
          a card off your Wishlist once your collection includes it. Turn the setting off to keep owned cards on the
          list until you remove them.
        </p>
      </Article>

      <Article id="trades" title="Finding a trade">
        <p>
          A match is a trader who has a card on your Wishlist and wants a card on your For trade list. Both lists need
          at least one card.
        </p>
        <p>
          <strong className="font-semibold text-white">Accepting trades</strong> is on by default. Turning it off hides
          you from other traders' matches, and your public page says you aren't taking offers. You can still look
          through your own matches.
        </p>
        <p>
          Traders who haven't opened KCC Trader in 30 days are left out of matches. Their page shows{" "}
          <strong className="font-semibold text-white">Inactive</strong>.
        </p>
        <p>
          Offer a trade on KCC opens that person's trade page there. Share lists, on your own page, copies a link to
          your public lists. Find a trader, in the header, searches display names, Discord usernames, and KCC names.
        </p>
      </Article>

      <Article id="catalog" title="Browsing the catalog">
        <p>
          Search covers the card name, variant, game, and developer. Rarity, type, game, and developer narrow the grid. A
          card new to the catalog in the last 7 days is marked New. Name sorts the catalog alphabetically. Newest
          sorts additions first, and cards from before that tracking started stay in rarity order after them.
        </p>
        <p>
          Once your collection has synced, Owned and Not owned split the catalog by what you have. Duplicates shows SS
          and SSS cards you have more than one copy of. For trade only offers All and Duplicates, because every card
          there is one you own.
        </p>
        <p>
          Hidden rarities, in Settings, drop out of the catalog, your lists, and search. At least one rarity stays
          visible. The counts on the catalog banner still include every card.
        </p>
        <p>
          Card effects are the foil shine and sparkles. Turn them off in Settings if the page feels slow. Default
          catalog filters there are applied when you open the catalog without filters in the link. New features, also
          in Settings, shows a note the first time you open the site while signed in after something new is added. If more than one
          piled up, the newest one comes first and you can step through the rest. Show what's new opens those notes again.
        </p>
      </Article>
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
