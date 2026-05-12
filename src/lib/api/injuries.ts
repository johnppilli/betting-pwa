// ESPN's free public injury endpoint. No auth, supports CORS.
// One request gets the whole league; cache aggressively since injury reports
// only update a few times a day during the season.

import { getCached, setCached } from './cache';

const ENDPOINT = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries';
const CACHE_KEY = 'espn-injuries';
const TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export type InjuryStatus =
  | 'Out'
  | 'Doubtful'
  | 'Questionable'
  | 'Day-To-Day'
  | 'Probable'
  | string;

export interface InjuryAthlete {
  team: string;        // team display name, e.g. "Boston Celtics"
  name: string;        // athlete display name
  status: InjuryStatus;
  shortComment?: string;
}

export async function fetchNbaInjuries(): Promise<InjuryAthlete[]> {
  const cached = getCached<InjuryAthlete[]>(CACHE_KEY, TTL_MS);
  if (cached) return cached;

  const res = await fetch(ENDPOINT);
  if (!res.ok) throw new Error(`ESPN injuries: HTTP ${res.status}`);
  const data = await res.json();

  const flat: InjuryAthlete[] = [];
  for (const team of data.injuries ?? []) {
    const teamName: string = team.displayName ?? '';
    for (const inj of team.injuries ?? []) {
      const name: string = inj.athlete?.displayName ?? '';
      if (!name) continue;
      flat.push({
        team: teamName,
        name,
        status: inj.status ?? '',
        shortComment: inj.shortComment ?? undefined
      });
    }
  }

  setCached(CACHE_KEY, flat);
  return flat;
}

/** Look up injury status for a player by display name. */
export function findInjury(injuries: InjuryAthlete[], name: string): InjuryAthlete | null {
  const norm = name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  for (const i of injuries) {
    const candidate = i.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    if (candidate === norm) return i;
  }
  return null;
}

/** Short label + Tailwind classes for each status. */
export function injuryUI(status: string): { label: string; classes: string } {
  switch (status) {
    case 'Out':
      return { label: 'OUT', classes: 'bg-red-500/20 text-red-300 ring-red-500/40' };
    case 'Doubtful':
      return { label: 'DBT', classes: 'bg-orange-500/20 text-orange-300 ring-orange-500/40' };
    case 'Questionable':
      return { label: 'Q', classes: 'bg-amber-500/15 text-amber-300 ring-amber-500/30' };
    case 'Day-To-Day':
      return { label: 'DTD', classes: 'bg-yellow-500/15 text-yellow-300 ring-yellow-500/30' };
    case 'Probable':
      return { label: 'PROB', classes: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' };
    default:
      return { label: status.toUpperCase().slice(0, 4), classes: 'bg-neutral-700 text-neutral-300 ring-neutral-600' };
  }
}
