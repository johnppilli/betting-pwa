<script lang="ts">
  // Tiny generic skeleton — animates a soft pulse on a neutral block
  let { class: className = '', rounded = 'md' } = $props<{ class?: string; rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' }>();
  const roundedMap: Record<string, string> = {
    sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg',
    xl: 'rounded-xl', '2xl': 'rounded-2xl', full: 'rounded-full'
  };
</script>

<div class="animate-pulse bg-neutral-800/70 {roundedMap[rounded]} {className}"></div>
