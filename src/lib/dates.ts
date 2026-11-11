// Days are kept as local 'YYYY-MM-DD' keys (never UTC), so a day is the owner's day on their phone.

export type DateKey = string;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function toKey(d: Date): DateKey {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

export function todayKey(): DateKey {
  return toKey(new Date());
}

// Noon, so adding days never slips across a clock change.
export function fromKey(k: DateKey): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(k: DateKey, n: number): DateKey {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((fromKey(to).getTime() - fromKey(from).getTime()) / 86400000);
}

export function nowTime(): string {
  const d = new Date();
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

// 'Wed 11 Nov'
export function formatDay(k: DateKey): string {
  const d = fromKey(k);
  return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()];
}

// 'Today', 'Yesterday' or 'Wed 11 Nov'
export function relativeDay(k: DateKey, today: DateKey): string {
  const n = daysBetween(k, today);
  if (n === 0) return 'Today';
  if (n === 1) return 'Yesterday';
  if (n === -1) return 'Tomorrow';
  return formatDay(k);
}

// 'today', 'yesterday', '3 days ago', '2 weeks ago'
export function agoLabel(k: DateKey, today: DateKey): string {
  const n = daysBetween(k, today);
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 14) return n + ' days ago';
  if (n < 60) return Math.floor(n / 7) + ' weeks ago';
  return Math.floor(n / 30) + ' months ago';
}

export function monthTitle(year: number, month: number): string {
  return MONTHS[month] + ' ' + year;
}

export function shortDate(k: DateKey): string {
  const d = fromKey(k);
  return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()];
}

// The month as rows of seven, Monday first; null for the blanks before the 1st and after the last day.
export function monthGrid(year: number, month: number): (DateKey | null)[] {
  const first = new Date(year, month, 1, 12);
  const blanks = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0, 12).getDate();
  const cells: (DateKey | null)[] = [];
  for (let i = 0; i < blanks; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(year + '-' + pad2(month + 1) + '-' + pad2(d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
