// "Scan the pack": what the two scanners hand back, and the barcode lookup.
//
// Reading the nutrition table happens on the phone (modules/label-reader, Apple's own text reading); in the
// standard version that is all there is, and nothing leaves the phone. Only the owner's own version
// (variant.json "scale": true) has the barcode scanner, which looks the barcode up in Open Food Facts, a free
// public food database: only the barcode's digits are sent, nothing about the person.

import { Platform } from 'react-native';

import { labelReaderAvailable } from '../../modules/label-reader';
import variant from '../../variant.json';
import type { FoodUnit } from '../lib/nutrition';

export const scanAvailable = Platform.OS === 'ios' && labelReaderAvailable;
export const barcodeLookup: boolean = variant.scale; // the owner's own version only

export type PackValues = {
  source: 'label' | 'barcode';
  name?: string;
  unit: FoodUnit;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  pack?: number; // grams or ml in the whole pack, when known
  found: number; // how many of calories / protein / carbs / fat were read
};

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};
const round1 = (v: number | undefined) => (v === undefined ? undefined : Math.round(v * 10) / 10);

// Open Food Facts (openfoodfacts.org): free, no account. Values are per 100 g or 100 ml.
// null = not in the database (or no internet).
export async function lookUpBarcode(code: string): Promise<PackValues | null> {
  if (!barcodeLookup) return null; // the standard version never goes online
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 8000);
  try {
    const fields = 'product_name,brands,nutriments,product_quantity,product_quantity_unit,quantity';
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`, {
      signal: stop.signal,
      headers: { 'User-Agent': 'Omniload/1.0 (iOS app)' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const p = json?.product;
    if (!p || !p.nutriments) return null;
    const n = p.nutriments;
    const kj = num(n['energy_100g']);
    const kcal = num(n['energy-kcal_100g']) ?? (kj !== undefined ? kj / 4.184 : undefined);
    const protein = round1(num(n['proteins_100g']));
    const carbs = round1(num(n['carbohydrates_100g']));
    const fat = round1(num(n['fat_100g']));
    const brand = String(p.brands ?? '').split(',')[0].trim();
    const product = String(p.product_name ?? '').trim();
    const name = [brand && !product.toLowerCase().includes(brand.toLowerCase()) ? brand : '', product].filter(Boolean).join(' ');
    const liquid = /^(ml|cl|l)$/i.test(String(p.product_quantity_unit ?? '')) || /\d\s*(ml|cl|l)\b/i.test(String(p.quantity ?? ''));
    const pack = num(p.product_quantity);
    const found = [kcal, protein, carbs, fat].filter((v) => v !== undefined).length;
    if (found === 0) return null;
    return {
      source: 'barcode',
      name: name || undefined,
      unit: liquid ? 'ml' : 'g',
      kcal: kcal !== undefined ? Math.round(kcal) : undefined,
      protein,
      carbs,
      fat,
      pack: pack && pack > 0 ? Math.round(pack) : undefined,
      found,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
