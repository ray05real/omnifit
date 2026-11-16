// Turns what the phone read off a pack's nutrition table (pieces of text and where each sits in the photo)
// into calories, protein, carbs and fat. All of it happens on the phone; this file has no camera or internet
// in it, so it can be tested on the PC.
//
// The positions matter: a table is read as loose pieces ("Fat", "21g", "6.3g"), often column by column, so
// the pieces are first put back into rows by their height in the picture, and the "per 100 g" column is
// found by the heading above it.

import type { FoodUnit } from './nutrition.ts';

export type LabelLine = { text: string; x: number; y: number; w: number; h: number };

export type LabelResult = {
  unit: FoodUnit; // what the numbers are per: 100 g, 100 ml or a serving
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  found: number; // how many of the four were read
};

type Row = { text: string; xAt: number[]; y: number }; // xAt[i] = where character i sits across the photo
type Num = { value: number; unit: string; x: number; at: number; raw: string };

// The table's words in the languages the owner is likely to meet (English, Italian, German, French, Spanish).
const FAT = /\b(fats?|grassi|fett|lipides|mati[eè]res grasses|grasas)\b/i;
const CARBS = /(carbohydrates?|carbs\b|carboidrati|kohlenhydrate|glucides|hidratos)/i;
const PROTEIN = /(proteins?\b|proteine|eiwei(ß|ss)|prot[eé]ines?|prote[ií]nas)/i;
const ENERGY = /(energy|energia|energie|[ée]nergie|valor energ|calories|kcal|kj)/i;
// Sub-rows ("of which saturates") and other rows that must not be taken for fat or carbs.
const SUB = /(of which|di cui|davon|dont\b|de l[ao]s cuales|satur|sugars?|zuccheri|zucker|sucres|az[uú]cares|polyols)/i;

function toRows(lines: LabelLine[]): Row[] {
  const sorted = lines
    .filter((l) => l.text.trim().length > 0)
    .slice()
    .sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const groups: LabelLine[][] = [];
  for (const l of sorted) {
    const yc = l.y + l.h / 2;
    const g = groups[groups.length - 1];
    if (g) {
      const mean = g.reduce((s, m) => s + m.y + m.h / 2, 0) / g.length;
      const height = g.reduce((s, m) => s + m.h, 0) / g.length;
      // Same row if the middles are within about half a line of each other.
      if (Math.abs(yc - mean) <= Math.max(height, l.h) * 0.55) {
        g.push(l);
        continue;
      }
    }
    groups.push([l]);
  }
  return groups.map((g) => {
    g.sort((a, b) => a.x - b.x);
    let text = '';
    const xAt: number[] = [];
    for (const l of g) {
      if (text) {
        text += ' ';
        xAt.push(l.x);
      }
      for (let i = 0; i < l.text.length; i++) xAt.push(l.x + (l.w * i) / Math.max(1, l.text.length));
      text += l.text;
    }
    return { text, xAt, y: g[0].y };
  });
}

// Every number in a row, with its unit if one is attached ("5.4g", "250 kcal", "<0,5 g", "12%").
function numbers(row: Row): Num[] {
  const out: Num[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s*(kcal|kj|mg|ml|g|%)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(row.text))) {
    const next = row.text[m.index + m[0].length] ?? '';
    // "100g" in a heading or "30g" in "per serving (30g)" are sizes, not values: the callers skip those rows.
    out.push({
      value: parseFloat(m[1].replace(',', '.')),
      unit: (m[2] ?? '').toLowerCase() || (next === '%' ? '%' : ''),
      x: row.xAt[m.index] ?? 0,
      at: m.index,
      raw: m[1],
    });
  }
  return out;
}

// From the candidates in a row, the one in the "per 100" column (nearest to its heading), or else the first.
function pick(cands: Num[], x100: number | null): Num | undefined {
  if (cands.length === 0) return undefined;
  if (x100 === null) return cands[0];
  return cands.slice().sort((a, b) => Math.abs(a.x - x100) - Math.abs(b.x - x100))[0];
}

// Grams per 100 g can't be more than 100: "21g" read as "219" is the usual culprit (the g taken for a 9).
function grams(n: Num | undefined): number | undefined {
  if (!n) return undefined;
  let v = n.value;
  const strip = () => parseFloat(n.raw.slice(0, -1).replace(',', '.'));
  // "669" for 66g; and "6.99" for 6.9g (labels print one decimal, so a second one ending in 9 is the g).
  if (n.unit === '' && /9$/.test(n.raw) && (v > 100 || /[.,]\d9$/.test(n.raw))) v = strip();
  if (!Number.isFinite(v) || v < 0 || v > 100) return undefined;
  return Math.round(v * 10) / 10;
}

export function parseLabel(lines: LabelLine[]): LabelResult {
  const rows = toRows(lines);

  // The "per 100 g" (or ml) heading: its place across the photo tells which column to read.
  let x100: number | null = null;
  let unit: FoodUnit = 'g';
  let sawServing = false;
  for (const r of rows) {
    const m = /100\s*(g|ml)\b/i.exec(r.text);
    if (m && x100 === null) {
      x100 = r.xAt[m.index] ?? null;
      unit = m[1].toLowerCase() === 'ml' ? 'ml' : 'g';
    }
    if (/(serving|portion|porzione|porci[oó]n)/i.test(r.text)) sawServing = true;
  }
  if (x100 === null && sawServing) unit = 'serving';

  const isHeading = (r: Row) => /100\s*(g|ml)\b/i.test(r.text) && !FAT.test(r.text) && !CARBS.test(r.text) && !PROTEIN.test(r.text) && !/kcal/i.test(r.text.replace(/100\s*(g|ml)/gi, ''));

  // A macro: the row that names it (not a sub-row), then the gram value to the right of the name.
  const macro = (name: RegExp): number | undefined => {
    for (const r of rows) {
      const m = name.exec(r.text);
      if (!m || SUB.test(r.text) || isHeading(r)) continue;
      const after = m.index + m[0].length;
      const cands = numbers(r).filter((n) => n.at >= after && (n.unit === 'g' || n.unit === ''));
      const v = grams(pick(cands, x100));
      if (v !== undefined) return v;
      if (/(trace|tracce|nil\b|spuren)/i.test(r.text)) return 0;
    }
    return undefined;
  };

  // Energy: the kcal figure (it is often on its own line under the kJ one); kJ only as a last resort.
  let kcal: number | undefined;
  for (const r of rows) {
    if (isHeading(r)) continue;
    const withUnit = numbers(r).filter((n) => n.unit === 'kcal');
    const chosen = pick(withUnit, x100);
    if (chosen) {
      kcal = Math.round(chosen.value);
      break;
    }
  }
  if (kcal === undefined) {
    for (const r of rows) {
      if (!ENERGY.test(r.text) || isHeading(r)) continue;
      const all = numbers(r);
      // "Energy (kcal) 250 75": the unit is in the name, the numbers stand alone.
      const k = /kcal/i.exec(r.text);
      const bare = k ? pick(all.filter((n) => n.at > k.index && n.unit === ''), x100) : undefined;
      if (bare) {
        kcal = Math.round(bare.value);
        break;
      }
      const kj = pick(all.filter((n) => n.unit === 'kj'), x100);
      if (kj) {
        kcal = Math.round(kj.value / 4.184);
        break;
      }
    }
  }
  if (kcal !== undefined && (kcal <= 0 || kcal > 950)) kcal = undefined; // pure fat is 900 kcal per 100 g

  const fat = macro(FAT);
  const carbs = macro(CARBS);
  const protein = macro(PROTEIN);
  const found = [kcal, fat, carbs, protein].filter((v) => v !== undefined).length;
  return { unit, kcal, protein, carbs, fat, found };
}
