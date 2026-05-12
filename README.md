# Betting PWA

NBA betting prediction app — pulls live odds from The Odds API and surfaces the most-likely outcomes using consensus de-vig probability across bookmakers, plus a player-stats model for props. Installable on iPhone/Android as a PWA (Add to Home Screen).

Built with **Svelte 5 + TypeScript + Vite + Tailwind v4**. Deployed on **Vercel** with serverless functions proxying The Odds API so the key stays server-side.

## About this project

This is my first full-stack web/frontend project. Most of my prior work is hardware-side — an RV32I CPU in SystemVerilog, a CHIP-8 emulator, and PCB design in KiCad — so modern web development was new territory. I built this end-to-end with Claude as a pair-programmer to learn the toolchain: Svelte 5 (runes, stores, transitions), Vite, Tailwind v4, PWA fundamentals (manifest + service worker + Add to Home Screen), the math behind de-vigging consensus odds, rolling-average + normal-CDF probability for player props, and serverless deployment on Vercel. The architecture, prediction logic, and UI choices in here reflect that learning process.

## Local development

You need Node 20+ and a free Odds API key from [the-odds-api.com](https://the-odds-api.com).

```bash
# 1. Install deps
npm install

# 2. Create .env.local with your key
echo "VITE_ODDS_API_KEY=your_key_here" > .env.local

# 3. Run dev server (binds 0.0.0.0 so you can hit it from your phone over LAN)
./node_modules/.bin/vite --host 0.0.0.0 --port 5173
```

Open <http://localhost:5173>.

## Production deploy (Vercel)

1. Push the repo to GitHub.
2. Go to <https://vercel.com> → New Project → import the repo.
3. In **Environment Variables**, add: `ODDS_API_KEY = your_key_here` *(note: no `VITE_` prefix — this keeps the key server-side only).*
4. Click Deploy. Vercel auto-detects Vite and builds in ~30 seconds.

Once deployed, the URL works on any network (cell, home Wi-Fi, school Wi-Fi). Open it in Safari on iPhone → Share → Add to Home Screen to install.

## What it shows

- **Games** — today's NBA matchups with spreads, totals, and moneyline. Each card has team-color accents and a model pick badge with confidence percentage.
- **Props** — player points/rebounds/assists/threes per game, showing both the market consensus probability and a model probability derived from the player's recent game logs.
- **Top Picks** — strongest plays across all games and props, sorted by confidence, color-coded by tier. The confidence threshold is user-configurable in Settings.
- **Settings** — pick threshold slider, cache controls, sport roadmap.

## How the predictions work

**Consensus de-vig (game lines).** Each bookmaker bakes a margin ("vig") into their odds — the raw implied probabilities for any market sum to more than 100%. Averaging across all bookmakers and normalizing back to 100% gives the market's "fair" probability for each outcome. This is what real sports bettors use to find disagreements between books. See `src/lib/predict/probability.ts`.

**Player game-log model (props).** For each player on a slate, the app fetches their last ~25 game logs from balldontlie, computes the mean and sample standard deviation of the stat in question (points / rebounds / assists / threes), then estimates `P(stat > line)` via a normal-CDF approximation. The market consensus and the player-stat model are shown side-by-side so you can see where they agree or disagree. See `src/lib/predict/playerModel.ts`.

## Roadmap

- [x] Section 1 — PWA shell, bottom nav, dark theme
- [x] Section 2 — live Odds API integration with caching
- [x] Section 3a — consensus probability predictions
- [x] Section 4 — PWA polish + Vercel deploy with API proxy
- [x] Polish pass — loading skeletons, team colors, page transitions, real Settings page
- [x] Section 3b — player-stats model for props (balldontlie game logs + normal-CDF)
- [ ] Multi-sport expansion (NFL, MLB, college)
