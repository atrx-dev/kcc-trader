import { beginDiscordLogin, finishDiscordLogin, logout, readSession, sessionCookie, type AuthEnv, type SessionUser } from "./auth.ts";
import {
  changeLists,
  parseChanges,
  markIntroduced,
  readLists,
  readPublicLists,
  countTraders,
  readLeaderboard,
  recordCollection,
  rememberTrader,
  type CollectionStats,
  searchTraders,
  type LeaderboardBy,
  setPreferences,
  syncLists,
  type ListChange,
  type ListSync,
  type Preferences,
  type Trader,
} from "./lists.ts";
import { isSpare, ownsCard, readOwned, SyncCooldownError, type OwnedResponse, type SyncedProfile } from "./owned.ts";
import { profileEmbed, withProfileMeta } from "./embed.ts";
import { isAdmin, profileSyncStatus, stepProfileSync } from "./admin.ts";
import { addSsArtwork, catalogSyncStatus, discoverHiddenCards, readCatalog, stepCatalogSync } from "./sync.ts";
import { findTrades, wishlistDemand } from "./trades.ts";
import { cardKey } from "./types.ts";

function sameUser(left: SessionUser, right: SessionUser): boolean {
  const profile = left.profile;
  const next = right.profile;
  return (
    left.username === right.username &&
    left.globalName === right.globalName &&
    left.avatarUrl === right.avatarUrl &&
    profile?.name === next?.name &&
    profile?.discordUsername === next?.discordUsername &&
    profile?.level === next?.level &&
    profile?.publicCollection === next?.publicCollection &&
    profile?.cards === next?.cards &&
    profile?.sss === next?.sss &&
    profile?.collectionValue === next?.collectionValue
  );
}

function withSyncedProfile(user: SessionUser, profile: SyncedProfile): SessionUser {
  return {
    ...user,
    username: profile.discordUsername || user.username,
    globalName: profile.name || user.globalName,
    avatarUrl: profile.avatarUrl ?? user.avatarUrl,
    profile: {
      id: profile.id,
      name: profile.name,
      discordUsername: profile.discordUsername,
      level: profile.level,
      publicCollection: profile.publicCollection,
      cards: profile.cards,
      sss: profile.sss,
      collectionValue: profile.collectionValue,
    },
  };
}

function collectionStats(user: SessionUser): CollectionStats | null {
  const profile = user.profile;
  if (!profile?.publicCollection) return null;
  const cards = Number(profile.cards);
  const sss = Number(profile.sss);
  const level = Number(profile.level);
  if (![cards, sss, level].every(Number.isFinite)) return null;
  const collectionValue = Number(profile.collectionValue);
  return { cards, sss, level, collectionValue: Number.isFinite(collectionValue) ? collectionValue : null };
}

async function snapshotCollection(env: Env, user: SessionUser): Promise<void> {
  if (!user.profile) return;
  await rememberTrader(env, traderFor(user));
  await recordCollection(env, user.id, collectionStats(user));
}

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
  ASSETS?: Fetcher;
  CARDS: KVNamespace;
  DB: D1Database;
  SYNC_TOKEN?: string;
}

async function requireAdmin(request: Request, env: Env): Promise<SessionUser | Response> {
  const user = await readSession(request, env);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!isAdmin(user)) return Response.json({ error: "Forbidden" }, { status: 403 });
  return user;
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
      const user = await readSession(request, env);
      return Response.json({ user, admin: isAdmin(user) });
    }

    if (url.pathname === "/api/owned" && (request.method === "GET" || request.method === "POST")) {
      const user = await readSession(request, env);
      if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
      if (!user.profile) return Response.json({ error: "No public KCC profile" }, { status: 404 });
      try {
        const force = request.method === "POST" && url.searchParams.get("force") === "1";
        const owned = await readOwned(env, user.profile.id, request.method === "POST", force);
        const artworkAdded = await addSsArtwork(env, owned.artwork);
        const characterIds = [...owned.ss, ...owned.sss].map((key) => key.split(":")[0]);
        const catalogChanged = artworkAdded || (await discoverHiddenCards(env, characterIds).catch(() => false));
        const listSync = await syncOwnedLists(env, user.id, owned);
        const refreshed = owned.profile ? withSyncedProfile(user, owned.profile) : user;
        await snapshotCollection(env, refreshed);
        const changed = !sameUser(user, refreshed);
        if (
          changed &&
          (user.username !== refreshed.username ||
            user.globalName !== refreshed.globalName ||
            user.avatarUrl !== refreshed.avatarUrl ||
            user.profile?.name !== refreshed.profile?.name ||
            user.profile?.id !== refreshed.profile?.id)
        ) {
          await rememberTrader(env, traderFor(refreshed));
        }
        const { previousDuplicates: _, artwork: __, profile: ___, ...cards } = owned;
        const body = { ...cards, catalogChanged, listSync, ...(changed ? { user: refreshed } : {}) };
        if (!changed) return Response.json(body);
        const cookie = await sessionCookie(request, env, refreshed);
        return Response.json(body, cookie ? { headers: { "Set-Cookie": cookie } } : undefined);
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
      const [matches, demand] = await Promise.all([findTrades(env, user.id), wishlistDemand(env, user.id)]);
      return Response.json({ matches, demand });
    }

    if (url.pathname === "/api/leaderboard" && request.method === "GET") {
      const requested = url.searchParams.get("by");
      const by: LeaderboardBy = requested === "level" || requested === "value" ? requested : "sss";
      const user = await readSession(request, env);
      if (user) await snapshotCollection(env, user);
      return Response.json({ by, traders: await readLeaderboard(env, by) });
    }

    if (url.pathname === "/api/traders/count" && request.method === "GET") {
      return Response.json({ total: await countTraders(env) });
    }

    if (url.pathname === "/api/traders" && request.method === "GET") {
      const traders = await searchTraders(env, url.searchParams.get("q") ?? "");
      return Response.json({ traders });
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
      if (body?.introduced === true) await markIntroduced(env, user.id);
      if (Object.keys(preferences).length === 0) {
        if (body?.introduced !== true) return Response.json({ error: "Invalid preferences" }, { status: 400 });
        return Response.json(await readLists(env, traderFor(user)));
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
        await snapshotCollection(env, user);
        return Response.json(await readLists(env, traderFor(user)));
      }
      if (request.method === "POST") {
        const body = (await request.json().catch(() => null)) as { changes?: unknown } | null;
        const changes = parseChanges(body?.changes);
        if (!changes) return Response.json({ error: "Invalid list update" }, { status: 400 });

        let rejected: string | null = null;
        const accepted: ListChange[] = [];
        const needsOwned = changes.some((change) => change.list === "forTrade" && change.present && change.skip !== true);
        const owned = needsOwned && user.profile ? await readOwned(env, user.profile.id, false).catch(() => null) : null;
        for (const change of changes) {
          if (change.list !== "forTrade" || !change.present || change.skip === true) accepted.push(change);
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
        if (owned) {
          await addSsArtwork(env, owned.artwork);
          await syncOwnedLists(env, user.id, owned);
        }
      });
    }

    if (url.pathname === "/auth/logout" && request.method === "POST") {
      return logout(request);
    }

    const profilePath = url.pathname.match(/^\/u\/(\d{5,25})\/?$/);
    if (profilePath && (request.method === "GET" || request.method === "HEAD")) {
      // Fetch the shell through the assets binding. A plain fetch() to this worker's own
      // hostname is what Cloudflare answers with 522.
      const shellRequest = new Request(new URL("/", url), { redirect: "manual" });
      const shell = env.ASSETS ? await env.ASSETS.fetch(shellRequest) : await fetch(shellRequest);
      if (!shell.ok || !shell.body) return shell;
      const lists = await readPublicLists(env, profilePath[1]);
      const pageUrl = new URL(`/u/${profilePath[1]}`, url.origin).href;
      const document = withProfileMeta(shell, profileEmbed(lists), pageUrl);
      return request.method === "HEAD" ? new Response(null, { status: document.status, headers: document.headers }) : document;
    }

    if (url.pathname === "/api/admin" && request.method === "GET") {
      const gate = await requireAdmin(request, env);
      if (gate instanceof Response) return gate;
      const [catalog, profiles] = await Promise.all([catalogSyncStatus(env), profileSyncStatus(env)]);
      return Response.json({ catalog, profiles });
    }

    if (url.pathname === "/api/admin/catalog" && request.method === "POST") {
      const gate = await requireAdmin(request, env);
      if (gate instanceof Response) return gate;
      try {
        return Response.json(await stepCatalogSync(env, url.searchParams.has("restart"), url.searchParams.get("owner") ?? ""));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync failed";
        return Response.json({ error: message }, { status: 502 });
      }
    }

    if (url.pathname === "/api/admin/profiles" && request.method === "POST") {
      const gate = await requireAdmin(request, env);
      if (gate instanceof Response) return gate;
      try {
        return Response.json(await stepProfileSync(env, url.searchParams.has("restart")));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync failed";
        return Response.json({ error: message }, { status: 502 });
      }
    }

    if (url.pathname === "/sync" && request.method === "POST") {
      if (!authorized(request, env)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      try {
        return Response.json(await stepCatalogSync(env, url.searchParams.has("restart"), url.searchParams.get("owner") ?? ""));
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
