<script lang="ts">
  import { fade } from 'svelte/transition';
  import { currentPath } from './lib/router';
  import BottomNav from './lib/components/BottomNav.svelte';
  import Games from './routes/Games.svelte';
  import Props from './routes/Props.svelte';
  import Picks from './routes/Picks.svelte';
  import Settings from './routes/Settings.svelte';
</script>

<div class="min-h-dvh pb-24">
  <main class="safe-top mx-auto max-w-md px-4 pt-4">
    {#key $currentPath}
      <div in:fade={{ duration: 140 }}>
        {#if $currentPath === '/'}
          <Games />
        {:else if $currentPath === '/props'}
          <Props />
        {:else if $currentPath === '/picks'}
          <Picks />
        {:else if $currentPath === '/settings'}
          <Settings />
        {:else}
          <p class="text-center text-neutral-400">Page not found</p>
        {/if}
      </div>
    {/key}
  </main>
  <BottomNav />
</div>
