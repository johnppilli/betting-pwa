// ESPN team rosters as the source for player IDs and headshot URLs.
// One request per team, cached 24h. For a given props page we fetch the
// home + away rosters, merge them, and look players up by name.

const ROSTER_PREFIX = 'espn-roster:';
const ROSTER_TTL_MS = 24 * 60 * 60 * 1000;

// ESPN team URL slug (lowercase). Same convention as teamLogo.
const TEAM_SLUGS: Record<string, string> = {
  'Atlanta Hawks': 'atl', 'Boston Celtics': 'bos', 'Brooklyn Nets': 'bkn',
  'Charlotte Hornets': 'cha', 'Chicago Bulls': 'chi', 'Cleveland Cavaliers': 'cle',
  'Dallas Mavericks': 'dal', 'Denver Nuggets': 'den', 'Detroit Pistons': 'det',
  'Golden State Warriors': 'gs', 'Houston Rockets': 'hou', 'Indiana Pacers': 'ind',
  'LA Clippers': 'lac', 'Los Angeles Clippers': 'lac', 'Los Angeles Lakers': 'lal',
  'Memphis Grizzlies': 'mem', 'Miami Heat': 'mia', 'Milwaukee Bucks': 'mil',
  'Minnesota Timberwolves': 'min', 'New Orleans Pelicans': 'no', 'New York Knicks': 'ny',
  'Oklahoma City Thunder': 'okc', 'Orlando Magic': 'orl', 'Philadelphia 76ers': 'phi',
  'Phoenix Suns': 'phx', 'Portland Trail Blazers': 'por', 'Sacramento Kings': 'sac',
  'San Antonio Spurs': 'sa', 'Toronto Raptors': 'tor', 'Utah Jazz': 'utah',
  'Washington Wizards': 'wsh'
};

export interface EspnPlayer {
  id: string;
  headshot?: string;
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
}

async function fetchTeamRoster(teamName: string): Promise<Record<string, EspnPlayer>> {
  const slug = TEAM_SLUGS[teamName];
  if (!slug) return {};

  const cacheKey = ROSTER_PREFIX + slug;
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      try {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < ROSTER_TTL_MS) return data;
      } catch {
        // fall through and refetch
      }
    }
  }

  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${slug}/roster`
  );
  if (!res.ok) return {};
  const data = await res.json();

  // Build a map keyed by both exact name and normalized form
  const map: Record<string, EspnPlayer> = {};
  for (const ath of data.athletes ?? []) {
    if (!ath.displayName || !ath.id) continue;
    const info: EspnPlayer = {
      id: String(ath.id),
      headshot: ath.headshot?.href
    };
    map[ath.displayName] = info;
    map[normalize(ath.displayName)] = info;
  }

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ data: map, ts: Date.now() }));
    } catch {
      // localStorage might be full
    }
  }
  return map;
}

/** Combined name → EspnPlayer map for both teams of a matchup. */
export async function getMatchupPlayers(
  homeTeam: string,
  awayTeam: string
): Promise<Record<string, EspnPlayer>> {
  const [home, away] = await Promise.all([
    fetchTeamRoster(homeTeam).catch(() => ({})),
    fetchTeamRoster(awayTeam).catch(() => ({}))
  ]);
  return { ...home, ...away };
}

/** Get a player's headshot URL given the matchup roster map. */
export function playerHeadshot(
  players: Record<string, EspnPlayer>,
  name: string
): string | null {
  const direct = players[name];
  if (direct?.headshot) return direct.headshot;
  if (direct?.id) return `https://a.espncdn.com/i/headshots/nba/players/full/${direct.id}.png`;
  const norm = players[normalize(name)];
  if (norm?.headshot) return norm.headshot;
  if (norm?.id) return `https://a.espncdn.com/i/headshots/nba/players/full/${norm.id}.png`;
  return null;
}
