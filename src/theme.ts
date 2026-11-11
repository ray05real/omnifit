import { StyleSheet } from 'react-native';

import type { Change } from './lib/overload';

// Dark, one colour per section; up / same / down are always green / amber / red.
export const C = {
  bg: '#0B0B0E',
  card: '#15151A',
  card2: '#1F1F27',
  line: 'rgba(255,255,255,0.09)',
  track: 'rgba(255,255,255,0.08)',
  text: '#F5F5F7',
  muted: '#9A9AA8',
  faint: '#5C5C69',
  ink: '#0B0B0E', // text on a coloured button

  overload: '#FF6A3D',
  nutrition: '#34D17B',
  weight: '#4DA3FF',
  sleep: '#9B7BFF',

  protein: '#C98BFF', // not red or pink: it sits next to the red "over" / "down"
  carbs: '#4DA3FF',
  fat: '#FFC857',

  up: '#34D17B',
  same: '#FFC043',
  down: '#FF5A5F',
};

export function changeColor(c: Change | null): string {
  if (c === 'up') return C.up;
  if (c === 'same') return C.same;
  if (c === 'down') return C.down;
  return C.overload;
}

export const PAD = 20;

export const T = StyleSheet.create({
  title: { color: C.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.6 },
  h2: { color: C.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.2 },
  body: { color: C.text, fontSize: 16 },
  muted: { color: C.muted, fontSize: 14 },
  small: { color: C.muted, fontSize: 12 },
  label: { color: C.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  num: { fontVariant: ['tabular-nums'] },
});
