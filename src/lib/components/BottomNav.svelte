<script lang="ts">
  import { currentPath } from '../router';

  const tabs = [
    { path: '/', label: 'Games', icon: 'games' },
    { path: '/props', label: 'Props', icon: 'props' },
    { path: '/picks', label: 'Top Picks', icon: 'picks' },
    { path: '/settings', label: 'Settings', icon: 'settings' }
  ];
</script>

<nav class="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
  <ul class="mx-auto flex max-w-md items-stretch justify-around">
    {#each tabs as tab (tab.path)}
      {@const active = tab.path === '/' ? $currentPath === '/' : $currentPath.startsWith(tab.path)}
      <li class="flex-1">
        <a
          href={'#' + tab.path}
          class="flex flex-col items-center gap-1 py-3 text-xs transition-colors {active ? 'text-orange-400' : 'text-neutral-500 hover:text-neutral-300'}"
        >
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            {#if tab.icon === 'games'}
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18 M12 3v18 M5 5q7 7 0 14 M19 5q-7 7 0 14" stroke-linecap="round" />
            {:else if tab.icon === 'props'}
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            {:else if tab.icon === 'picks'}
              <path d="M6 4h12v17l-6-4-6 4z" stroke-linejoin="round" />
            {:else if tab.icon === 'settings'}
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            {/if}
          </svg>
          <span>{tab.label}</span>
        </a>
      </li>
    {/each}
  </ul>
</nav>
