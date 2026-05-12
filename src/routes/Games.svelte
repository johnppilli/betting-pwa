<script lang="ts">
  import { fetchNbaOdds, type OddsEvent, type Outcome } from '../lib/api/odds';
  import { getCached, setCached, cacheAge } from '../lib/api/cache';
  import { americanOdds, signedPoint, tipoffTime, teamAbbr, shortAge } from '../lib/format';
  import { favoredOutcome, pct } from '../lib/predict/probability';
  import { teamColors, matchupGradient } from '../lib/teams';
  import GameCardSkeleton from '../lib/components/GameCardSkeleton.svelte';

  const CACHE_KEY = 'nba-odds';
  const TTL_MS = 10 * 60 * 1000;

  let games = $state<OddsEvent[] | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let updatedAgo = $state<number | null>(null);

  async function load(force = false) {
    loading = true;
    error = null;
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
      <article class="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60">
        <div class="h-1" style="background: {matchupGradient(game.away_team, game.home_team)}"></div>
        <div class="p-4">
        <div class="mb-3 flex items-center justify-between text-xs text-neutral-500">
          <span>{tipoffTime(game.commence_time)}</span>
          <span>{game.bookmakers[0]?.title ?? '—'}</span>
        </div>

        {#if mlPick}
          <div class="mb-3 flex items-center justify-between rounded-xl bg-orange-500/10 px-3 py-2 ring-1 ring-orange-500/30">
            <div class="text-xs">
              <span class="text-orange-300/70">Pick</span>
              <span class="ml-2 font-medium text-orange-200">{teamAbbr(mlPick.name)} ML</span>
            </div>
            <span class="rounded-md bg-orange-500/20 px-2 py-0.5 font-mono text-xs font-medium text-orange-200">
              {pct(mlPick.prob)}
            </span>
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
        </div>
      </article>
    {/each}
  </section>
{/if}
