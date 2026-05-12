// Locally-tracked picks. The user taps "save" on any pick they like, places
// the bet wherever they bet, and comes back to tap Hit/Miss after the game.
// All persisted in localStorage — no backend, no account.

import { writable } from 'svelte/store';

export type PickKind = 'h2h' | 'spread' | 'total' | 'prop';
export type PickResult = 'pending' | 'hit' | 'miss';

export interface SavedPick {
  id: string;            // unique: eventId|kind|description
  eventId: string;
  kind: PickKind;
  kindLabel: string;     // "Moneyline", "Points", etc.
  description: string;   // human-readable: "SAS ML", "Anthony Edwards Points 24.5 Over"
  matchup: string;       // "SAS @ MIN"
  tipoff: string;
  prob: number;          // confidence at save time (snapshotted, doesn't change)
  savedAt: number;
  result: PickResult;
  resolvedAt?: number;
}

const KEY = 'tracked-picks:v1';

function load(): SavedPick[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export const savedPicks = writable<SavedPick[]>(load());

savedPicks.subscribe((picks) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(picks));
  } catch {
    // localStorage full or disabled
  }
});

export function makePickId(eventId: string, kind: PickKind, description: string): string {
  return `${eventId}|${kind}|${description}`;
}

export function isSaved(picks: SavedPick[], id: string): boolean {
  return picks.some((p) => p.id === id);
}

export function togglePick(pick: Omit<SavedPick, 'savedAt' | 'result'>): void {
  savedPicks.update((existing) => {
    if (existing.some((p) => p.id === pick.id)) {
      return existing.filter((p) => p.id !== pick.id);
    }
    return [...existing, { ...pick, savedAt: Date.now(), result: 'pending' }];
  });
}

export function markResult(id: string, result: 'hit' | 'miss'): void {
  savedPicks.update((existing) =>
    existing.map((p) => (p.id === id ? { ...p, result, resolvedAt: Date.now() } : p))
  );
}

export function clearResult(id: string): void {
  savedPicks.update((existing) =>
    existing.map((p) => (p.id === id ? { ...p, result: 'pending', resolvedAt: undefined } : p))
  );
}

export function deletePick(id: string): void {
  savedPicks.update((existing) => existing.filter((p) => p.id !== id));
}

export interface PickStats {
  total: number;
  resolved: number;
  hits: number;
  misses: number;
  pending: number;
  accuracy: number; // 0..1, hits / resolved
}

export function pickStats(picks: SavedPick[]): PickStats {
  const resolved = picks.filter((p) => p.result !== 'pending').length;
  const hits = picks.filter((p) => p.result === 'hit').length;
  const misses = picks.filter((p) => p.result === 'miss').length;
  return {
    total: picks.length,
    resolved,
    hits,
    misses,
    pending: picks.length - resolved,
    accuracy: resolved > 0 ? hits / resolved : 0
  };
}
