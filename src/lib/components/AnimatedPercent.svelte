<script lang="ts">
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  let { value, class: className = '' } = $props<{ value: number; class?: string }>();

  // Static initial value + duration. Svelte 5 requires reactive props to be
  // read inside closures (effects), not as constructor args.
  const tween = new Tween(0, { duration: 700, easing: cubicOut });

  $effect(() => {
    tween.target = value;
  });
</script>

<span class={className}>{Math.round(tween.current * 100)}%</span>
