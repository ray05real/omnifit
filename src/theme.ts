import { StyleSheet } from 'react-native';

import type { Change } from './lib/overload';

// Apple's own dark-mode colours (iOS system colours), so the app feels like one of Apple's.
export const C = {
  bg: '#000000', // systemBackground
  card: 'rgba(28,28,30,0.78)', // secondarySystemBackground, a little see-through so the page's glow shows like glass
  cardSolid: '#1C1C1E',
  card2: '#2C2C2E', // tertiarySystemBackground: boxes inside a card
  fill: 'rgba(118,118,128,0.24)', // tertiarySystemFill: segmented controls, search fields
  thumb: '#636366', // the selected segment
  rim: 'rgba(255,255,255,0.09)', // the faint bright edge on cards (glass)
  line: 'rgba(84,84,88,0.55)', // separator
  track: 'rgba(118,118,128,0.24)',
  text: '#FFFFFF', // label
  muted: 'rgba(235,235,245,0.6)', // secondaryLabel
  faint: 'rgba(235,235,245,0.3)', // tertiaryLabel
  ink: '#000000', // text on a white button

  // One small palette (the owner, 11 Nov 2026: "too many colours", look at MacroFactor): the app itself is
  // black, white and greys; colour is kept for meaning only: green = good (went up, goal reached),
  // grey = the same / not there yet, red = went down / too much. The sections no longer have colours of their own.
  overload: '#FFFFFF',
  nutrition: '#FFFFFF',
  weight: '#FFFFFF',
  sleep: '#FFFFFF',
  today: '#FFFFFF',

  protein: '#FFFFFF',
  carbs: '#FFFFFF',
  fat: '#FFFFFF',

  // The soft glow at the top of each page is the one place the sections have a colour (the owner, 14 Nov 2026).
  // The purple and the blue are kept well apart.
  glowOverload: '#BF5AF2', // systemPurple
  glowNutrition: '#30D158', // systemGreen
  glowWeight: '#FFD60A', // systemYellow
  glowSleep: '#0A84FF', // systemBlue
  glowMetrics: '#8E8E93', // grey, quieter

  up: '#30D158', // systemGreen
  same: '#8E8E93', // systemGray
  down: '#FF453A', // systemRed
};

export function changeColor(c: Change | null): string {
  if (c === 'up') return C.up;
  if (c === 'same') return C.same;
  if (c === 'down') return C.down;
  return C.text; // logged, nothing to compare yet
}

// A colour at a given opacity: '#FF9F0A' + 0.2 → 'rgba(255,159,10,0.2)'. Apple's tinted buttons and ring tracks.
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const PAD = 16;
export const RADIUS = 26; // cards
export const TAB_H = 62; // the floating tab bar

// Apple's text styles (San Francisco is the iPhone's own font).
export const T = StyleSheet.create({
  title: { color: C.text, fontSize: 34, fontWeight: '700', letterSpacing: 0.4 },
  h2: { color: C.text, fontSize: 22, fontWeight: '700', letterSpacing: 0.35 },
  headline: { color: C.text, fontSize: 17, fontWeight: '600', letterSpacing: -0.4 },
  body: { color: C.text, fontSize: 17, letterSpacing: -0.4 },
  muted: { color: C.muted, fontSize: 15, letterSpacing: -0.2 },
  small: { color: C.muted, fontSize: 13, letterSpacing: -0.1 },
  label: { color: C.muted, fontSize: 13, fontWeight: '400', letterSpacing: -0.1, textTransform: 'uppercase' },
  num: { fontVariant: ['tabular-nums'] },
});
