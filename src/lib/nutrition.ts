// Nutrition: foods, what was eaten, the day's totals and whether the day reached its goal.

import type { DateKey } from './dates.ts';

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

// A food's numbers are per 100 g, per 100 ml or per 1 serving.
export type FoodUnit = 'g' | 'ml' | 'serving';

export type Food = Macros & {
  id: string;
  name: string;
  unit: FoodUnit;
  lastUsed: number;
  pack?: number; // grams or ml in a whole pack, when known: for "half a pack"
  // A dish (the owner, 18 Nov 2026): a food made of ingredients. Its own numbers are the whole dish's
  // (unit 'serving', 1 = the whole dish), worked out from the ingredients.
  ingredients?: Ingredient[];
};

// An ingredient of a dish: a food's numbers (per 100 g, 100 ml or serving) and how much of it went in.
export type Ingredient = Macros & {
  id: string;
  name: string;
  unit: FoodUnit;
  amount: number;
  pack?: number;
};

export type FoodEntry = Macros & {
  id: string;
  date: DateKey;
  time: string; // 'HH:MM'
  name: string;
  foodId?: string;
  amount?: number; // grams, ml or servings
  unit?: FoodUnit;
  dish?: boolean; // logged from a dish: the amount is a part of the whole dish
};

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function basis(unit: FoodUnit): number {
  return unit === 'serving' ? 1 : 100;
}

export function basisLabel(unit: FoodUnit): string {
  return unit === 'serving' ? 'per serving' : unit === 'ml' ? 'per 100 ml' : 'per 100 g';
}

export function amountLabel(amount: number, unit: FoodUnit, dish?: boolean): string {
  if (dish) return dishPart(amount);
  const n = round1(amount);
  if (unit === 'serving') return n + (n === 1 ? ' serving' : ' servings');
  return n + ' ' + unit;
}

// What a whole dish comes to: every ingredient, by how much of it went in.
export function dishTotals(ingredients: Ingredient[]): Macros {
  return sum(ingredients.map((i) => scale(i, i.amount)));
}

// How much of a dish was eaten, in words: 'Whole dish', '½ dish', '⅓ dish', '2 dishes', '0.8 of the dish'.
export function dishPart(amount: number): string {
  const near = (v: number) => Math.abs(amount - v) < 0.01;
  if (near(1)) return 'Whole dish';
  if (near(0.5)) return '½ dish';
  if (near(1 / 3)) return '⅓ dish';
  if (near(0.25)) return '¼ dish';
  if (near(2 / 3)) return '⅔ dish';
  if (near(0.75)) return '¾ dish';
  if (amount > 1 && Math.abs(amount - Math.round(amount)) < 0.01) return Math.round(amount) + ' dishes';
  return Math.round(amount * 100) / 100 + ' of the dish';
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// What `amount` of a food comes to.
export function scale(food: Macros & { unit: FoodUnit }, amount: number): Macros {
  const f = amount / basis(food.unit);
  return {
    kcal: Math.round(food.kcal * f),
    protein: round1(food.protein * f),
    carbs: round1(food.carbs * f),
    fat: round1(food.fat * f),
  };
}

export function sum(items: Macros[]): Macros {
  const t = { ...ZERO };
  for (const m of items) {
    t.kcal += m.kcal;
    t.protein += m.protein;
    t.carbs += m.carbs;
    t.fat += m.fat;
  }
  return { kcal: Math.round(t.kcal), protein: round1(t.protein), carbs: round1(t.carbs), fat: round1(t.fat) };
}

// Calories the macros add up to (4 per g of protein and carbs, 9 per g of fat).
export function macroKcal(m: { protein: number; carbs: number; fat: number }): number {
  return Math.round(m.protein * 4 + m.carbs * 4 + m.fat * 9);
}

// A day counts as "goal reached" from 95% to 110% of the calorie goal.
export const HIT_FROM = 0.95;
export const HIT_TO = 1.1;

export type DayStatus = 'none' | 'under' | 'hit' | 'over';

export function dayStatus(kcal: number, goal: number): DayStatus {
  if (kcal <= 0 || goal <= 0) return 'none';
  const f = kcal / goal;
  if (f < HIT_FROM) return 'under';
  if (f > HIT_TO) return 'over';
  return 'hit';
}

export function proteinHit(protein: number, goal: number): boolean {
  return goal > 0 && protein >= goal * HIT_FROM;
}

// '1,850'
export function thousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Numbers typed on a phone keyboard: accepts a comma as the decimal point; never negative.
export function parseNum(text: string): number {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
