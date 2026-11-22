# Contributing

Thanks for helping with KCC Trader.

## Before you start

- Open an [issue](https://github.com/atrx-dev/kcc-trader/issues) for bugs or larger ideas when you can — especially before big UI or data-model changes.
- Small fixes and clear improvements can go straight to a pull request.
- This is a fan project for Koi Card Collector. Keep changes focused on trading, catalog, and list workflows.

## Setup

Follow the **Development** section in [README.md](./README.md): install deps, copy `.dev.vars.example` to `.dev.vars`, and run `npm run dev`.

You need Discord OAuth credentials for sign-in flows. Catalog and owned sync call the public KCC API; a public KCC collection linked to your Discord account is useful when testing ownership and lists.

## Pull requests

1. Branch from `master`.
2. Keep the PR scoped — one concern per PR when possible.
3. Match the style of nearby code: TypeScript, existing React patterns, and the current Tailwind / component conventions. Prefer small, readable changes over drive-by refactors.
4. Run `npm run build` before you open the PR so the Worker + Vite build still passes.
5. Describe **why** the change exists and how you checked it (pages touched, sync path, mobile vs desktop if UI).

## What to avoid

- Committing `.dev.vars`, secrets, or personal Cloudflare resource swaps meant only for your deploy.
- Rewriting unrelated files, formatting the whole tree, or adding dependencies without a clear need.
- Scraping or storing more personal data than the app already needs for Discord login and public KCC profiles.

## Questions

Use GitHub issues, or message [@atrx](https://discord.com/users/204699700316602369) on Discord.
