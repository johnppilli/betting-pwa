<script lang="ts">
  let { saved, onclick: handleClick, class: className = '' } = $props<{
    saved: boolean;
    onclick: (e: Event) => void;
    class?: string;
  }>();

  function handle(e: Event) {
    e.stopPropagation();
    handleClick(e);
  }
</script>

<button
  type="button"
  onclick={handle}
  class="rounded-md p-1.5 transition hover:bg-neutral-800/80 {className}"
  aria-label={saved ? 'Remove from saved' : 'Save pick'}
  title={saved ? 'Remove from saved' : 'Save pick'}
>
  <svg
    class="h-4 w-4 transition-colors {saved ? 'text-orange-400' : 'text-neutral-500'}"
    fill={saved ? 'currentColor' : 'none'}
    stroke="currentColor"
    stroke-width="2"
    viewBox="0 0 24 24"
  >
    <path d="M6 4h12v17l-6-4-6 4z" stroke-linejoin="round" />
  </svg>
</button>
