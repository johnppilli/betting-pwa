<script lang="ts">
  import { fetchNbaOdds, fetchNbaEventProps, type OddsEvent } from '../lib/api/odds';
  import { getCached, setCached, cacheAge } from '../lib/api/cache';
  import { americanOdds, tipoffTime, shortAge } from '../lib/format';

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
    line: number;
    over: number;
    under: number;
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

    for (const bk of event.bookmakers) {
      for (const m of bk.markets) {
        const stat = STAT_LABELS[m.key];
        if (!stat) continue;

        const pairs: Record<string, { line: number; over?: number; under?: number }> = {};
        for (const o of m.outcomes) {
          const player = o.description || o.name;
          const point = o.point ?? 0;
          const key = `${player}|${point}`;
          if (!pairs[key]) pairs[key] = { line: point };
          if (o.name === 'Over') pairs[key].over = o.price;
          else if (o.name === 'Under') pairs[key].under = o.price;
        }
        for (const key in pairs) {
          const [player] = key.split('|');
          const entry = pairs[key];
          if (entry.over === undefined || entry.under === undefined) continue;
          if (!players[player]) players[player] = { name: player, lines: [] };
          players[player].lines.push({
            stat, line: entry.line, over: entry.over, under: entry.under
          });
        }
      }
      if (Object.keys(players).length > 0) break;
    }

    return Object.values(players).sort((a, b) => a.name.localeCompare(b.name));
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
              <div class="flex gap-2">
                <span class="rounded-md bg-neutral-800 px-2 py-1 text-neutral-300">
                  O <span class="ml-1 text-neutral-500">{americanOdds(line.over)}</span>
                </span>
                <span class="rounded-md bg-neutral-800 px-2 py-1 text-neutral-300">
                  U <span class="ml-1 text-neutral-500">{americanOdds(line.under)}</span>
                </span>
              </div>
            </div>
          {/each}
        </div>
      </article>
    {/each}
  </section>
{/if}
