const API_BASE = 'https://api.the-odds-api.com/v4';
const API_KEY = import.meta.env.VITE_ODDS_API_KEY;

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

function assertKey() {
	if (!API_KEY) {
		throw new Error('Missing VITE_ODDS_API_KEY — check .env.local');
	}
}

export async function fetchNbaOdds(): Promise<OddsEvent[]> {
	assertKey();
	const url = new URL(`${API_BASE}/sports/basketball_nba/odds/`);
	url.searchParams.set('regions', 'us');
	url.searchParams.set('markets', 'spreads,totals,h2h');
	url.searchParams.set('oddsFormat', 'american');
	url.searchParams.set('apiKey', API_KEY);

	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Odds API error: ${res.status} ${res.statusText}`);
	}
	return res.json();
}

export async function fetchNbaEventProps(eventId: string): Promise<OddsEvent> {
	assertKey();
	const url = new URL(`${API_BASE}/sports/basketball_nba/events/${eventId}/odds`);
	url.searchParams.set('regions', 'us');
	url.searchParams.set(
		'markets',
		'player_points,player_rebounds,player_assists,player_threes'
	);
	url.searchParams.set('oddsFormat', 'american');
	url.searchParams.set('apiKey', API_KEY);

	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Odds API error: ${res.status} ${res.statusText}`);
	}
	return res.json();
}
