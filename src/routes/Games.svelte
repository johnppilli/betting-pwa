<script lang="ts">
  import { slide } from 'svelte/transition';
  import { fetchNbaOdds, type OddsEvent, type Outcome } from '../lib/api/odds';
  import { getCached, setCached, cacheAge } from '../lib/api/cache';
  import { americanOdds, signedPoint, tipoffTime, teamAbbr, shortAge } from '../lib/format';
  import { favoredOutcome, pct } from '../lib/predict/probability';
  import { teamColors, matchupGradient } from '../lib/teams';
  import { fetchNbaInjuries, injuryUI, type InjuryAthlete } from '../lib/api/injuries';
  import { savedPicks, togglePick, makePickId, isSaved } from '../lib/tracking';
  import GameCardSkeleton from '../lib/components/GameCardSkeleton.svelte';
  import AnimatedPercent from '../lib/components/AnimatedPercent.svelte';
  import SaveButton from '../lib/components/SaveButton.svelte';

  const CACHE_KEY = 'nba-odds';
  const TTL_MS = 10 * 60 * 1000;

  let games = $state<OddsEvent[] | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let updatedAgo = $state<number | null>(null);
  let expandedGameId = $state<string | null>(null);
  let injuries = $state<InjuryAthlete[]>([]);

  // For each game, list of injuries from either team
  function gameInjuries(event: OddsEvent): InjuryAthlete[] {
    return injuries.filter(
      (i) => i.team === event.home_team || i.team === event.away_team
    );
  }

  function toggleExpand(id: string) {
    expandedGameId = expandedGameId === id ? null : id;
  }

  /**
   * Predicted final score derived from the market spread + total.
   *   favorite_pts = (total + |spread|) / 2
   *   underdog_pts = (total - |spread|) / 2
   * Returns null if the necessary lines aren't available.
   */
  function predictedScore(event: OddsEvent) {
    const spreadMarket = (() => {
      for (const bk of event.bookmakers) {
        const m = bk.markets.find((m) => m.key === 'spreads');
        if (m) return m;
      }
      return null;
    })();
    const total = (() => {
      for (const bk of event.bookmakers) {
        const m = bk.markets.find((m) => m.key === 'totals');
        if (m?.outcomes[0]?.point !== undefined) return m.outcomes[0].point;
      }
      return null;
    })();
    if (!spreadMarket || total === null) return null;

    const home = spreadMarket.outcomes.find((o) => o.name === event.home_team);
    const away = spreadMarket.outcomes.find((o) => o.name === event.away_team);
    if (!home || !away || home.point === undefined || away.point === undefined) return null;

    const homePts = (total + -home.point) / 2;
    const awayPts = (total + -away.point) / 2;
    return { homePts, awayPts };
  }

  async function load(force = false) {
    loading = true;
    error = null;
    // injuries load in parallel, non-blocking
    fetchNbaInjuries()
      .then((data) => (injuries = data))
      .catch(() => {
        // skip silently — non-critical
      });
    try {
      if (!force) {
        const cached = getCached<OddsEvent[]>(CACHE_KEY, TTL_MS);
        if (cached) {
          games = cached;
          updatedAgo = cacheAge(CACHE_KEY);
          loading = false;
          return;
        }
      }
      const data = await fetchNbaOdds();
      setCached(CACHE_KEY, data);
      games = data;
      updatedAgo = 0;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  $effect(() => { load(); });

  function findMarket(event: OddsEvent, key: string) {
    for (const bk of event.bookmakers) {
      const m = bk.markets.find((m) => m.key === key);
      if (m) return m;
    }
    return null;
  }

  function spreadFor(event: OddsEvent, team: string): Outcome | null {
    return findMarket(event, 'spreads')?.outcomes.find((o) => o.name === team) ?? null;
  }

  function mlFor(event: OddsEvent, team: string): Outcome | null {
    return findMarket(event, 'h2h')?.outcomes.find((o) => o.name === team) ?? null;
  }

  function totalLine(event: OddsEvent): number | null {
    return findMarket(event, 'totals')?.outcomes[0]?.point ?? null;
  }
</script>

<header class="mb-6 flex items-end justify-between">
  <div>
    <p class="text-sm text-neutral-500">
      {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
    </p>
    <h1 class="text-2xl font-semibold tracking-tight">Today's Games</h1>
    {#if updatedAgo !== null && games}
      <p class="mt-1 text-xs text-neutral-600">Updated {shortAge(updatedAgo)}</p>
    {/if}
  </div>
  <button
    onclick={() => load(true)}
    disabled={loading}
    class="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-neutral-800 disabled:opacity-50"
  >
    {loading ? '...' : 'Refresh'}
  </button>
</header>

{#if loading && !games}
  <section class="space-y-3">
    {#each Array(3) as _, i (i)}
      <GameCardSkeleton />
    {/each}
  </section>
{:else if error}
  <div class="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-red-300">
    <p class="text-sm font-medium">Couldn't load games</p>
    <p class="mt-1 text-xs">{error}</p>
  </div>
{:else if games && games.length === 0}
  <div class="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-center text-neutral-400">
    No NBA games available right now.
  </div>
{:else if games}
  <section class="space-y-3">
    {#each games as game (game.id)}
      {@const total = totalLine(game)}
      {@const mlPick = favoredOutcome(game, 'h2h')}
      {@const spreadPick = favoredOutcome(game, 'spreads')}
      {@const totalPick = favoredOutcome(game, 'totals')}
      {@const pickColor = mlPick ? teamColors(mlPick.name).primary : '#737373'}
      {@const isExpanded = expandedGameId === game.id}
      {@const score = predictedScore(game)}
      {@const gameInj = gameInjuries(game)}
      {@const outCount = gameInj.filter((i) => i.status === 'Out').length}
      <div
        class="overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 transition-colors hover:border-neutral-700 cursor-pointer"
        onclick={() => toggleExpand(game.id)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleExpand(game.id)}
        role="button"
        tabindex="0"
      >
        <div class="h-1.5" style="background: {matchupGradient(game.away_team, game.home_team)}"></div>
        <div class="p-4">
        <div class="mb-3 flex items-center justify-between text-xs text-neutral-500">
          <span>{tipoffTime(game.commence_time)}</span>
          <div class="flex items-center gap-2">
            {#if outCount > 0}
              <span class="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-red-300 ring-1 ring-red-500/30">
                {outCount} OUT
              </span>
            {/if}
            <span>{game.bookmakers[0]?.title ?? '—'}</span>
          </div>
        </div>

        {#if mlPick}
          {@const mlPickId = makePickId(game.id, 'h2h', `${teamAbbr(mlPick.name)} ML`)}
          {@const mlSaved = isSaved($savedPicks, mlPickId)}
          <div
            class="mb-4 flex items-center justify-between gap-2 rounded-xl px-4 py-3 ring-1"
            style="background: color-mix(in srgb, {pickColor} 14%, transparent); --tw-ring-color: color-mix(in srgb, {pickColor} 40%, transparent);"
          >
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Model Pick</p>
              <p class="mt-0.5 text-base font-semibold text-neutral-50">
                {teamAbbr(mlPick.name)} <span class="text-neutral-400">ML</span>
              </p>
            </div>
            <div class="flex items-center gap-1">
              <div class="text-right" style="color: {pickColor}; filter: brightness(1.4) saturate(0.9);">
                <AnimatedPercent
                  value={mlPick.prob}
                  class="font-mono text-2xl font-bold leading-none"
                />
                <p class="mt-1 text-[10px] uppercase tracking-wider" style="color: #737373; filter: none;">to win</p>
              </div>
              <SaveButton
                saved={mlSaved}
                onclick={() =>
                  togglePick({
                    id: mlPickId,
                    eventId: game.id,
                    kind: 'h2h',
                    kindLabel: 'Moneyline',
                    description: `${teamAbbr(mlPick.name)} ML`,
                    matchup: `${teamAbbr(game.away_team)} @ ${teamAbbr(game.home_team)}`,
                    tipoff: tipoffTime(game.commence_time),
                    prob: mlPick.prob
                  })}
              />
            </div>
          </div>
        {/if}

        <div class="space-y-2">
          {#each [game.away_team, game.home_team] as team}
            {@const spread = spreadFor(game, team)}
            {@const ml = mlFor(game, team)}
            {@const c = teamColors(team)}
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style="background: {c.primary}"></span>
                <span class="inline-block w-10 font-mono text-xs text-neutral-500">{teamAbbr(team)}</span>
                <span class="text-sm text-neutral-200">{team}</span>
              </div>
              <div class="flex gap-2 text-xs">
                {#if spread}
                  <span class="rounded-md bg-neutral-800 px-2 py-1 text-neutral-200">
                    {signedPoint(spread.point)}
                    <span class="text-neutral-500"> ({americanOdds(spread.price)})</span>
                  </span>
                {/if}
                {#if ml}
                  <span class="rounded-md bg-neutral-800 px-2 py-1 text-neutral-300">
                    {americanOdds(ml.price)}
                  </span>
                {/if}
              </div>
            </div>
          {/each}
          {#if total !== null}
            <div class="mt-2 flex items-center justify-between border-t border-neutral-800 pt-2 text-xs">
              <span class="text-neutral-500">Total</span>
              <span class="rounded-md bg-neutral-800 px-2 py-1 text-neutral-200">O/U {total}</span>
            </div>
          {/if}

          {#if spreadPick || totalPick}
            <div class="mt-3 grid grid-cols-2 gap-2 border-t border-neutral-800 pt-3 text-xs">
              {#if spreadPick}
                <div class="rounded-lg bg-neutral-800/60 px-2 py-1.5">
                  <p class="text-neutral-500">Spread lean</p>
                  <p class="mt-0.5 text-neutral-200">
                    {teamAbbr(spreadPick.name)} {signedPoint(spreadPick.point)}
                    <span class="ml-1 text-orange-300">{pct(spreadPick.prob)}</span>
                  </p>
                </div>
              {/if}
              {#if totalPick}
                <div class="rounded-lg bg-neutral-800/60 px-2 py-1.5">
                  <p class="text-neutral-500">Total lean</p>
                  <p class="mt-0.5 text-neutral-200">
                    {totalPick.name} {totalPick.point}
                    <span class="ml-1 text-orange-300">{pct(totalPick.prob)}</span>
                  </p>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Expand / collapse affordance -->
        <div class="mt-3 flex items-center justify-center gap-1 border-t border-neutral-800/60 pt-2 text-[10px] uppercase tracking-wider text-neutral-500">
          <span>{isExpanded ? 'Hide details' : 'Tap for details'}</span>
          <svg
            class="h-3 w-3 transition-transform {isExpanded ? 'rotate-180' : ''}"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        </div>

        {#if isExpanded}
          <div
            class="border-t border-neutral-800 bg-neutral-950/40 p-4 space-y-4"
            transition:slide={{ duration: 200 }}
          >
            <!-- Predicted score -->
            {#if score}
              <div>
                <p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Predicted final score
                </p>
                <div class="flex items-center justify-between rounded-xl bg-neutral-900/70 px-4 py-3 ring-1 ring-neutral-800">
                  <div class="flex items-center gap-2">
                    <span class="inline-block h-2.5 w-2.5 rounded-full" style="background: {teamColors(game.away_team).primary}"></span>
                    <span class="text-sm text-neutral-200">{teamAbbr(game.away_team)}</span>
                  </div>
                  <div class="font-mono text-lg font-bold text-neutral-100">
                    {score.awayPts.toFixed(1)} – {score.homePts.toFixed(1)}
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-neutral-200">{teamAbbr(game.home_team)}</span>
                    <span class="inline-block h-2.5 w-2.5 rounded-full" style="background: {teamColors(game.home_team).primary}"></span>
                  </div>
                </div>
                <p class="mt-1.5 text-[10px] text-neutral-600">
                  Derived from the consensus spread + total
                </p>
              </div>
            {/if}

            <!-- Injury report -->
            {#if gameInj.length > 0}
              <div>
                <p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Injury report · {gameInj.length} listed
                </p>
                <div class="space-y-1">
                  {#each gameInj.slice(0, 8) as inj (inj.name)}
                    {@const ui = injuryUI(inj.status)}
                    <div class="flex items-center justify-between rounded-md bg-neutral-900/50 px-3 py-1.5 text-xs">
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="inline-block h-2 w-2 shrink-0 rounded-full" style="background: {teamColors(inj.team).primary}"></span>
                        <span class="truncate text-neutral-200">{inj.name}</span>
                      </div>
                      <span class="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider ring-1 {ui.classes}">
                        {ui.label}
                      </span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Per-bookmaker moneyline shop -->
            {#if game.bookmakers.length > 1}
              <div>
                <p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Line shopping · {game.bookmakers.length} books
                </p>
                <div class="space-y-1">
                  {#each game.bookmakers.slice(0, 6) as bk (bk.key)}
                    {@const h2h = bk.markets.find((m) => m.key === 'h2h')}
                    {#if h2h}
                      {@const aOut = h2h.outcomes.find((o) => o.name === game.away_team)}
                      {@const hOut = h2h.outcomes.find((o) => o.name === game.home_team)}
                      <div class="flex items-center justify-between rounded-md bg-neutral-900/50 px-3 py-1.5 text-xs">
                        <span class="text-neutral-400">{bk.title}</span>
                        <div class="flex gap-2 font-mono">
                          {#if aOut}<span class="text-neutral-300">{teamAbbr(game.away_team)} {americanOdds(aOut.price)}</span>{/if}
                          {#if hOut}<span class="text-neutral-300">{teamAbbr(game.home_team)} {americanOdds(hOut.price)}</span>{/if}
                        </div>
                      </div>
                    {/if}
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </section>
{/if}
