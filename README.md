# Betting PWA

NBA betting prediction app — pulls live odds from The Odds API and surfaces the most-likely outcomes using consensus de-vig probability across bookmakers, plus a player-stats model for props. Installable on iPhone/Android as a PWA (Add to Home Screen).

Built with **Svelte 5 + TypeScript + Vite + Tailwind v4**. Deployed on **Vercel** with serverless functions proxying The Odds API so the key stays server-side.

## About this project

This is my first full-stack web/frontend project. Most of my prior work is hardware-side — an RV32I CPU in SystemVerilog, a CHIP-8 emulator, and PCB design in KiCad — so modern web development was new territory. I built this end-to-end with Claude as a pair-programmer to learn the toolchain: Svelte 5 (runes, stores, transitions), Vite, Tailwind v4, PWA fundamentals (manifest + service worker + Add to Home Screen), the math behind de-vigging consensus odds, rolling-average + normal-CDF probability for player props, and serverless deployment on Vercel. The architecture, prediction logic, and UI choices in here reflect that learning process.

## Local development

You need Node 20+, a free [Odds API](https://the-odds-api.com) key, and a free [balldontlie](https://balldontlie.io) key.

```bash
# 1. Install deps
npm install

# 2. Create .env.local with your keys
cat > .env.local <<EOF
VITE_ODDS_API_KEY=your_odds_key_here
VITE_BALLDONTLIE_API_KEY=your_balldontlie_key_here
EOF

# 3. Run dev server (binds 0.0.0.0 so you can hit it from your phone over LAN)
./node_modules/.bin/vite --host 0.0.0.0 --port 5173
```

Open <http://localhost:5173>.

## Production deploy (Vercel)

1. Push the repo to GitHub.
2. Go to <https://vercel.com> → New Project → import the repo.
3. In **Environment Variables**, add:
   - `ODDS_API_KEY` = your Odds API key *(no `VITE_` prefix — stays server-side, proxied via `api/odds.js` and `api/event-odds.js`)*
   - `VITE_BALLDONTLIE_API_KEY` = your balldontlie key *(has `VITE_` prefix — bundled into the client; balldontlie's free tier doesn't have a meaningful rotation cost)*
4. Click Deploy. Vercel auto-detects Vite and builds in ~30 seconds.

Once deployed, the URL works on any network. Open in Safari on iPhone → Share → Add to Home Screen to install as a PWA.

## What it shows

- **Games** — today's NBA matchups. Each card has team-color accents, ESPN team logos, a model pick badge with animated confidence percentage, injury indicators ("3 OUT") next to the bookmaker name. Tap any card to expand: shows the model's predicted final score and per-bookmaker line-shopping comparison.
- **Props** — player points/rebounds/assists/threes, deduped to one line per stat per player (the main line — the one the book set closest to 50/50). Each line shows the market consensus probability and a model probability derived from the player's recent game logs, plus an "agrees / disagrees" indicator. Players have ESPN headshots and injury status badges (OUT, DTD, etc).
- **Top Picks** — pick tracker. Header shows your record (W-L), accuracy %, and pending count. Below: your saved picks with Hit / Miss / Undo / Delete buttons. Below that: today's algorithmically surfaced picks (sorted by confidence, color-coded by tier) — each with a save button that adds it to your tracking list.
- **Settings** — pick threshold slider (Top Picks re-filters live), cache controls, sport roadmap, GitHub link.

## How the predictions work

**Consensus de-vig (game lines).** Each bookmaker bakes a margin ("vig") into their odds — the raw implied probabilities for any market sum to more than 100%. Averaging across all bookmakers and normalizing back to 100% gives the market's "fair" probability for each outcome. This is what real sports bettors use to find disagreements between books. See `src/lib/predict/probability.ts`.

**Player game-log model (props).** For each player on a slate, the app fetches their last ~25 game logs from balldontlie, computes the mean and sample standard deviation of the stat in question (points / rebounds / assists / threes), then estimates `P(stat > line)` via a normal-CDF approximation (Abramowitz & Stegun). The market consensus and the model are shown side-by-side so you can spot where they agree (high-confidence) or disagree (potential edge). See `src/lib/predict/playerModel.ts`.

**Predicted final score.** Derived from the market spread + total: `favorite_pts = (total + |spread|) / 2`, `underdog_pts = (total - |spread|) / 2`. Visible when you tap a game card to expand it.

## Pick tracking

The app lets you tap a bookmark on any pick to save it locally to your device (no account, no backend — just `localStorage`). After the game ends, return to **Top Picks** and tap **✓ Hit** or **✗ Miss** to log the result. Your accuracy stats persist across launches. Picks are stored per-device per-browser (your phone and laptop don't share unless you sign in to iCloud Tabs).

## Roadmap

- [x] Section 1 — PWA shell, bottom nav, dark theme
- [x] Section 2 — live Odds API integration with caching
- [x] Section 3a — consensus probability predictions
- [x] Section 4 — PWA polish + Vercel deploy with API proxy
- [x] Polish pass — loading skeletons, team colors, page transitions, real Settings page
- [x] Section 3b — player-stats model for props (balldontlie game logs + normal-CDF)
- [x] Vivid pass — stat-themed prop cards, expandable game cards, predicted score, counter animations
- [x] Injury awareness — ESPN injury reports per player and per game
- [x] Pick tracking — save picks locally, hit/miss/accuracy stats
- [x] Team logos + player headshots from ESPN's CDN
- [ ] Multi-sport expansion (NFL, MLB, college)
- [ ] Cross-device sync (would require accounts + backend)
