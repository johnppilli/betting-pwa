<script lang="ts">
  import Skeleton from './Skeleton.svelte';
</script>

<article class="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
  <div class="mb-3 flex items-center justify-between">
    <Skeleton class="h-3 w-20" />
    <Skeleton class="h-3 w-16" />
  </div>
  <Skeleton class="mb-3 h-9 w-full" rounded="xl" />
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Skeleton class="h-3 w-10" />
        <Skeleton class="h-3 w-36" />
      </div>
      <div class="flex gap-2">
        <Skeleton class="h-6 w-16" />
        <Skeleton class="h-6 w-12" />
      </div>
    </div>
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Skeleton class="h-3 w-10" />
        <Skeleton class="h-3 w-32" />
      </div>
      <div class="flex gap-2">
        <Skeleton class="h-6 w-16" />
        <Skeleton class="h-6 w-12" />
      </div>
    </div>
  </div>
</article>
