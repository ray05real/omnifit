// Body weight (kg) and sleep (minutes), one entry per day each, typed in by hand.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DateKey } from '../lib/dates';
import { phoneStorage } from './persist';

type State = {
  weights: Record<DateKey, number>;
  sleep: Record<DateKey, number>; // keyed by the morning you woke up
  sleepGoalMin: number;

  setWeight: (date: DateKey, kg: number | null) => void; // null removes the day
  setSleep: (date: DateKey, min: number | null) => void;
  setSleepGoal: (min: number) => void;
};

function put(rec: Record<DateKey, number>, date: DateKey, value: number | null): Record<DateKey, number> {
  const next = { ...rec };
  if (value === null) delete next[date];
  else next[date] = value;
  return next;
}

export const useBody = create<State>()(
  persist(
    (set) => ({
      weights: {},
      sleep: {},
      sleepGoalMin: 480,

      setWeight: (date, kg) => set((st) => ({ weights: put(st.weights, date, kg) })),
      setSleep: (date, min) => set((st) => ({ sleep: put(st.sleep, date, min) })),
      setSleepGoal: (min) => set({ sleepGoalMin: min }),
    }),
    {
      name: 'omnifit-body',
      version: 1,
      storage: phoneStorage,
      partialize: (st) => ({ weights: st.weights, sleep: st.sleep, sleepGoalMin: st.sleepGoalMin }),
    },
  ),
);
