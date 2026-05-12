<script lang="ts">
  import { settings, clearOddsCache } from '../lib/settings';
  import { pct } from '../lib/predict/probability';

  let clearStatus = $state<string | null>(null);

  function handleClear() {
    const n = clearOddsCache();
    clearStatus = n === 0 ? 'Cache was already empty.' : `Cleared ${n} cached request${n === 1 ? '' : 's'}.`;
    setTimeout(() => (clearStatus = null), 2500);
  }
</script>

<header class="mb-6">
  <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
</header>

<section class="space-y-3">
  <!-- Confidence threshold -->
  <div class="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
    <div class="mb-2 flex items-center justify-between">
      <p class="text-sm font-medium text-neutral-100">Top Picks threshold</p>
      <span class="font-mono text-sm text-orange-300">≥ {pct($settings.pickThreshold)}</span>
    </div>
    <p class="mb-3 text-xs text-neutral-500">
      Only show plays where the consensus probability is at least this. Higher = fewer, more confident picks.
    </p>
    <input
      type="range"
      min="0.5"
      max="0.8"
      step="0.01"
      bind:value={$settings.pickThreshold}
      class="w-full accent-orange-500"
    />
    <div class="mt-1 flex justify-between text-[10px] text-neutral-600">
      <span>50%</span>
      <span>65%</span>
      <span>80%</span>
    </div>
  </div>

  <!-- Cache management -->
  <div class="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-neutral-100">Refresh data</p>
        <p class="mt-0.5 text-xs text-neutral-500">Clear cached odds so the next load is live.</p>
      </div>
      <button
        onclick={handleClear}
        class="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 transition hover:bg-neutral-800"
      >
        Clear cache
      </button>
    </div>
    {#if clearStatus}
      <p class="mt-2 text-xs text-emerald-400">{clearStatus}</p>
    {/if}
  </div>

  <!-- Sports -->
  <div class="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
    <p class="mb-2 text-sm font-medium text-neutral-100">Sports</p>
    <div class="space-y-1.5">
      <div class="flex items-center justify-between text-xs">
        <span class="text-neutral-200">NBA</span>
        <span class="rounded-md bg-emerald-500/15 px-2 py-0.5 text-emerald-300 ring-1 ring-emerald-500/30">
          Enabled
        </span>
      </div>
      {#each ['NFL', 'MLB', 'College Football', 'College Basketball'] as sport (sport)}
        <div class="flex items-center justify-between text-xs">
          <span class="text-neutral-500">{sport}</span>
          <span class="text-neutral-600">Coming soon</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- About -->
  <div class="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
    <p class="mb-2 text-sm font-medium text-neutral-100">About</p>
    <div class="space-y-1.5 text-xs text-neutral-500">
      <div class="flex justify-between">
        <span>Data</span>
        <span class="text-neutral-300">The Odds API</span>
      </div>
      <div class="flex justify-between">
        <span>Model</span>
        <span class="text-neutral-300">Consensus de-vig</span>
      </div>
      <div class="flex justify-between">
        <span>Source</span>
        <a
          href="https://github.com/johnppilli/betting-pwa"
          target="_blank"
          rel="noreferrer"
          class="text-orange-300 hover:underline"
        >
          GitHub
        </a>
      </div>
    </div>
  </div>
</section>
