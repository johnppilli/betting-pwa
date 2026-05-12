<script lang="ts">
  import Skeleton from './Skeleton.svelte';
</script>

<article class="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
  <div class="flex items-start justify-between gap-3">
    <div class="min-w-0 flex-1 space-y-1.5">
      <Skeleton class="h-3.5 w-3/5" />
      <Skeleton class="h-3 w-2/5" />
    </div>
    <Skeleton class="h-6 w-12 shrink-0" />
  </div>
</article>
