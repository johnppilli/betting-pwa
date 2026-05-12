<script lang="ts">
  import Skeleton from './Skeleton.svelte';
</script>

<article class="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
  <Skeleton class="mb-3 h-4 w-32" />
  <div class="space-y-2">
    {#each Array(3) as _, i (i)}
      <div class="flex items-center justify-between">
        <Skeleton class="h-3 w-24" />
        <div class="flex gap-2">
          <Skeleton class="h-6 w-14" />
          <Skeleton class="h-6 w-14" />
          <Skeleton class="h-3 w-8" />
        </div>
      </div>
    {/each}
  </div>
</article>
