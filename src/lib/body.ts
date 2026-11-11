// Body weight and sleep: small helpers for the two manual logs.

import { daysBetween, type DateKey } from './dates.ts';

export type Point = { date: DateKey; value: number };

// A record keyed by day, as a list sorted oldest first.
export function toPoints(byDay: Record<DateKey, number>): Point[] {
  return Object.keys(byDay)
    .sort()
    .map((date) => ({ date, value: byDay[date] }));
}

// A smoothed line through the weigh-ins (each day pulls the trend a fifth of the way to the new weight),
// so one heavy morning doesn't look like a change.
export function trend(points: Point[]): Point[] {
  const out: Point[] = [];
  let t = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i === 0) t = p.value;
    else {
      const gap = Math.max(1, daysBetween(points[i - 1].date, p.date));
      t += (1 - Math.pow(0.8, gap)) * (p.value - t);
    }
    out.push({ date: p.date, value: Math.round(t * 100) / 100 });
  }
  return out;
}

// '7 h 30 m', '8 h'
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return m === 0 ? h + ' h' : h + ' h ' + m + ' m';
}

// 7.5
export function hours1(min: number): number {
  return Math.round(min / 6) / 10;
}

export type SleepStatus = 'hit' | 'near' | 'low';

// At the goal, within an hour of it, or more than an hour short.
export function sleepStatus(min: number, goalMin: number): SleepStatus {
  if (min >= goalMin) return 'hit';
  if (min >= goalMin - 60) return 'near';
  return 'low';
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
