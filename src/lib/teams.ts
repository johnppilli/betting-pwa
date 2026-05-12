// NBA team accent colors (primary, secondary). Used for visual identity on game cards.
// Hex codes from Wikipedia / official team brand guidelines.

export interface TeamColors {
  primary: string;   // main accent
  secondary: string; // complementary accent
}

const TEAM_COLORS: Record<string, TeamColors> = {
  'Atlanta Hawks':           { primary: '#E03A3E', secondary: '#C1D32F' },
  'Boston Celtics':          { primary: '#007A33', secondary: '#BA9653' },
  'Brooklyn Nets':           { primary: '#000000', secondary: '#FFFFFF' },
  'Charlotte Hornets':       { primary: '#1D1160', secondary: '#00788C' },
  'Chicago Bulls':           { primary: '#CE1141', secondary: '#000000' },
  'Cleveland Cavaliers':     { primary: '#860038', secondary: '#FDBB30' },
  'Dallas Mavericks':        { primary: '#00538C', secondary: '#002B5E' },
  'Denver Nuggets':          { primary: '#0E2240', secondary: '#FEC524' },
  'Detroit Pistons':         { primary: '#C8102E', secondary: '#1D42BA' },
  'Golden State Warriors':   { primary: '#1D428A', secondary: '#FFC72C' },
  'Houston Rockets':         { primary: '#CE1141', secondary: '#000000' },
  'Indiana Pacers':          { primary: '#002D62', secondary: '#FDBB30' },
  'LA Clippers':             { primary: '#C8102E', secondary: '#1D428A' },
  'Los Angeles Clippers':    { primary: '#C8102E', secondary: '#1D428A' },
  'Los Angeles Lakers':      { primary: '#552583', secondary: '#FDB927' },
  'Memphis Grizzlies':       { primary: '#5D76A9', secondary: '#12173F' },
  'Miami Heat':              { primary: '#98002E', secondary: '#F9A01B' },
  'Milwaukee Bucks':         { primary: '#00471B', secondary: '#EEE1C6' },
  'Minnesota Timberwolves':  { primary: '#0C2340', secondary: '#236192' },
  'New Orleans Pelicans':    { primary: '#0C2340', secondary: '#C8102E' },
  'New York Knicks':         { primary: '#006BB6', secondary: '#F58426' },
  'Oklahoma City Thunder':   { primary: '#007AC1', secondary: '#EF3B24' },
  'Orlando Magic':           { primary: '#0077C0', secondary: '#C4CED4' },
  'Philadelphia 76ers':      { primary: '#006BB6', secondary: '#ED174C' },
  'Phoenix Suns':            { primary: '#1D1160', secondary: '#E56020' },
  'Portland Trail Blazers':  { primary: '#E03A3E', secondary: '#000000' },
  'Sacramento Kings':        { primary: '#5A2D81', secondary: '#63727A' },
  'San Antonio Spurs':       { primary: '#C4CED4', secondary: '#000000' },
  'Toronto Raptors':         { primary: '#CE1141', secondary: '#000000' },
  'Utah Jazz':               { primary: '#002B5C', secondary: '#00471B' },
  'Washington Wizards':      { primary: '#002B5C', secondary: '#E31837' }
};

const DEFAULT_COLORS: TeamColors = { primary: '#525252', secondary: '#737373' };

export function teamColors(name: string): TeamColors {
  return TEAM_COLORS[name] ?? DEFAULT_COLORS;
}

// Returns a CSS linear-gradient string suitable for `background:` —
// away team color on left, home team color on right.
export function matchupGradient(awayTeam: string, homeTeam: string): string {
  const a = teamColors(awayTeam).primary;
  const h = teamColors(homeTeam).primary;
  return `linear-gradient(90deg, ${a} 0%, ${a} 50%, ${h} 50%, ${h} 100%)`;
}

// ESPN-hosted team logo URL (500px PNG, transparent background).
// Returns empty string for unknown teams (img tag handles it via onError).
const LOGO_SLUGS: Record<string, string> = {
  'Atlanta Hawks': 'atl',
  'Boston Celtics': 'bos',
  'Brooklyn Nets': 'bkn',
  'Charlotte Hornets': 'cha',
  'Chicago Bulls': 'chi',
  'Cleveland Cavaliers': 'cle',
  'Dallas Mavericks': 'dal',
  'Denver Nuggets': 'den',
  'Detroit Pistons': 'det',
  'Golden State Warriors': 'gs',
  'Houston Rockets': 'hou',
  'Indiana Pacers': 'ind',
  'LA Clippers': 'lac',
  'Los Angeles Clippers': 'lac',
  'Los Angeles Lakers': 'lal',
  'Memphis Grizzlies': 'mem',
  'Miami Heat': 'mia',
  'Milwaukee Bucks': 'mil',
  'Minnesota Timberwolves': 'min',
  'New Orleans Pelicans': 'no',
  'New York Knicks': 'ny',
  'Oklahoma City Thunder': 'okc',
  'Orlando Magic': 'orl',
  'Philadelphia 76ers': 'phi',
  'Phoenix Suns': 'phx',
  'Portland Trail Blazers': 'por',
  'Sacramento Kings': 'sac',
  'San Antonio Spurs': 'sa',
  'Toronto Raptors': 'tor',
  'Utah Jazz': 'utah',
  'Washington Wizards': 'wsh'
};

export function teamLogo(name: string): string {
  const slug = LOGO_SLUGS[name];
  if (!slug) return '';
  return `https://a.espncdn.com/i/teamlogos/nba/500/${slug}.png`;
}
