import type { OddsEvent, Outcome } from '../api/odds';

// American odds → raw implied probability (still has vig baked in)
export function impliedFromAmerican(price: number): number {
  if (price > 0) return 100 / (price + 100);
  return -price / (-price + 100);
}

// Given a set of paired outcomes (e.g. [Over, Under] or [Home, Away]),
// strip the bookmaker's vig and return normalized probabilities (sum to 1)
export function deVig(prices: number[]): number[] {
  const raw = prices.map(impliedFromAmerican);
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum === 0) return raw;
  return raw.map((p) => p / sum);
}

export interface ConsensusEntry {
  key: string;
  name: string;
  point?: number;
  description?: string;
  prob: number; // 0..1, averaged across books
  bookCount: number;
}

// For a given market on an event, compute the consensus de-vig probability
// of each outcome across all bookmakers offering that market.
export function consensusProbabilities(
  event: OddsEvent,
  marketKey: string
): ConsensusEntry[] {
  const totals: Record<
    string,
    { name: string; point?: number; description?: string; probSum: number; n: number }
  > = {};

  for (const bk of event.bookmakers) {
    const m = bk.markets.find((mk) => mk.key === marketKey);
    if (!m) continue;

    // Group outcomes that should be paired for de-vigging:
    //   - h2h: 2 teams (same market = one pair)
    //   - spreads: home / away (same market)
    //   - totals: over / under at a given point
    //   - player props: over / under per (player, point)
    // We group by description (player name, empty for game markets) and point.
    const groups: Record<string, Outcome[]> = {};
    for (const o of m.outcomes) {
      const groupKey = `${o.description ?? ''}|${o.point ?? ''}`;
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(o);
    }

    for (const group of Object.values(groups)) {
      if (group.length < 2) continue; // need a pair to de-vig
      const probs = deVig(group.map((o) => o.price));
      for (let i = 0; i < group.length; i++) {
        const o = group[i];
        const k = `${o.name}|${o.point ?? ''}|${o.description ?? ''}`;
        if (!totals[k]) {
          totals[k] = {
            name: o.name,
            point: o.point,
            description: o.description,
            probSum: 0,
            n: 0
          };
        }
        totals[k].probSum += probs[i];
        totals[k].n += 1;
      }
    }
  }

  return Object.entries(totals).map(([k, v]) => ({
    key: k,
    name: v.name,
    point: v.point,
    description: v.description,
    prob: v.probSum / v.n,
    bookCount: v.n
  }));
}

// The side with the higher consensus probability, or null if no consensus yet
export function favoredSide(entries: ConsensusEntry[]): ConsensusEntry | null {
  if (entries.length === 0) return null;
  return entries.reduce((a, b) => (a.prob >= b.prob ? a : b));
}

// Find the favored team / total side for an event + market
export function favoredOutcome(event: OddsEvent, marketKey: string): ConsensusEntry | null {
  return favoredSide(consensusProbabilities(event, marketKey));
}

// Pretty percentage: 0.583 -> "58%"
export function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}
