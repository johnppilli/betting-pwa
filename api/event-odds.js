// Vercel serverless function: per-event player props.
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server missing ODDS_API_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId');
  if (!eventId) {
    return new Response(JSON.stringify({ error: 'eventId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(
    `https://api.the-odds-api.com/v4/sports/basketball_nba/events/${eventId}/odds`
  );
  url.searchParams.set('regions', 'us');
  url.searchParams.set('markets', 'player_points,player_rebounds,player_assists,player_threes');
  url.searchParams.set('oddsFormat', 'american');
  url.searchParams.set('apiKey', apiKey);

  const res = await fetch(url);
  const body = await res.text();

  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=300, max-age=60'
    }
  });
}
