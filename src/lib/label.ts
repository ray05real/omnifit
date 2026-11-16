// Turns what the phone read off a pack's nutrition table (pieces of text and where each sits in the photo)
// into calories, protein, carbs and fat. All of it happens on the phone; this file has no camera or internet
// in it, so it can be tested on the PC.
//
// How: each nutrient's name is found ("Fat", "Carbohydrate"…), then the numbers level with it to its right,
// and of those the one in the "per 100 g" column (found by its heading). The live camera reads a frame every
// second or so; combineReadings() keeps the value most frames agree on, so one bad read doesn't win.

import type { FoodUnit } from './nutrition.ts';

export type LabelLine = { text: string; x: number; y: number; w: number; h: number };

export type LabelResult = {
  unit: FoodUnit; // what the numbers are per: 100 g, 100 ml or a serving
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  found: number; // how many of the four were read
  seen: number; // how many of the four nutrients' names are in the picture (0 = no table in sight)
  textHeight: number; // how tall their names are, as a fraction of the picture (small = too far away)
};

// The table's words in the languages the owner is likely to meet (English, Italian, German, French, Spanish).
const FAT = /\b(fats?|grassi|fett|lipides|mati[eè]res grasses|grasas)\b/i;
const CARBS = /(carbohydrates?|carbs\b|carboidrati|kohlenhydrate|glucides|hidratos)/i;
const PROTEIN = /(proteins?\b|proteine|eiwei(ß|ss)|prot[eé]ines?|prote[ií]nas)/i;
const ENERGY = /(energy|energia|energie|[ée]nergie|valor energ|calories)/i;
// Sub-rows ("of which saturates") must not be taken for fat or carbs.
const SUB = /(of which|di cui|davon|dont\b|de l[ao]s cuales|satur|sugars?|zuccheri|zucker|sucres|az[uú]cares|polyols|starch|amido)/i;
const NUTRIENT_WORD = /(fats?\b|grassi|fett|lipides|grasas|carbohydrate|carboidrati|kohlenhydrate|glucides|hidratos|protein|eiwei|energy|energia|energie|kcal|\bkj\b|nutrition|typical values|valori medi)/i; // not "salt": it's in ingredient lists too
const HEADING = /100\s*(g|ml)\b/i;

type Piece = LabelLine & { text: string; yc: number };
type Num = { value: number; unit: string; x: number; at: number; raw: string; lessThan: boolean };

// Common misreads in numbers: O for 0 ("O.5g", "1O"), l or I for 1 ("l.3g").
export function fixDigits(text: string): string {
  return text
    .replace(/(?<=\d)[oO]|[oO](?=[.,]?\d)/g, '0')
    .replace(/[lI|](?=[.,]\d)|(?<=\d[.,])[lI|]/g, '1');
}

function pieces(lines: LabelLine[]): Piece[] {
  return lines
    .filter((l) => l.text && l.text.trim().length > 0)
    .map((l) => ({ ...l, text: fixDigits(l.text), yc: l.y + l.h / 2 }));
}

// Every number in a piece, with its unit if one is attached ("5.4g", "250 kcal", "<0,5 g", "12%"), and where it
// sits across the photo (pieces that hold a whole row are spread out by character position).
function numbersIn(p: Piece, from = 0, to = Infinity): Num[] {
  const out: Num[] = [];
  const re = /(<\s*)?(\d+(?:[.,]\d+)?)\s*(kcal|kj|mg|ml|g|%)?/gi;
  const len = Math.max(1, p.text.length);
  let m: RegExpExecArray | null;
  while ((m = re.exec(p.text))) {
    if (m.index < from || m.index >= to) continue;
    const next = p.text[m.index + m[0].length] ?? '';
    out.push({
      value: parseFloat(m[2].replace(',', '.')),
      unit: (m[3] ?? '').toLowerCase() || (next === '%' ? '%' : ''),
      x: p.x + (p.w * (m.index + m[0].length / 2)) / len,
      at: m.index,
      raw: m[2],
      lessThan: !!m[1],
    });
  }
  return out;
}

// Grams per 100 g can't be more than 100: "21g" read as "219" is the usual culprit (the g taken for a 9),
// and labels print one decimal, so "6.99" is "6.9g".
function grams(n: Num | undefined): number | undefined {
  if (!n) return undefined;
  let v = n.value;
  if (n.unit === '' && /9$/.test(n.raw) && (v > 100 || /[.,]\d9$/.test(n.raw))) v = parseFloat(n.raw.slice(0, -1).replace(',', '.'));
  if (!Number.isFinite(v) || v < 0 || v > 100) return undefined;
  return Math.round(v * 10) / 10;
}

export function parseLabel(lines: LabelLine[]): LabelResult {
  const ps = pieces(lines);

  // The "per 100 g" (or ml) heading: where it sits across the photo tells which column to read.
  let x100: number | null = null;
  let unit: FoodUnit = 'g';
  let sawServing = false;
  for (const p of ps) {
    const m = HEADING.exec(p.text);
    if (m && x100 === null && !/kcal|kj/i.test(p.text)) {
      x100 = p.x + (p.w * (m.index + m[0].length / 2)) / Math.max(1, p.text.length);
      unit = m[1].toLowerCase() === 'ml' ? 'ml' : 'g';
    }
    if (/(serving|portion|porzione|porci[oó]n)/i.test(p.text)) sawServing = true;
  }
  if (x100 === null && sawServing) unit = 'serving';

  // Of several candidates, the one in the "per 100" column, or else the leftmost (usually per 100 g).
  const pick = (cands: Num[]): Num | undefined => {
    if (cands.length === 0) return undefined;
    if (x100 !== null) return cands.slice().sort((a, b) => Math.abs(a.x - x100!) - Math.abs(b.x - x100!))[0];
    return cands.slice().sort((a, b) => a.x - b.x)[0];
  };

  // The numbers on the same row as a name, to its right: inside the same piece after the name, and in the
  // pieces level with it (each column's closest one, so a slightly tilted photo still lines up).
  const rowNumbers = (label: Piece, nameEnd: number, stopAt: number): Num[] => {
    const inline = numbersIn(label, nameEnd, stopAt);
    const byColumn = new Map<number, { dy: number; nums: Num[] }>();
    for (const q of ps) {
      if (q === label) continue;
      if (q.x + q.w / 2 <= label.x + label.w * 0.6) continue; // not to the right
      if (FAT.test(q.text) || CARBS.test(q.text) || PROTEIN.test(q.text) || SUB.test(q.text) || HEADING.test(q.text)) continue;
      const dy = Math.abs(q.yc - label.yc);
      if (dy > Math.max(label.h, q.h) * 0.75) continue;
      const nums = numbersIn(q);
      if (nums.length === 0) continue;
      const col = Math.round((q.x + q.w / 2) * 20); // columns about a twentieth of the photo apart
      const prev = byColumn.get(col);
      if (!prev || dy < prev.dy) byColumn.set(col, { dy, nums });
    }
    return [...inline, ...[...byColumn.values()].flatMap((c) => c.nums)];
  };

  // The pieces that name a nutrient, best first (the name at the start of the piece, then higher up).
  const labelsFor = (name: RegExp) => {
    const out: { p: Piece; end: number; stop: number }[] = [];
    for (const p of ps) {
      const m = name.exec(p.text);
      if (!m) continue;
      const before = p.text.slice(0, m.index);
      const after = p.text.slice(m.index + m[0].length);
      const sub = SUB.exec(after);
      if (SUB.test(before) || (sub && sub.index <= 2)) continue; // "of which saturated fat", "grassi saturi"
      out.push({ p, end: m.index + m[0].length, stop: sub ? m.index + m[0].length + sub.index : Infinity });
    }
    return out.sort((a, b) => (a.p.text.search(name) < 3 ? 0 : 1) - (b.p.text.search(name) < 3 ? 0 : 1) || a.p.y - b.p.y);
  };

  const macro = (name: RegExp): { value?: number; h?: number } => {
    let firstH: number | undefined;
    for (const { p, end, stop } of labelsFor(name)) {
      firstH = firstH ?? p.h;
      const cands = rowNumbers(p, end, stop).filter((n) => n.unit === 'g' || n.unit === '');
      const v = grams(pick(cands));
      if (v !== undefined) return { value: v, h: p.h };
      if (/(trace|tracce|nil\b|spuren)/i.test(p.text)) return { value: 0, h: p.h };
    }
    return { h: firstH };
  };

  const fat = macro(FAT);
  const carbs = macro(CARBS);
  const protein = macro(PROTEIN);

  // Energy: every kcal figure in sight; per 100 g one is picked by its column, or (with all three macros read)
  // the one that matches them best. "1046/250" under a "kJ/kcal" heading and kJ-only labels also work.
  const kcalCands: Num[] = [];
  for (const p of ps) for (const n of numbersIn(p)) if (n.unit === 'kcal' && n.value > 0 && n.value <= 950) kcalCands.push(n);
  let energyH: number | undefined;
  for (const { p, end } of labelsFor(ENERGY)) {
    energyH = energyH ?? p.h;
    if (kcalCands.length > 0) break;
    const row = rowNumbers(p, end, Infinity);
    const named = /kcal/i.test(p.text);
    for (const q of [p, ...ps.filter((q) => q !== p && Math.abs(q.yc - p.yc) <= Math.max(p.h, q.h) * 0.75 && q.x > p.x)]) {
      const pair = /(\d+(?:[.,]\d+)?)\s*(?:kj)?\s*\/\s*(\d+(?:[.,]\d+)?)\s*(?:kcal)?/i.exec(q.text);
      if (pair && (named || /kcal/i.test(q.text))) {
        const x = q.x + (q.w * (pair.index + pair[0].length / 2)) / Math.max(1, q.text.length);
        kcalCands.push({ value: parseFloat(pair[2].replace(',', '.')), unit: 'kcal', x, at: pair.index, raw: pair[2], lessThan: false });
      }
    }
    if (kcalCands.length === 0 && named) for (const n of row) if (n.unit === '' && n.value > 0 && n.value <= 950) kcalCands.push({ ...n, unit: 'kcal' });
    if (kcalCands.length === 0) for (const n of row) if (n.unit === 'kj') kcalCands.push({ ...n, unit: 'kcal', value: n.value / 4.184 });
  }
  let kcalNum: Num | undefined;
  if (kcalCands.length > 1 && fat.value !== undefined && carbs.value !== undefined && protein.value !== undefined) {
    const est = 4 * protein.value + 4 * carbs.value + 9 * fat.value;
    kcalNum = kcalCands.slice().sort((a, b) => Math.abs(a.value - est) - Math.abs(b.value - est))[0];
  } else kcalNum = pick(kcalCands);
  const kcal = kcalNum ? Math.round(kcalNum.value) : undefined;

  // For the camera's hints: is a table in sight, and is it big enough to read?
  const heights = [fat.h, carbs.h, protein.h, energyH].filter((h): h is number => h !== undefined);
  const seen = heights.length || (ps.some((p) => NUTRIENT_WORD.test(p.text)) ? 1 : 0);
  const textHeight = heights.length ? heights.sort((a, b) => a - b)[Math.floor(heights.length / 2)] : 0;

  const values = { kcal, protein: protein.value, carbs: carbs.value, fat: fat.value };
  const found = Object.values(values).filter((v) => v !== undefined).length;
  return { unit, ...values, found, seen, textHeight };
}

// Several frames of the same table: for each number, the value most frames read (on a tie, the latest).
// `agree` is how many frames back up the weakest of the three macros (kcal can be worked out from them).
export function combineReadings(rs: LabelResult[]): LabelResult & { agree: number } {
  const mode = <T>(vals: (T | undefined)[]): { value?: T; count: number } => {
    const counts = new Map<T, number>();
    let best: { value?: T; count: number } = { count: 0 };
    vals.forEach((v) => {
      if (v === undefined) return;
      const c = (counts.get(v) ?? 0) + 1;
      counts.set(v, c);
      if (c >= best.count) best = { value: v, count: c };
    });
    return best;
  };
  const kcal = mode(rs.map((r) => r.kcal));
  const protein = mode(rs.map((r) => r.protein));
  const carbs = mode(rs.map((r) => r.carbs));
  const fat = mode(rs.map((r) => r.fat));
  const unit = mode(rs.map((r) => r.unit)).value ?? 'g';
  const values = { kcal: kcal.value, protein: protein.value, carbs: carbs.value, fat: fat.value };
  const last = rs[rs.length - 1];
  return {
    unit,
    ...values,
    found: Object.values(values).filter((v) => v !== undefined).length,
    seen: last?.seen ?? 0,
    textHeight: last?.textHeight ?? 0,
    agree: Math.min(protein.count, carbs.count, fat.count),
  };
}

// A real product barcode (EAN-8, UPC-A, EAN-13, GTIN-14) ends in a check digit: a misread one fails this.
export function validBarcode(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  let sum = 0;
  digits.reverse().forEach((d, i) => (sum += d * (i % 2 === 0 ? 3 : 1)));
  return (10 - (sum % 10)) % 10 === check;
}
