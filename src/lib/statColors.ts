// Per-stat color theming. Tailwind doesn't let us build classes dynamically,
// so we keep full class strings per stat key.

export interface StatTheme {
  text: string;       // label color
  ring: string;       // border / outline color
  bgSoft: string;     // very faint background tint
  bgFill: string;     // filled progress bar
  bgFillTrack: string; // empty part of progress bar
}

const POINTS: StatTheme = {
  text: 'text-amber-400',
  ring: 'ring-amber-500/30',
  bgSoft: 'bg-amber-500/[0.06]',
  bgFill: 'bg-amber-400',
  bgFillTrack: 'bg-amber-500/15'
};

const REBOUNDS: StatTheme = {
  text: 'text-sky-400',
  ring: 'ring-sky-500/30',
  bgSoft: 'bg-sky-500/[0.06]',
  bgFill: 'bg-sky-400',
  bgFillTrack: 'bg-sky-500/15'
};

const ASSISTS: StatTheme = {
  text: 'text-emerald-400',
  ring: 'ring-emerald-500/30',
  bgSoft: 'bg-emerald-500/[0.06]',
  bgFill: 'bg-emerald-400',
  bgFillTrack: 'bg-emerald-500/15'
};

const THREES: StatTheme = {
  text: 'text-violet-400',
  ring: 'ring-violet-500/30',
  bgSoft: 'bg-violet-500/[0.06]',
  bgFill: 'bg-violet-400',
  bgFillTrack: 'bg-violet-500/15'
};

const FALLBACK: StatTheme = {
  text: 'text-neutral-300',
  ring: 'ring-neutral-700',
  bgSoft: 'bg-neutral-800/40',
  bgFill: 'bg-neutral-400',
  bgFillTrack: 'bg-neutral-700'
};

export function statTheme(marketKey: string): StatTheme {
  switch (marketKey) {
    case 'player_points':
      return POINTS;
    case 'player_rebounds':
      return REBOUNDS;
    case 'player_assists':
      return ASSISTS;
    case 'player_threes':
      return THREES;
    default:
      return FALLBACK;
  }
}
