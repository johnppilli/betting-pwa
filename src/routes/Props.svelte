<script lang="ts">
  import { fetchNbaOdds, fetchNbaEventProps, type OddsEvent } from '../lib/api/odds';
  import { getCached, setCached, cacheAge } from '../lib/api/cache';
  import { americanOdds, tipoffTime, shortAge } from '../lib/format';
  import { consensusProbabilities, favoredSide, pct } from '../lib/predict/probability';

  const GAMES_CACHE = 'nba-odds';
  const TTL_MS = 10 * 60 * 1000;

  let games = $state<OddsEvent[] | null>(null);
  let selectedId = $state<string | null>(null);
  let propsEvent = $state<OddsEvent | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let updatedAgo = $state<number | null>(null);

  const STAT_LABELS: Record<string, string> = {
    player_points: 'Points',
    player_rebounds: 'Rebounds',
    player_assists: 'Assists',
    player_threes: 'Threes'
  };

  interface PropLine {
    stat: string;
    marketKey: string;
    line: number;
    over: number;
    under: number;
    favored: 'Over' | 'Under' | null;
    favoredProb: number | null;
  }
  interface Player {
    name: string;
    lines: PropLine[];
  }

  async function loadGames() {
    loading = true;
    error = null;
    try {
      let g = getCached<OddsEvent[]>(GAMES_CACHE, TTL_MS);
      if (!g) {
        g = await fetchNbaOdds();
        setCached(GAMES_CACHE, g);
      }
      games = g;
      if (g.length === 0) { loading = false; return; }
      selectedId = g[0].id;
      await loadProps(g[0].id);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load';
      loading = false;
    }
  }

  async function loadProps(eventId: string) {
    loading = true;
    error = null;
    const cacheKey = `props-${eventId}`;
    try {
      let p = getCached<OddsEvent>(cacheKey, TTL_MS);
      if (!p) {
        p = await fetchNbaEventProps(eventId);
        setCached(cacheKey, p);
      }
      propsEvent = p;
      updatedAgo = cacheAge(cacheKey);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load props';
    } finally {
      loading = false;
    }
  }

  function selectGame(id: string) {
    if (id === selectedId) return;
    selectedId = id;
    propsEvent = null;
    loadProps(id);
  }

  $effect(() => { loadGames(); });

  function groupByPlayer(event: OddsEvent | null): Player[] {
    if (!event) return [];
    const players: Record<string, Player> = {};

    for (const marketKey of Object.keys(STAT_LABELS)) {
      const stat = STAT_LABELS[marketKey];
      const entries = consensusProbabilities(event, marketKey);

      // Pair up by (description, point): each pair has Over + Under entries.
      const grouped: Record<string, typeof entries> = {};
      for (const e of entries) {
        const k = `${e.description ?? ''}|${e.point ?? ''}`;
        if (!grouped[k]) grouped[k] = [];
        grouped[k].push(e);
      }

      // Pull display prices from the first bookmaker that offers this market
      const firstBookMarket = event.bookmakers
        .map((bk) => bk.markets.find((m) => m.key === marketKey))
        .find((m) => m);
      const priceMap: Record<string, number> = {};
      if (firstBookMarket) {
        for (const o of firstBookMarket.outcomes) {
          priceMap[`${o.name}|${o.point ?? ''}|${o.description ?? ''}`] = o.price;
        }
      }

      for (const groupKey in grouped) {
        const pair = grouped[groupKey];
        if (pair.length < 2) continue;
        const over = pair.find((p) => p.name === 'Over');
        const under = pair.find((p) => p.name === 'Under');
        if (!over || !under) continue;
        const player = over.description ?? '';
        if (!player) continue;

        const fav = favoredSide(pair);
        const favSide: 'Over' | 'Under' | null = fav?.name === 'Over' ? 'Over' : fav?.name === 'Under' ? 'Under' : null;

        const overPrice = priceMap[`Over|${over.point ?? ''}|${player}`] ?? 0;
        const underPrice = priceMap[`Under|${under.point ?? ''}|${player}`] ?? 0;

        if (!players[player]) players[player] = { name: player, lines: [] };
        players[player].lines.push({
          stat,
          marketKey,
          line: over.point ?? 0,
          over: overPrice,
          under: underPrice,
          favored: favSide,
          favoredProb: fav?.prob ?? null
        });
      }
    }

    return Object.values(players)
      .map((p) => ({
        ...p,
        lines: p.lines.sort((a, b) => (b.favoredProb ?? 0) - (a.favoredProb ?? 0))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  let players = $derived(groupByPlayer(propsEvent));
</script>

<header class="mb-4">
  <h1 class="text-2xl font-semibold tracking-tight">Player Props</h1>
  <p class="text-sm text-neutral-500">Points, rebounds, assists, threes</p>
  {#if updatedAgo !== null && propsEvent}
    <p class="mt-1 text-xs text-neutral-600">Updated {shortAge(updatedAgo)}</p>
  {/if}
</header>

{#if games && games.length > 1}
  <div class="-mx-4 mb-4 overflow-x-auto px-4">
    <div class="flex gap-2">
      {#each games as g (g.id)}
        <button
          onclick={() => selectGame(g.id)}
          class="shrink-0 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition {selectedId === g.id ? 'border-orange-500 bg-orange-500/10 text-orange-300' : 'border-neutral-800 text-neutral-400 hover:bg-neutral-900'}"
        >
          {g.away_team} @ {g.home_team}
        </button>
      {/each}
    </div>
  </div>
{/if}

{#if loading && !propsEvent}
  <div class="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-center text-neutral-400">
    Loading props...
  </div>
{:else if error}
  <div class="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-red-300">
    <p class="text-sm font-medium">Couldn't load props</p>
    <p class="mt-1 text-xs">{error}</p>
  </div>
{:else if games && games.length === 0}
  <div class="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-center text-neutral-400">
    No NBA games available right now.
  </div>
{:else if propsEvent && players.length === 0}
  <div class="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-center text-neutral-400">
    <p>No player props posted yet for this game.</p>
    <p class="mt-1 text-xs text-neutral-600">
      Sportsbooks usually post props closer to tip-off ({propsEvent && tipoffTime(propsEvent.commence_time)}).
    </p>
  </div>
{:else if propsEvent}
  <section class="space-y-3">
    {#each players as player (player.name)}
      <article class="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
        <h2 class="mb-3 text-sm font-medium text-neutral-100">{player.name}</h2>
        <div class="space-y-2">
          {#each player.lines as line (line.stat + line.line)}
            <div class="flex items-center justify-between text-xs">
              <span class="text-neutral-400">
                {line.stat}
                <span class="ml-1 text-neutral-200">{line.line}</span>
              </span>
              <div class="flex items-center gap-2">
                <span class="rounded-md px-2 py-1 {line.favored === 'Over' ? 'bg-orange-500/15 text-orange-200 ring-1 ring-orange-500/30' : 'bg-neutral-800 text-neutral-300'}">
                  O <span class="ml-1 text-neutral-500">{americanOdds(line.over)}</span>
                </span>
                <span class="rounded-md px-2 py-1 {line.favored === 'Under' ? 'bg-orange-500/15 text-orange-200 ring-1 ring-orange-500/30' : 'bg-neutral-800 text-neutral-300'}">
                  U <span class="ml-1 text-neutral-500">{americanOdds(line.under)}</span>
                </span>
                {#if line.favoredProb !== null}
                  <span class="ml-1 font-mono text-orange-300">{pct(line.favoredProb)}</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </article>
    {/each}
  </section>
{/if}
