import { writable } from 'svelte/store';

function getPath(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.hash.slice(1) || '/';
}

export const currentPath = writable<string>(getPath());

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    currentPath.set(getPath());
  });
}

export function navigate(path: string) {
  window.location.hash = path;
}
