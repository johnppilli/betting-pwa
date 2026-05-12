// In dev, we call The Odds API directly using VITE_ODDS_API_KEY from .env.local.
// In production, the key isn't bundled into the client — instead the client
// calls /api/odds and /api/event-odds, which are Vercel serverless proxies
// that hold the real key in a server-only env var (ODDS_API_KEY).

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const DEV = import.meta.env.DEV;
const DEV_KEY = import.meta.env.VITE_ODDS_API_KEY;

export interface Outcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}

export interface Market {
  key: string;
  last_update: string;
  outcomes: Outcome[];
}

export interface Bookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: Market[];
}

export interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Odds API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchNbaOdds(): Promise<OddsEvent[]> {
  if (DEV) {
    if (!DEV_KEY) throw new Error('Missing VITE_ODDS_API_KEY — check .env.local');
    const url = new URL(`${ODDS_API_BASE}/sports/basketball_nba/odds/`);
    url.searchParams.set('regions', 'us');
    url.searchParams.set('markets', 'spreads,totals,h2h');
    url.searchParams.set('oddsFormat', 'american');
    url.searchParams.set('apiKey', DEV_KEY);
    return fetchJson<OddsEvent[]>(url.toString());
  }
  return fetchJson<OddsEvent[]>('/api/odds');
}

export async function fetchNbaEventProps(eventId: string): Promise<OddsEvent> {
  if (DEV) {
    if (!DEV_KEY) throw new Error('Missing VITE_ODDS_API_KEY — check .env.local');
    const url = new URL(`${ODDS_API_BASE}/sports/basketball_nba/events/${eventId}/odds`);
    url.searchParams.set('regions', 'us');
    url.searchParams.set('markets', 'player_points,player_rebounds,player_assists,player_threes');
    url.searchParams.set('oddsFormat', 'american');
    url.searchParams.set('apiKey', DEV_KEY);
    return fetchJson<OddsEvent>(url.toString());
  }
  const url = new URL('/api/event-odds', window.location.origin);
  url.searchParams.set('eventId', eventId);
  return fetchJson<OddsEvent>(url.toString());
}
