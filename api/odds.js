// Vercel serverless function: proxies The Odds API for NBA games.
// Lives server-side so the API key never reaches the browser.
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server missing ODDS_API_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL('https://api.the-odds-api.com/v4/sports/basketball_nba/odds/');
  url.searchParams.set('regions', 'us');
  url.searchParams.set('markets', 'spreads,totals,h2h');
  url.searchParams.set('oddsFormat', 'american');
  url.searchParams.set('apiKey', apiKey);

  const res = await fetch(url);
  const body = await res.text();

  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type': 'application/json',
      // edge cache 5 min, browser cache 60s — fewer Odds API hits across users
      'Cache-Control': 's-maxage=300, max-age=60'
    }
  });
}
