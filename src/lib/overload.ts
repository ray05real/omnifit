// Progressive overload: is a set up, the same or down on last time, and what does that make the day.

import type { DateKey } from './dates.ts';

export type SetVal = { weight: number; reps: number };

// 'first' = nothing to compare with yet.
export type Change = 'up' | 'same' | 'down' | 'first';

// A set as it was done on a day, with what the same set was the time before.
export type LoggedSet = {
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  weight: number;
  reps: number;
  prev: SetVal | null;
};

export type Workout = {
  id: string;
  date: DateKey;
  sessionId: string;
  sessionName: string;
  sets: LoggedSet[];
};

export function isBlank(s: SetVal | null | undefined): boolean {
  return !s || (s.weight === 0 && s.reps === 0);
}

// Estimated one-rep max (Epley). Only used to settle "more weight but fewer reps" and the strength graph.
export function e1rm(s: SetVal): number {
  return s.weight * (1 + s.reps / 30);
}

export function compareSet(now: SetVal, prev: SetVal | null): Change {
  if (isBlank(prev) || !prev) return 'first';
  if (now.weight === prev.weight && now.reps === prev.reps) return 'same';
  if (now.weight >= prev.weight && now.reps >= prev.reps) return 'up';
  if (now.weight <= prev.weight && now.reps <= prev.reps) return 'down';
  const a = e1rm(now);
  const b = e1rm(prev);
  if (Math.abs(a - b) < 0.01) return 'same';
  return a > b ? 'up' : 'down';
}

export function tally(sets: LoggedSet[]): Record<Change, number> {
  const t: Record<Change, number> = { up: 0, same: 0, down: 0, first: 0 };
  for (const s of sets) t[compareSet(s, s.prev)]++;
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

function signed(n: number, unit: string): string {
  return (n > 0 ? '+' : '−') + formatWeight(Math.abs(n)) + unit;
}

// '+2.5 kg', '−1 rep', '+2.5 kg · −2 reps'; '' when nothing changed or there's nothing to compare.
export function describeChange(now: SetVal, prev: SetVal | null): string {
  if (isBlank(prev) || !prev) return '';
  const parts: string[] = [];
  const dw = now.weight - prev.weight;
  const dr = now.reps - prev.reps;
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
