// Progressive overload: is a set up, the same or down on last time, and what does that make the day.

import type { DateKey } from './dates.ts';

export type SetVal = { weight: number; reps: number; dist?: number };

// Cardio (bike, rower…) is logged with the same two numbers: `weight` holds the minutes and `reps` the
// machine's number (watts by default; or distance, calories, level). A third, `dist`, holds the distance in km
// (the owner, 18 Nov 2026: "25 km on the bike, next to the watts and the time"); it isn't used when the
// machine's number already is the distance.
export type ExerciseKind = 'strength' | 'cardio';
export type CardioMetric = 'W' | 'km' | 'kcal' | 'level';
export const CARDIO_METRICS: { key: CardioMetric; label: string }[] = [
  { key: 'W', label: 'Watts' },
  { key: 'km', label: 'Km' },
  { key: 'kcal', label: 'Kcal' },
  { key: 'level', label: 'Level' },
];

// Whether a cardio line has its own distance number (not when its second number already is km).
export function hasDistance(kind: ExerciseKind | undefined, metric: CardioMetric | undefined): boolean {
  return kind === 'cardio' && (metric ?? 'W') !== 'km';
}

// 'first' = nothing to compare with yet.
export type Change = 'up' | 'same' | 'down' | 'first';

// A set as it was done on a day, with what the same set was the time before.
export type LoggedSet = {
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  weight: number;
  reps: number;
  dist?: number; // cardio: km
  prev: SetVal | null;
  kind?: ExerciseKind; // missing = strength
  metric?: CardioMetric;
};

export type Workout = {
  id: string;
  date: DateKey;
  sessionId: string;
  sessionName: string;
  sets: LoggedSet[];
};

export function isBlank(s: SetVal | null | undefined): boolean {
  return !s || (s.weight === 0 && s.reps === 0 && !s.dist);
}

// Estimated one-rep max (Epley). Only used to settle "more weight but fewer reps" and the strength graph.
export function e1rm(s: SetVal): number {
  return s.weight * (1 + s.reps / 30);
}

export function compareSet(now: SetVal, prev: SetVal | null, kind: ExerciseKind = 'strength'): Change {
  if (isBlank(prev) || !prev) return 'first';
  // Cardio's distance counts only when both times have one.
  const useDist = kind === 'cardio' && (now.dist ?? 0) > 0 && (prev.dist ?? 0) > 0;
  const a = useDist ? [now.weight, now.reps, now.dist!] : [now.weight, now.reps];
  const b = useDist ? [prev.weight, prev.reps, prev.dist!] : [prev.weight, prev.reps];
  if (a.every((v, i) => v === b[i])) return 'same';
  if (a.every((v, i) => v >= b[i])) return 'up';
  if (a.every((v, i) => v <= b[i])) return 'down';
  // Some numbers went up and others down: strength goes by the estimated one-rep max, cardio by the work done
  // (minutes × watts), then by the distance.
  const sa = kind === 'cardio' ? now.weight * now.reps : e1rm(now);
  const sb = kind === 'cardio' ? prev.weight * prev.reps : e1rm(prev);
  if (Math.abs(sa - sb) < 0.01) {
    if (useDist && now.dist !== prev.dist) return now.dist! > prev.dist! ? 'up' : 'down';
    return 'same';
  }
  return sa > sb ? 'up' : 'down';
}

export function tally(sets: LoggedSet[]): Record<Change, number> {
  const t: Record<Change, number> = { up: 0, same: 0, down: 0, first: 0 };
  for (const s of sets) t[compareSet(s, s.prev, s.kind)]++;
  return t;
}

// A day (or a workout) as one colour: more sets up than down = up, more down = down, otherwise the same.
// null = nothing logged; 'first' = logged, but nothing to compare with.
export function dayChange(sets: LoggedSet[]): Change | null {
  if (sets.length === 0) return null;
  const t = tally(sets);
  if (t.up > t.down) return 'up';
  if (t.down > t.up) return 'down';
  if (t.up + t.down + t.same === 0) return 'first';
  return 'same';
}

// 80, 82.5, 41.25
export function formatWeight(w: number): string {
  return String(Math.round(w * 100) / 100);
}

// Minutes as the gym machines show them: 20, or 20:30 for twenty and a half.
export function formatMinutes(m: number): string {
  const whole = Math.floor(m + 1e-9);
  const sec = Math.round((m - whole) * 60);
  return sec === 0 ? String(whole) : whole + ':' + (sec < 10 ? '0' + sec : sec);
}

// A set as one line of text: '50kg – 10', '20min – 150W' or '60min – 150W – 25km'.
export function setLabel(s: SetVal, kind: ExerciseKind = 'strength', metric: CardioMetric = 'W'): string {
  if (kind !== 'cardio') return formatWeight(s.weight) + 'kg – ' + s.reps;
  const v = formatWeight(s.reps);
  const dist = hasDistance(kind, metric) && (s.dist ?? 0) > 0 ? ' – ' + formatWeight(s.dist!) + 'km' : '';
  return formatMinutes(s.weight) + 'min – ' + (metric === 'level' ? 'lvl ' + v : v + metric) + dist;
}

function signed(n: number, unit: string): string {
  return (n > 0 ? '+' : '−') + formatWeight(Math.abs(n)) + unit;
}

// '+2.5 kg', '−1 rep', '+2.5 kg · −2 reps'; '' when nothing changed or there's nothing to compare.
export function describeChange(now: SetVal, prev: SetVal | null, kind: ExerciseKind = 'strength', metric: CardioMetric = 'W'): string {
  if (isBlank(prev) || !prev) return '';
  const parts: string[] = [];
  const dw = now.weight - prev.weight;
  const dr = now.reps - prev.reps;
  if (kind === 'cardio') {
    if (dw !== 0) parts.push((dw > 0 ? '+' : '−') + formatMinutes(Math.abs(dw)) + ' min');
    if (dr !== 0) parts.push(signed(dr, ' ' + (metric === 'level' ? 'lvl' : metric)));
    const dd = (now.dist ?? 0) > 0 && (prev.dist ?? 0) > 0 ? now.dist! - prev.dist! : 0;
    if (Math.abs(dd) > 1e-9) parts.push(signed(Math.round(dd * 10) / 10, ' km'));
    return parts.join(' · ');
  }
  if (dw !== 0) parts.push(signed(dw, ' kg'));
  if (dr !== 0) parts.push(signed(dr, Math.abs(dr) === 1 ? ' rep' : ' reps'));
  return parts.join(' · ');
}

// The heaviest set; between equal weights, the one with more reps.
export function topSet<T extends SetVal>(sets: T[]): T | null {
  let best: T | null = null;
  for (const s of sets) {
    if (!best || s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)) best = s;
  }
  return best;
}

// Split a weight into the wheel's two columns: whole kg and quarter kg.
export function splitWeight(w: number): { whole: number; quarter: number } {
  const q = Math.round(w * 4);
  return { whole: Math.floor(q / 4), quarter: (q % 4) / 4 };
}
