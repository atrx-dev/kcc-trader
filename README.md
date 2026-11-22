# KCC Trader

Trade helper for [Koi Card Collector](https://koi-card-collector.com) players: browse the catalog, keep a wishlist and for-trade list, match with other traders, and sync owned SS/SSS cards from a public KCC collection.

Live site: [kcc.atrx.dev](https://kcc.atrx.dev)

Fan-made and not affiliated with KCC or Discord.

## Stack

- React + Vite frontend
- Cloudflare Worker API (`src/index.ts`)
- D1 for trader lists and preferences
- KV for the card catalog and owned-collection cache
- Discord OAuth for sign-in

## Development

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Fill `.dev.vars` with:

| Variable | Purpose |
| --- | --- |
| `DISCORD_CLIENT_ID` | Discord application client id |
| `DISCORD_CLIENT_SECRET` | Discord application client secret |
| `SESSION_SECRET` | Random secret used to seal session cookies |
| `SYNC_TOKEN` | Optional bearer token for the `/sync` endpoint |

Point the Discord OAuth redirect at your local origin (Vite defaults to `http://localhost:5173/auth/discord/callback`).

Local runs use the Cloudflare Vite plugin with your Wrangler bindings. Create your own KV namespace and D1 database, then put those ids (and your domain, if any) in `wrangler.jsonc` instead of the production values checked in here.

Apply migrations:

```bash
npx wrangler d1 migrations apply kcc-trader --local
```

## Deploy

```bash
npm run deploy
```

Or connect the GitHub repo to Workers Builds with:

- Branch: `master`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Set the same secrets on the Worker as in `.dev.vars`. Cron triggers in `wrangler.jsonc` drive catalog/profile maintenance.
