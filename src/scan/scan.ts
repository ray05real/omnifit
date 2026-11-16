// "Scan the pack": take a photo of a food pack and get its calories and macros.
//
// Reading the photo happens on the phone (modules/label-reader, Apple's own text and barcode reading).
// In the standard version that is all there is: nothing leaves the phone. In the owner's own version
// (variant.json "scale": true) a barcode in the photo is also looked up in Open Food Facts, a free public
// food database: only the barcode's digits are sent, nothing about the person.

import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { labelReaderAvailable, scanPhoto } from '../../modules/label-reader';
import variant from '../../variant.json';
import { parseLabel } from '../lib/label';
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

export type PackScan =
  | { status: 'ok'; values: PackValues }
  | { status: 'cancelled' }
  | { status: 'no-camera' } // camera permission refused
  | { status: 'nothing'; sawBarcode: boolean } // no table could be read (and no barcode match)
  | { status: 'error'; message: string };

export async function scanPack(): Promise<PackScan> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { status: 'no-camera' };
    const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });
    if (shot.canceled || !shot.assets?.[0]) return { status: 'cancelled' };

    const { lines, barcodes } = await scanPhoto(shot.assets[0].uri);
    const code = barcodes.find((b) => /^\d{8,14}$/.test(b));

    if (barcodeLookup && code) {
      const product = await lookUpBarcode(code).catch(() => null);
      if (product && product.found > 0) return { status: 'ok', values: product };
    }

    const label = parseLabel(lines);
    if (label.found > 0) return { status: 'ok', values: { source: 'label', ...label } };
    return { status: 'nothing', sawBarcode: !!code };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};
const round1 = (v: number | undefined) => (v === undefined ? undefined : Math.round(v * 10) / 10);

// Open Food Facts (openfoodfacts.org): free, no account. Values are per 100 g or 100 ml.
async function lookUpBarcode(code: string): Promise<PackValues | null> {
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
    return {
      source: 'barcode',
      name: name || undefined,
      unit: liquid ? 'ml' : 'g',
      kcal: kcal !== undefined ? Math.round(kcal) : undefined,
      protein,
      carbs,
      fat,
      pack: pack && pack > 0 ? Math.round(pack) : undefined,
      found: [kcal, protein, carbs, fat].filter((v) => v !== undefined).length,
    };
  } finally {
    clearTimeout(timer);
  }
}
