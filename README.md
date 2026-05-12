# Betting PWA

NBA betting prediction app — pulls live odds from The Odds API and surfaces the most-likely outcomes using consensus de-vig probability across bookmakers. Installable on iPhone/Android as a PWA (Add to Home Screen).

Built with **Svelte 5 + TypeScript + Vite + Tailwind v4**. Deployed on **Vercel** with a tiny serverless function proxying The Odds API so the key stays server-side.

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

- **Games** — today's NBA matchups with spreads, totals, and moneyline. Each card shows a model pick + confidence percentage.
- **Props** — player points/rebounds/assists/threes per game, with the favored Over/Under highlighted.
- **Top Picks** — strongest plays across all games and props, sorted by confidence, color-coded by tier.
- **Settings** — placeholder for now.

## The math (Section 3a)

Each bookmaker bakes their margin (the "vig") into the odds. If you average the raw implied probabilities across multiple books, the result is > 100% — that excess **is** the vig. After normalizing, you get the market's true probability for each outcome. The Top Picks page surfaces anything ≥ 52% confidence after this adjustment. See `src/lib/predict/probability.ts`.

## Roadmap

- [x] Section 1 — PWA shell, bottom nav, dark theme
- [x] Section 2 — live Odds API integration with caching
- [x] Section 3a — consensus probability predictions
- [x] Section 4 — PWA polish + Vercel deploy with API proxy
- [ ] Section 3b — fancier prop model using player game logs (planned)
