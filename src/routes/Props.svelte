<script lang="ts">
  import { fetchNbaOdds, fetchNbaEventProps, type OddsEvent } from '../lib/api/odds';
  import { getCached, setCached, cacheAge } from '../lib/api/cache';
  import { americanOdds, tipoffTime, shortAge } from '../lib/format';
  import { consensusProbabilities, favoredSide, pct } from '../lib/predict/probability';
  import { findPlayerId, fetchRecentStats, type BdlStat } from '../lib/api/stats';
  import { modelProbability } from '../lib/predict/playerModel';
  import { fetchNbaInjuries, findInjury, injuryUI, type InjuryAthlete } from '../lib/api/injuries';
  import { getMatchupPlayers, playerHeadshot, type EspnPlayer } from '../lib/api/espnPlayers';
  import { statTheme } from '../lib/statColors';
  import PropPlayerSkeleton from '../lib/components/PropPlayerSkeleton.svelte';

  const GAMES_CACHE = 'nba-odds';
  const TTL_MS = 10 * 60 * 1000;

  let games = $state<OddsEvent[] | null>(null);
  let selectedId = $state<string | null>(null);
  let propsEvent = $state<OddsEvent | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let updatedAgo = $state<number | null>(null);
  let playerStats = $state<Record<string, BdlStat[]>>({});
  let injuries = $state<InjuryAthlete[]>([]);
  let espnRoster = $state<Record<string, EspnPlayer>>({});

  const STAT_LABELS: Record<string, string> = {
    player_points: 'Points',
    player_rebounds: 'Rebounds',
    player_assists: 'Assists',
    player_threes: 'Threes'
  };
  const STAT_ORDER = ['player_points', 'player_rebounds', 'player_assists', 'player_threes'];

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
    // injuries load in the background — never blocks the main flow
    fetchNbaInjuries()
      .then((data) => (injuries = data))
      .catch(() => {
        // ESPN endpoint occasionally hiccups; safe to skip
      });
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
      loadAllPlayerStats(p);
      // Fetch ESPN rosters for the two teams (used for player headshots)
      getMatchupPlayers(p.home_team, p.away_team)
        .then((map) => (espnRoster = map))
        .catch(() => {
          // not critical — falls back to initials avatar
        });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load props';
    } finally {
      loading = false;
    }
  }

  async function loadAllPlayerStats(event: OddsEvent) {
    const names = new Set<string>();
    for (const bk of event.bookmakers) {
      for (const m of bk.markets) {
        for (const o of m.outcomes) {
          if (o.description) names.add(o.description);
        }
      }
    }
    await Promise.allSettled(
      [...names].map(async (name) => {
        try {
          const id = await findPlayerId(name);
          if (!id) return;
          const stats = await fetchRecentStats(id);
          playerStats = { ...playerStats, [name]: stats };
        } catch {
          // per-player failures (rate limit, etc.) are silently skipped
        }
      })
    );
  }

  function selectGame(id: string) {
    if (id === selectedId) return;
    selectedId = id;
    propsEvent = null;
    playerStats = {};
    loadProps(id);
  }

  $effect(() => { loadGames(); });

  /**
   * For each player, collect one line per stat — the "main" line, defined as
   * the line whose favored-side probability is closest to 50% (most balanced).
   * Sportsbooks set the main line where O/U are nearly 50/50; alt lines
   * intentionally skew. We hide alts to reduce clutter.
   */
  function groupByPlayer(event: OddsEvent | null): Player[] {
    if (!event) return [];
    const players: Record<string, { name: string; lines: Record<string, PropLine> }> = {};

    for (const marketKey of STAT_ORDER) {
      const stat = STAT_LABELS[marketKey];
      const entries = consensusProbabilities(event, marketKey);

      const grouped: Record<string, typeof entries> = {};
      for (const e of entries) {
        const k = `${e.description ?? ''}|${e.point ?? ''}`;
        if (!grouped[k]) grouped[k] = [];
        grouped[k].push(e);
      }

      // Lookup raw prices from the first bookmaker that offers this market
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

        const candidate: PropLine = {
          stat,
          marketKey,
          line: over.point ?? 0,
          over: overPrice,
          under: underPrice,
          favored: favSide,
          favoredProb: fav?.prob ?? null
        };

        if (!players[player]) players[player] = { name: player, lines: {} };
        const current = players[player].lines[stat];
        if (!current) {
          players[player].lines[stat] = candidate;
        } else {
          // keep the line whose favored prob is closest to 0.5 (the main line)
          const dCurrent = Math.abs((current.favoredProb ?? 0.5) - 0.5);
          const dCandidate = Math.abs((candidate.favoredProb ?? 0.5) - 0.5);
          if (dCandidate < dCurrent) {
            players[player].lines[stat] = candidate;
          }
        }
      }
    }

    return Object.values(players)
      .map((p) => ({
        name: p.name,
        // Order lines: Points → Rebounds → Assists → Threes
        lines: STAT_ORDER
          .map((mk) => Object.values(p.lines).find((l) => l.marketKey === mk))
          .filter((l): l is PropLine => !!l)
      }))
      .sort((a, b) => {
        // Stars first: sort by sum of all prop lines (Points + Rebounds +
        // Assists + Threes). Bookmakers set higher lines for star players,
        // so Edwards (26.5 pts) sorts above Dosunmu (12.5 pts) automatically.
        const aStar = a.lines.reduce((s, l) => s + l.line, 0);
        const bStar = b.lines.reduce((s, l) => s + l.line, 0);
        if (bStar !== aStar) return bStar - aStar;
        return a.name.localeCompare(b.name);
      });
  }

  let players = $derived(groupByPlayer(propsEvent));

  // Model probability for the favored side (returns null when stats not loaded
  // or the player has too few recent games).
  function lineModelProb(
    playerName: string,
    marketKey: string,
    lineValue: number,
    favored: 'Over' | 'Under' | null
  ): number | null {
    const stats = playerStats[playerName];
    if (!stats) return null;
    const result = modelProbability(stats, marketKey, lineValue);
    if (!result) return null;
    if (favored === 'Over') return result.pOver;
    if (favored === 'Under') return 1 - result.pOver;
    return Math.max(result.pOver, 1 - result.pOver);
  }

  function initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
</script>

<header class="mb-4">
  <h1 class="text-2xl font-semibold tracking-tight">Player Props</h1>
  <p class="text-sm text-neutral-500">Points · Rebounds · Assists · Threes</p>
  {#if updatedAgo !== null && propsEvent}
    <p class="mt-1 text-xs text-neutral-600">Updated {shortAge(updatedAgo)}</p>
  {/if}
</header>

{#if games && games.length > 1}
  <div class="-mx-4 mb-4 fade-right">
    <div class="no-scrollbar overflow-x-auto px-4">
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
  </div>
{/if}

{#if loading && !propsEvent}
  <section class="space-y-3">
    {#each Array(3) as _, i (i)}
      <PropPlayerSkeleton />
    {/each}
  </section>
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
  <section class="space-y-4">
    {#each players as player (player.name)}
      {@const injury = findInjury(injuries, player.name)}
      {@const injUI = injury ? injuryUI(injury.status) : null}
      {@const headshot = playerHeadshot(espnRoster, player.name)}
      <article class="overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40">
        <!-- Player header -->
        <div class="flex items-center gap-3 border-b border-neutral-800/60 px-4 py-3">
          <div class="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-800 text-xs font-bold text-neutral-300">
            <span class="absolute">{initials(player.name)}</span>
            {#if headshot}
              <img
                src={headshot}
                alt=""
                loading="lazy"
                class="relative h-full w-full object-cover"
                onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            {/if}
          </div>
          <h2 class="flex-1 truncate text-sm font-semibold text-neutral-100">{player.name}</h2>
          {#if injUI}
            <span
              class="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider ring-1 {injUI.classes}"
              title={injury?.shortComment ?? injury?.status}
            >
              {injUI.label}
            </span>
          {/if}
        </div>

        <!-- Lines (one per stat) -->
        <div class="space-y-2 p-3">
          {#each player.lines as line (line.marketKey)}
            {@const theme = statTheme(line.marketKey)}
            {@const modelP = lineModelProb(player.name, line.marketKey, line.line, line.favored)}
            {@const marketAgrees =
              modelP !== null &&
              line.favoredProb !== null &&
              ((modelP >= 0.5) === (line.favoredProb >= 0.5))}
            {@const barPct = Math.round(((line.favoredProb ?? 0.5) * 100))}

            <div class="rounded-xl {theme.bgSoft} p-3 ring-1 {theme.ring}">
              <!-- Top row: stat + line, favored % -->
              <div class="flex items-start justify-between gap-3">
                <div>
                  <span class="text-[10px] font-bold tracking-wider uppercase {theme.text}">
                    {line.stat}
                  </span>
                  <span class="ml-2 text-base font-medium text-neutral-100">{line.line}</span>
                </div>
                <div class="text-right">
                  <div class="font-mono text-2xl font-bold leading-none {theme.text}">
                    {pct(line.favoredProb ?? 0.5)}
                  </div>
                  <div class="mt-0.5 text-[10px] tracking-wider uppercase text-neutral-400">
                    {line.favored ?? '—'}
                  </div>
                </div>
              </div>

              <!-- Progress bar -->
              <div class="mt-3 h-1.5 w-full overflow-hidden rounded-full {theme.bgFillTrack}">
                <div class="h-full rounded-full {theme.bgFill}" style="width: {barPct}%"></div>
              </div>

              <!-- Bottom row: model + prices -->
              <div class="mt-3 flex items-center justify-between text-[10px]">
                <div class="text-neutral-500">
                  {#if modelP !== null}
                    <span>Model</span>
                    <span class="ml-1 font-mono font-medium {marketAgrees ? 'text-emerald-300' : 'text-amber-400'}">
                      {pct(modelP)}
                    </span>
                    {#if marketAgrees}
                      <span class="ml-1 text-emerald-400">agrees</span>
                    {:else}
                      <span class="ml-1 text-amber-500">disagrees</span>
                    {/if}
                  {:else}
                    <span class="text-neutral-600">Model loading…</span>
                  {/if}
                </div>
                <div class="flex gap-1.5">
                  <span class="rounded bg-neutral-800/80 px-2 py-0.5 font-mono text-neutral-300">
                    O <span class="text-neutral-500">{americanOdds(line.over)}</span>
                  </span>
                  <span class="rounded bg-neutral-800/80 px-2 py-0.5 font-mono text-neutral-300">
                    U <span class="text-neutral-500">{americanOdds(line.under)}</span>
                  </span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </article>
    {/each}
  </section>
{/if}
