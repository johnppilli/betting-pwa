// balldontlie client for player game-log stats.
// Free tier: 5 req/min, requires API key. Direct browser calls (CORS works).
// In a future session we can route this through a Vercel proxy to hide the key.

const BDL_BASE = 'https://api.balldontlie.io/v1';
const KEY = import.meta.env.VITE_BALLDONTLIE_API_KEY;

export interface BdlPlayer {
  id: number;
  first_name: string;
  last_name: string;
}

export interface BdlStat {
  id: number;
  date: string;
  pts: number;
  reb: number;
  ast: number;
  fg3m: number;
  player: BdlPlayer;
}

const PLAYER_ID_PREFIX = 'bdl-pid:';
const STATS_PREFIX = 'bdl-stats:';
const STATS_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function assertKey() {
  if (!KEY) throw new Error('Missing VITE_BALLDONTLIE_API_KEY — check .env.local');
}

async function bdlFetch<T = unknown>(path: string): Promise<T> {
  assertKey();
  const res = await fetch(`${BDL_BASE}${path}`, {
    headers: { Authorization: KEY }
  });
  if (!res.ok) throw new Error(`balldontlie: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// NBA seasons are labeled by their starting year.
// Oct–Jun is the current season; pre-October falls under previous year.
export function currentNbaSeason(): number {
  const d = new Date();
  return d.getMonth() >= 9 ? d.getFullYear() : d.getFullYear() - 1;
}

/** Find a player's balldontlie ID by their full display name. Cached forever. */
export async function findPlayerId(fullName: string): Promise<number | null> {
  if (typeof localStorage !== 'undefined') {
    const cached = localStorage.getItem(PLAYER_ID_PREFIX + fullName);
    if (cached === 'null') return null;
    if (cached) return parseInt(cached, 10);
  }

  const parts = fullName.trim().split(/\s+/);
  const lastName = parts[parts.length - 1];
  const data = await bdlFetch<{ data: BdlPlayer[] }>(
    `/players?search=${encodeURIComponent(lastName)}&per_page=25`
  );

  const norm = fullName.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  for (const p of data.data || []) {
    const candidate = `${p.first_name} ${p.last_name}`.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    if (candidate === norm) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PLAYER_ID_PREFIX + fullName, String(p.id));
      }
      return p.id;
    }
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PLAYER_ID_PREFIX + fullName, 'null');
  }
  return null;
}

/** Fetch a player's most recent game stats this season. Cached 24h. */
export async function fetchRecentStats(playerId: number): Promise<BdlStat[]> {
  const cacheKey = STATS_PREFIX + playerId;
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      try {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < STATS_TTL_MS) return data;
      } catch {
        // fall through and refetch
      }
    }
  }

  const season = currentNbaSeason();
  const data = await bdlFetch<{ data: BdlStat[] }>(
    `/stats?seasons[]=${season}&player_ids[]=${playerId}&per_page=25`
  );
  const stats = data.data || [];

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(cacheKey, JSON.stringify({ data: stats, ts: Date.now() }));
  }
  return stats;
}
