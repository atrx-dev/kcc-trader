import type { Trader } from "./lists.ts";

const INACTIVE_AFTER = 30 * 24 * 60 * 60 * 1000;

export interface ProfileLists {
  forTrade: string[];
  wishlist: string[];
  accepting: boolean;
  trader: Trader;
}

export interface ProfileEmbed {
  title: string;
  description: string;
  image: string | null;
}

export function profileEmbed(lists: ProfileLists | null): ProfileEmbed {
  if (!lists) {
    return {
      title: "No lists here",
      description: "This trader hasn't shared any lists on KCC Trader yet.",
      image: null,
    };
  }
  const { trader } = lists;
  const parts = [`@${trader.username}`];
  if (trader.kccName) parts.push(`${trader.kccName} on KCC`);
  parts.push(`${lists.forTrade.length.toLocaleString("en-US")} for trade`);
  parts.push(`${lists.wishlist.length.toLocaleString("en-US")} wishlist`);
  const inactive = trader.lastSeenAt != null && Date.now() - trader.lastSeenAt >= INACTIVE_AFTER;
  if (!lists.accepting) parts.push("Not accepting trades");
  else if (inactive) parts.push("Inactive");
  return { title: trader.name, description: parts.join(" · "), image: embedAvatar(trader.avatarUrl) };
}

function embedAvatar(url: string): string | null {
  if (!url.startsWith("https://")) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "cdn.discordapp.com" && parsed.pathname.startsWith("/avatars/")) {
      parsed.searchParams.set("size", "128");
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function profileHead(embed: ProfileEmbed, pageUrl: string): string {
  const tags = [
    `<meta property="og:type" content="profile" />`,
    `<meta property="og:site_name" content="KCC Trader" />`,
    `<meta property="og:title" content="${escapeAttr(embed.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(embed.description)}" />`,
    `<meta property="og:url" content="${escapeAttr(pageUrl)}" />`,
    `<meta name="description" content="${escapeAttr(embed.description)}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${escapeAttr(embed.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(embed.description)}" />`,
    `<meta name="theme-color" content="#e7c27a" />`,
  ];
  if (embed.image) {
    tags.push(
      `<meta property="og:image" content="${escapeAttr(embed.image)}" />`,
      `<meta property="og:image:alt" content="${escapeAttr(embed.title)}" />`,
      `<meta property="og:image:width" content="128" />`,
      `<meta property="og:image:height" content="128" />`,
      `<meta name="twitter:image" content="${escapeAttr(embed.image)}" />`,
    );
  }
  return tags.join("\n    ");
}

export function withProfileMeta(response: Response, embed: ProfileEmbed, pageUrl: string): Response {
  const title = `${embed.title} · KCC Trader`;
  const rewritten = new HTMLRewriter()
    .on("head", {
      element(element) {
        element.append(profileHead(embed, pageUrl), { html: true });
      },
    })
    .on("title", {
      element(element) {
        element.setInnerContent(title);
      },
    })
    .transform(response);
  const headers = new Headers(rewritten.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "public, max-age=120");
  headers.delete("content-length");
  return new Response(rewritten.body, { status: rewritten.status, headers });
}
