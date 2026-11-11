import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { todayKey, type DateKey } from '../lib/dates';
import { useBody } from './body';
import { useNutrition } from './nutrition';
import { useTraining } from './training';

const stores = [useTraining, useNutrition, useBody];

// True once everything saved on the phone has been read back.
export function useHydrated(): boolean {
  const [ready, setReady] = useState(() => stores.every((s) => s.persist.hasHydrated()));
  useEffect(() => {
    const check = () => setReady(stores.every((s) => s.persist.hasHydrated()));
    const offs = stores.map((s) => s.persist.onFinishHydration(check));
    check();
    return () => offs.forEach((off) => off());
  }, []);
  return ready;
}

// Today's date, kept right when the app is left open past midnight or comes back from the background.
export function useToday(): DateKey {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const check = () => setToday(todayKey());
    const timer = setInterval(check, 30000);
    const sub = AppState.addEventListener('change', check);
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return today;
}
