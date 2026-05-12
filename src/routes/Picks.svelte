<script lang="ts">
  import { fetchNbaOdds, fetchNbaEventProps, type OddsEvent } from '../lib/api/odds';
  import { getCached, setCached, cacheAge } from '../lib/api/cache';
  import { consensusProbabilities, favoredSide, pct } from '../lib/predict/probability';
  import { signedPoint, tipoffTime, teamAbbr, shortAge } from '../lib/format';
  import { settings } from '../lib/settings';
  import PickRowSkeleton from '../lib/components/PickRowSkeleton.svelte';

  const GAMES_CACHE = 'nba-odds';
  const TTL_MS = 10 * 60 * 1000;

  const STAT_LABELS: Record<string, string> = {
    player_points: 'Points',
    player_rebounds: 'Rebounds',
    player_assists: 'Assists',
    player_threes: 'Threes'
  };

  interface Pick {
    kind: 'spread' | 'total' | 'h2h' | 'prop';
    kindLabel: string;
    eventId: string;
    matchup: string;
    tipoff: string;
    description: string;   // e.g. "LAL ML", "Over 224.5", "LeBron James Points 26.5 Over"
    prob: number;          // de-vigged consensus
  }

  let allPicks = $state<Pick[]>([]);
  let picks = $derived(
    allPicks
      .filter((p) => p.prob >= $settings.pickThreshold)
      .sort((a, b) => b.prob - a.prob)
  );
  let loading = $state(true);
  let error = $state<string | null>(null);
  let updatedAgo = $state<number | null>(null);

  async function load() {
    loading = true;
    error = null;
    try {
      // 1. Games (cached)
      let games = getCached<OddsEvent[]>(GAMES_CACHE, TTL_MS);
      if (!games) {
        games = await fetchNbaOdds();
        setCached(GAMES_CACHE, games);
      }

      const collected: Pick[] = [];

      // 2. Game-level picks: moneyline / spread / total per game
      for (const g of games) {
        const matchup = `${teamAbbr(g.away_team)} @ ${teamAbbr(g.home_team)}`;
        const tipoff = tipoffTime(g.commence_time);

        const ml = favoredSide(consensusProbabilities(g, 'h2h'));
        if (ml) {
          collected.push({
            kind: 'h2h',
            kindLabel: 'Moneyline',
            eventId: g.id,
            matchup,
            tipoff,
            description: `${teamAbbr(ml.name)} ML`,
            prob: ml.prob
          });
        }

        const sp = favoredSide(consensusProbabilities(g, 'spreads'));
        if (sp) {
          collected.push({
            kind: 'spread',
            kindLabel: 'Spread',
            eventId: g.id,
            matchup,
            tipoff,
            description: `${teamAbbr(sp.name)} ${signedPoint(sp.point)}`,
            prob: sp.prob
          });
        }

        const tot = favoredSide(consensusProbabilities(g, 'totals'));
        if (tot && tot.point !== undefined) {
          collected.push({
            kind: 'total',
            kindLabel: 'Total',
            eventId: g.id,
            matchup,
            tipoff,
            description: `${tot.name} ${tot.point}`,
            prob: tot.prob
          });
        }
      }

      // 3. Player prop picks: pull each event's props (cached separately, 10min TTL)
      for (const g of games) {
        const cacheKey = `props-${g.id}`;
        let propsEvent = getCached<OddsEvent>(cacheKey, TTL_MS);
        if (!propsEvent) {
          try {
            propsEvent = await fetchNbaEventProps(g.id);
            setCached(cacheKey, propsEvent);
          } catch {
            continue; // skip if props not yet posted
          }
        }
        if (!propsEvent) continue;

        const matchup = `${teamAbbr(g.away_team)} @ ${teamAbbr(g.home_team)}`;
        const tipoff = tipoffTime(g.commence_time);

        for (const marketKey of Object.keys(STAT_LABELS)) {
          const stat = STAT_LABELS[marketKey];
          const entries = consensusProbabilities(propsEvent, marketKey);

          // group by (description, point) and pick favored
          const grouped: Record<string, typeof entries> = {};
          for (const e of entries) {
            const k = `${e.description ?? ''}|${e.point ?? ''}`;
            if (!grouped[k]) grouped[k] = [];
            grouped[k].push(e);
          }
          for (const k in grouped) {
            const fav = favoredSide(grouped[k]);
            if (!fav || !fav.description || fav.point === undefined) continue;
            collected.push({
              kind: 'prop',
              kindLabel: stat,
              eventId: g.id,
              matchup,
              tipoff,
              description: `${fav.description} • ${stat} ${fav.point} ${fav.name}`,
              prob: fav.prob
            });
          }
        }
      }

      // Sort + filter happen reactively in $derived above
      allPicks = collected;
      updatedAgo = cacheAge(GAMES_CACHE);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  $effect(() => { load(); });

  function badgeColor(prob: number): string {
    if (prob >= 0.7) return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30';
    if (prob >= 0.6) return 'bg-orange-500/15 text-orange-300 ring-orange-500/30';
    return 'bg-neutral-800 text-neutral-300 ring-neutral-700';
  }
</script>

<header class="mb-4">
  <h1 class="text-2xl font-semibold tracking-tight">Top Picks</h1>
  <p class="text-sm text-neutral-500">Highest-confidence plays across today's games</p>
  {#if updatedAgo !== null && !loading}
    <p class="mt-1 text-xs text-neutral-600">Updated {shortAge(updatedAgo)}</p>
  {/if}
</header>

{#if loading}
  <section class="space-y-2">
    {#each Array(6) as _, i (i)}
      <PickRowSkeleton />
    {/each}
  </section>
{:else if error}
  <div class="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-red-300">
    <p class="text-sm font-medium">Couldn't load picks</p>
    <p class="mt-1 text-xs">{error}</p>
  </div>
{:else if picks.length === 0}
  <div class="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-center text-neutral-400">
    <p>Nothing strong enough to flag right now.</p>
    <p class="mt-1 text-xs text-neutral-600">Most markets are within the bookmaker's vig — check back closer to tip-off.</p>
  </div>
{:else}
  <section class="space-y-2">
    {#each picks as p, i (p.eventId + p.kindLabel + p.description + i)}
      <article class="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-neutral-100">{p.description}</p>
            <p class="mt-0.5 text-xs text-neutral-500">
              <span class="text-neutral-400">{p.kindLabel}</span>
              <span class="mx-1">·</span>
              {p.matchup}
              <span class="mx-1">·</span>
              {p.tipoff}
            </p>
          </div>
          <span class="shrink-0 rounded-md px-2 py-1 font-mono text-xs font-medium ring-1 {badgeColor(p.prob)}">
            {pct(p.prob)}
          </span>
        </div>
      </article>
    {/each}
  </section>

  <p class="mt-4 text-center text-xs text-neutral-600">
    Probabilities are vig-adjusted consensus across all bookmakers for the market.
  </p>
{/if}
