import { writable } from 'svelte/store';

const KEY = 'settings:v1';

interface AppSettings {
  /** Min de-vig probability for a play to show on Top Picks (0..1) */
  pickThreshold: number;
}

const DEFAULTS: AppSettings = {
  pickThreshold: 0.52
};

function load(): AppSettings {
  if (typeof localStorage === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export const settings = writable<AppSettings>(load());

settings.subscribe((s) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
});

/** Drop every odds-cache:* entry so the next page load refetches everything. */
export function clearOddsCache(): number {
  if (typeof localStorage === 'undefined') return 0;
  let n = 0;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('odds-cache:')) toRemove.push(k);
  }
  for (const k of toRemove) {
    localStorage.removeItem(k);
    n++;
  }
  return n;
}
