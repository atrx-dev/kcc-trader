import { beginDiscordLogin, finishDiscordLogin, logout, readSession, type AuthEnv } from "./auth.ts";
import { serveArt } from "./art.ts";
import { changeList, readLists, type ListName } from "./lists.ts";
import { ownsCard, readOwned, SyncCooldownError } from "./owned.ts";
import { discoverHiddenCards, readCatalog, syncCatalog } from "./sync.ts";

interface Env extends AuthEnv {
  CARDS: KVNamespace;
  SYNC_TOKEN?: string;
}

function authorized(request: Request, env: Env): boolean {
  const token = env.SYNC_TOKEN;
  if (!token) return false;
  const header = request.headers.get("Authorization") ?? "";
  return header === `Bearer ${token}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
        const characterIds = [...owned.characters, ...owned.ss, ...owned.sss.map((key) => key.split(":")[0])];
        const catalogChanged = await discoverHiddenCards(env, characterIds).catch(() => false);
        return Response.json({ ...owned, catalogChanged });
      } catch (error) {
        if (error instanceof SyncCooldownError) {
          return Response.json({ error: error.message, nextSyncAt: error.nextSyncAt }, { status: 429 });
        }
        const message = error instanceof Error ? error.message : "Could not load your collection";
        return Response.json({ error: message }, { status: 502 });
      }
    }

    if (url.pathname === "/api/lists") {
      const user = await readSession(request, env);
      if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
      if (request.method === "GET") {
        return Response.json(await readLists(env, user.id));
      }
      if (request.method === "POST") {
        const body = (await request.json().catch(() => null)) as {
          list?: ListName;
          key?: string;
          present?: boolean;
        } | null;
        if (!body || (body.list !== "forTrade" && body.list !== "wishlist") || typeof body.key !== "string") {
          return Response.json({ error: "Invalid list update" }, { status: 400 });
        }
        if (body.list === "forTrade" && body.present) {
          if (!user.profile) {
            return Response.json({ error: "Link a public KCC profile to list cards for trade." }, { status: 403 });
          }
          const owned = await readOwned(env, user.profile.id, false).catch(() => null);
          if (!owned || owned.hidden) {
            return Response.json({ error: "We couldn't read your KCC collection, so we can't check that you own this card." }, { status: 403 });
          }
          if (!ownsCard(owned, body.key)) {
            return Response.json({ error: "You can only list cards you own for trade." }, { status: 403 });
          }
        }
        try {
          return Response.json(await changeList(env, user.id, body.list, body.key, Boolean(body.present)));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not update list";
          return Response.json({ error: message }, { status: 400 });
        }
      }
    }

    if (url.pathname === "/auth/discord" && request.method === "GET") {
      return beginDiscordLogin(request, env);
    }

    if (url.pathname === "/auth/discord/callback" && request.method === "GET") {
      return finishDiscordLogin(request, env);
    }

    if (url.pathname === "/auth/logout" && request.method === "POST") {
      return logout(request);
    }

    if (url.pathname.startsWith("/media/art/") && request.method === "GET") {
      return serveArt(env, url.pathname.slice("/media/art/".length));
    }

    if (url.pathname === "/sync" && request.method === "POST") {
      if (!authorized(request, env)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      try {
        const catalog = await syncCatalog(env);
        return Response.json({
          ok: true,
          syncedAt: catalog.syncedAt,
          count: catalog.cards.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync failed";
        return Response.json({ error: message }, { status: 502 });
      }
    }

    return new Response(null, { status: 404 });
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(syncCatalog(env));
  },
} satisfies ExportedHandler<Env>;
