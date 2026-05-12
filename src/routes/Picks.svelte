<script lang="ts">
  import { fetchNbaOdds, fetchNbaEventProps, type OddsEvent } from '../lib/api/odds';
  import { getCached, setCached, cacheAge } from '../lib/api/cache';
  import { consensusProbabilities, favoredSide, pct } from '../lib/predict/probability';
  import { signedPoint, tipoffTime, teamAbbr, shortAge } from '../lib/format';
  import { settings } from '../lib/settings';
  import {
    savedPicks,
    togglePick,
    markResult,
    clearResult,
    deletePick,
    makePickId,
    isSaved,
    pickStats,
    type SavedPick
  } from '../lib/tracking';
  import PickRowSkeleton from '../lib/components/PickRowSkeleton.svelte';
  import AnimatedPercent from '../lib/components/AnimatedPercent.svelte';
  import SaveButton from '../lib/components/SaveButton.svelte';

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

  // Tier label + small icon-glyph for the leading line of each pick
  function tierLabel(prob: number): string {
    if (prob >= 0.7) return 'Strong';
    if (prob >= 0.6) return 'Lean';
    return 'Edge';
  }

  function kindAccent(kind: string): string {
    // Subtle left-border stripe color per pick type
    switch (kind) {
      case 'h2h': return 'border-l-rose-500/60';
      case 'spread': return 'border-l-orange-500/60';
      case 'total': return 'border-l-sky-500/60';
      case 'prop': return 'border-l-violet-500/60';
      default: return 'border-l-neutral-700';
    }
  }

  let stats = $derived(pickStats($savedPicks));

  function toggleSave(p: Pick) {
    togglePick({
      id: makePickId(p.eventId, p.kind, p.description),
      eventId: p.eventId,
      kind: p.kind,
      kindLabel: p.kindLabel,
      description: p.description,
      matchup: p.matchup,
      tipoff: p.tipoff,
      prob: p.prob
    });
  }
</script>

<header class="mb-4">
  <h1 class="text-2xl font-semibold tracking-tight">Top Picks</h1>
  <p class="text-sm text-neutral-500">Highest-confidence plays across today's games</p>
  {#if updatedAgo !== null && !loading}
    <p class="mt-1 text-xs text-neutral-600">Updated {shortAge(updatedAgo)}</p>
  {/if}
</header>

<!-- Your record stats -->
{#if stats.total > 0}
  <div class="mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900/80 to-neutral-900/40 p-3">
    <div class="text-center">
      <p class="text-[10px] uppercase tracking-wider text-neutral-500">Record</p>
      <p class="mt-0.5 font-mono text-lg font-semibold text-neutral-100">
        {stats.hits}<span class="text-neutral-500">-</span>{stats.misses}
      </p>
    </div>
    <div class="text-center">
      <p class="text-[10px] uppercase tracking-wider text-neutral-500">Accuracy</p>
      <p class="mt-0.5 font-mono text-lg font-semibold {stats.resolved === 0 ? 'text-neutral-500' : stats.accuracy >= 0.55 ? 'text-emerald-300' : stats.accuracy >= 0.5 ? 'text-orange-300' : 'text-rose-300'}">
        {stats.resolved === 0 ? '—' : Math.round(stats.accuracy * 100) + '%'}
      </p>
    </div>
    <div class="text-center">
      <p class="text-[10px] uppercase tracking-wider text-neutral-500">Pending</p>
      <p class="mt-0.5 font-mono text-lg font-semibold text-neutral-100">{stats.pending}</p>
    </div>
  </div>
{/if}

<!-- Saved picks -->
{#if $savedPicks.length > 0}
  <section class="mb-5">
    <h2 class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
      Your saved picks · {$savedPicks.length}
    </h2>
    <div class="space-y-2">
      {#each $savedPicks as p (p.id)}
        <article class="rounded-xl border border-l-4 border-neutral-800 bg-gradient-to-r from-neutral-900/80 to-neutral-900/40 p-3 {kindAccent(p.kind)}">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="mb-0.5 flex items-center gap-2 text-[10px] uppercase tracking-wider">
                <span class="text-neutral-400">{p.kindLabel}</span>
                {#if p.result === 'hit'}
                  <span class="rounded bg-emerald-500/20 px-1.5 py-px font-semibold text-emerald-300 ring-1 ring-emerald-500/40">✓ Hit</span>
                {:else if p.result === 'miss'}
                  <span class="rounded bg-rose-500/20 px-1.5 py-px font-semibold text-rose-300 ring-1 ring-rose-500/40">✗ Miss</span>
                {/if}
              </div>
              <p class="truncate text-sm font-medium text-neutral-100">{p.description}</p>
              <p class="mt-0.5 text-[11px] text-neutral-500">
                {p.matchup}
                <span class="mx-1">·</span>
                {p.tipoff}
                <span class="mx-1">·</span>
                <span class="font-mono">{pct(p.prob)}</span>
              </p>
            </div>
          </div>

          <!-- Action buttons -->
          <div class="mt-2 flex items-center gap-1.5 border-t border-neutral-800/60 pt-2">
            {#if p.result === 'pending'}
              <button
                onclick={() => markResult(p.id, 'hit')}
                class="flex-1 rounded-md bg-emerald-500/15 px-2 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
              >
                ✓ Hit
              </button>
              <button
                onclick={() => markResult(p.id, 'miss')}
                class="flex-1 rounded-md bg-rose-500/15 px-2 py-1.5 text-xs font-semibold text-rose-300 ring-1 ring-rose-500/30 transition hover:bg-rose-500/25"
              >
                ✗ Miss
              </button>
            {:else}
              <button
                onclick={() => clearResult(p.id)}
                class="flex-1 rounded-md bg-neutral-800 px-2 py-1.5 text-xs text-neutral-300 transition hover:bg-neutral-700"
              >
                Undo
              </button>
            {/if}
            <button
              onclick={() => deletePick(p.id)}
              class="rounded-md bg-neutral-800/60 px-2 py-1.5 text-xs text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
              title="Remove from saved"
              aria-label="Remove"
            >
              🗑
            </button>
          </div>
        </article>
      {/each}
    </div>
  </section>
{/if}

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
  {#if $savedPicks.length > 0}
    <h2 class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
      Today's picks · model-generated
    </h2>
  {/if}
  <section class="space-y-2">
    {#each picks as p, i (p.eventId + p.kindLabel + p.description + i)}
      {@const pickId = makePickId(p.eventId, p.kind, p.description)}
      {@const saved = isSaved($savedPicks, pickId)}
      <article class="rounded-xl border border-l-4 border-neutral-800 bg-gradient-to-r from-neutral-900/80 to-neutral-900/40 p-3 {kindAccent(p.kind)}">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="mb-0.5 flex items-center gap-2 text-[10px] uppercase tracking-wider">
              <span class="text-neutral-400">{p.kindLabel}</span>
              <span class="rounded {badgeColor(p.prob)} px-1.5 py-px font-semibold ring-1">
                {tierLabel(p.prob)}
              </span>
            </div>
            <p class="truncate text-sm font-medium text-neutral-100">{p.description}</p>
            <p class="mt-0.5 text-[11px] text-neutral-500">
              {p.matchup}
              <span class="mx-1">·</span>
              {p.tipoff}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <div class="text-right">
              <AnimatedPercent
                value={p.prob}
                class="font-mono text-xl font-bold leading-none {p.prob >= 0.7 ? 'text-emerald-300' : p.prob >= 0.6 ? 'text-orange-300' : 'text-neutral-300'}"
              />
              <p class="mt-1 text-[9px] uppercase tracking-wider text-neutral-500">confidence</p>
            </div>
            <SaveButton {saved} onclick={() => toggleSave(p)} />
          </div>
        </div>
      </article>
    {/each}
  </section>

  <p class="mt-4 text-center text-xs text-neutral-600">
    Vig-adjusted consensus across all bookmakers.
  </p>
{/if}
