// Player prop model: rolling mean + stddev from recent game logs,
// then normal-CDF probability that a player exceeds a given line.
import type { BdlStat } from '../api/stats';

const STAT_FIELDS: Record<string, keyof BdlStat> = {
  player_points: 'pts',
  player_rebounds: 'reb',
  player_assists: 'ast',
  player_threes: 'fg3m'
};

// Abramowitz & Stegun normal CDF approximation (max error ~7.5e-8)
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804 * Math.exp(-(z * z) / 2);
  const p =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

function meanStd(values: number[]): { mean: number; std: number; n: number } {
  const n = values.length;
  if (n === 0) return { mean: 0, std: 0, n: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  if (n === 1) return { mean, std: 0, n: 1 };
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return { mean, std: Math.sqrt(variance), n };
}

export interface PlayerModelResult {
  mean: number;
  std: number;
  n: number;
  pOver: number; // P(stat > line)
}

export function modelProbability(
  stats: BdlStat[],
  marketKey: string,
  line: number
): PlayerModelResult | null {
  const field = STAT_FIELDS[marketKey];
  if (!field) return null;

  const values = stats
    .map((s) => (s[field] as number) ?? 0)
    .filter((v) => typeof v === 'number');

  if (values.length < 5) return null; // not enough recent data

  const { mean, std, n } = meanStd(values);
  if (std === 0) {
    return { mean, std, n, pOver: mean > line ? 1 : 0 };
  }

  // Continuity correction is small for player stats; skip for simplicity.
  const z = (line - mean) / std;
  const pOver = 1 - normalCdf(z);
  return { mean, std, n, pOver };
}
