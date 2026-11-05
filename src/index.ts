import { beginDiscordLogin, finishDiscordLogin, logout, readSession, type AuthEnv, type SessionUser } from "./auth.ts";
import {
  changeLists,
  parseChanges,
  readLists,
  readPublicLists,
  setPreferences,
  syncLists,
  type ListChange,
  type ListSync,
  type Preferences,
  type Trader,
} from "./lists.ts";
import { isSpare, ownsCard, readOwned, SyncCooldownError, type OwnedResponse } from "./owned.ts";
import { discoverHiddenCards, readCatalog, stepCatalogSync } from "./sync.ts";
import { findTrades } from "./trades.ts";
import { cardKey } from "./types.ts";

function traderFor(user: SessionUser): Trader {
  return {
    id: user.id,
    name: user.globalName ?? user.username,
    username: user.username,
    avatarUrl: user.avatarUrl,
    kccName: user.profile?.name ?? null,
    kccId: user.profile?.id ?? null,
  };
}

async function syncOwnedLists(
  env: Env,
  userId: string,
  owned: OwnedResponse,
  allDuplicatesNew = false,
): Promise<ListSync | null> {
  if (!owned.complete || owned.hidden) return null;
  const duplicates =
    Object.keys(owned.duplicates ?? {}).length > 0
      ? (await readCatalog(env)).cards.map(cardKey).filter((key) => isSpare(owned.duplicates, key))
      : [];
  const previous = allDuplicatesNew ? {} : owned.previousDuplicates;
  const newDuplicates = previous ? duplicates.filter((key) => !isSpare(previous, key)) : [];
  return syncLists(env, userId, (key) => ownsCard(owned, key), duplicates, newDuplicates);
}

function changedLists(sync: ListSync | null): boolean {
  return Boolean(
    sync && (sync.removed.forTrade.length || sync.removed.wishlist.length || sync.unlisted.length || sync.added.length),
  );
}

interface Env extends AuthEnv {
  CARDS: KVNamespace;
  DB: D1Database;
  SYNC_TOKEN?: string;
}

function authorized(request: Request, env: Env): boolean {
  const token = env.SYNC_TOKEN;
  if (!token) return false;
  const encoder = new TextEncoder();
  const given = encoder.encode(request.headers.get("Authorization") ?? "");
  const expected = encoder.encode(`Bearer ${token}`);
  return given.byteLength === expected.byteLength && crypto.subtle.timingSafeEqual(given, expected);
}

function crossSite(request: Request, url: URL): boolean {
  if (request.method === "GET" || request.method === "HEAD") return false;
  const origin = request.headers.get("Origin");
  if (origin !== null) return origin !== url.origin;
  return request.headers.get("Sec-Fetch-Site") === "cross-site";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (crossSite(request, url)) return Response.json({ error: "Cross-site request blocked" }, { status: 403 });

    if (url.pathname === "/api/cards" && request.method === "GET") {
      return Response.json(await readCatalog(env));
    }

    if (url.pathname === "/api/me" && request.method === "GET") {
      return Response.json({ user: await readSession(request, env) });
    }

    if (url.pathname === "/api/owned" && (request.method === "GET" || request.method === "POST")) {
      const user = await readSession(request, env);
      if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
      if (!user.profile) return Response.json({ error: "No public KCC profile" }, { status: 404 });
      try {
        const owned = await readOwned(env, user.profile.id, request.method === "POST");
        const characterIds = [...owned.ss, ...owned.sss.map((key) => key.split(":")[0])];
        const catalogChanged = await discoverHiddenCards(env, characterIds).catch(() => false);
        const listSync = await syncOwnedLists(env, user.id, owned);
        const { previousDuplicates: _, ...cards } = owned;
        return Response.json({ ...cards, catalogChanged, listSync });
      } catch (error) {
        if (error instanceof SyncCooldownError) {
          return Response.json({ error: error.message, nextSyncAt: error.nextSyncAt }, { status: 429 });
        }
        const message = error instanceof Error ? error.message : "Could not load your collection";
        return Response.json({ error: message }, { status: 502 });
      }
    }

    if (url.pathname === "/api/trades" && request.method === "GET") {
      const user = await readSession(request, env);
      if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
      return Response.json({ matches: await findTrades(env, user.id) });
    }

    const traderPath = url.pathname.match(/^\/api\/traders\/(\d{5,25})$/);
    if (traderPath && request.method === "GET") {
      const lists = await readPublicLists(env, traderPath[1]);
      if (!lists) return Response.json({ error: "No lists for that trader" }, { status: 404 });
      return Response.json(lists);
    }

    if (url.pathname === "/api/preferences" && request.method === "POST") {
      const user = await readSession(request, env);
      if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      const preferences: Partial<Preferences> = {};
      for (const name of ["accepting", "pruneWishlist", "listDuplicates"] as const) {
        const value = body?.[name];
        if (value === undefined) continue;
        if (typeof value !== "boolean") return Response.json({ error: "Invalid preferences" }, { status: 400 });
        preferences[name] = value;
      }
      if (Object.keys(preferences).length === 0) {
        return Response.json({ error: "Invalid preferences" }, { status: 400 });
      }
      const saved = await setPreferences(env, traderFor(user), preferences);
      if (!(preferences.pruneWishlist || preferences.listDuplicates) || !user.profile) return Response.json(saved);
      const owned = await readOwned(env, user.profile.id, false).catch(() => null);
      const listSync = owned ? await syncOwnedLists(env, user.id, owned, preferences.listDuplicates) : null;
      if (!changedLists(listSync)) return Response.json(saved);
      return Response.json({ ...(await readLists(env, traderFor(user))), listSync });
    }

    if (url.pathname === "/api/lists") {
      const user = await readSession(request, env);
      if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
      if (request.method === "GET") {
        return Response.json(await readLists(env, traderFor(user)));
      }
      if (request.method === "POST") {
        const body = (await request.json().catch(() => null)) as { changes?: unknown } | null;
        const changes = parseChanges(body?.changes);
        if (!changes) return Response.json({ error: "Invalid list update" }, { status: 400 });

        let rejected: string | null = null;
        const accepted: ListChange[] = [];
        const needsOwned = changes.some((change) => change.list === "forTrade" && change.present);
        const owned = needsOwned && user.profile ? await readOwned(env, user.profile.id, false).catch(() => null) : null;
        for (const change of changes) {
          if (change.list !== "forTrade" || !change.present) accepted.push(change);
          else if (!user.profile) rejected = "Link a public KCC profile to list cards for trade.";
          else if (!owned || owned.hidden) {
            rejected = "We couldn't read your KCC collection, so we can't check that you own these cards.";
          } else if (!ownsCard(owned, change.key)) rejected = "You can only list cards you own for trade.";
          else accepted.push(change);
        }

        if (accepted.length === 0) {
          return Response.json({ ...(await readLists(env, traderFor(user))), rejected });
        }
        const { full, ...lists } = await changeLists(env, traderFor(user), accepted);
        if (full) rejected = "That list is full.";
        return Response.json(rejected ? { ...lists, rejected } : lists);
      }
    }

    if (url.pathname === "/auth/discord" && request.method === "GET") {
      return beginDiscordLogin(request, env);
    }

    if (url.pathname === "/auth/discord/callback" && request.method === "GET") {
      return finishDiscordLogin(request, env, async (user) => {
        if (!user.profile) return;
        const owned = await readOwned(env, user.profile.id, true).catch((error) => {
          if (!(error instanceof SyncCooldownError)) throw error;
          return null;
        });
        if (owned) await syncOwnedLists(env, user.id, owned);
      });
    }

    if (url.pathname === "/auth/logout" && request.method === "POST") {
      return logout(request);
    }

    if (url.pathname === "/sync" && request.method === "POST") {
      if (!authorized(request, env)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      try {
        return Response.json(await stepCatalogSync(env, url.searchParams.has("restart")));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync failed";
        return Response.json({ error: message }, { status: 502 });
      }
    }

    return new Response(null, { status: 404 });
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(stepCatalogSync(env));
  },
} satisfies ExportedHandler<Env>;
