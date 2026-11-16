// Run with: npm.cmd test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseLabel, type LabelLine } from './label.ts';

// A piece of text at a column and a row of a made-up photo.
const COL = [0.05, 0.55, 0.78];
const cell = (text: string, col: number, row: number): LabelLine => ({
  text,
  x: COL[col],
  y: 0.1 + row * 0.05 + (col === 1 ? 0.004 : 0), // real photos are never perfectly level
  w: text.length * 0.012,
  h: 0.03,
});

test('label: a UK table read cell by cell, in column order (Philadelphia)', () => {
  // The phone often hands the pieces over column by column, not row by row.
  const lines = [
    cell('Typical values', 0, 0), cell('Energy', 0, 1), cell('Fat', 0, 3), cell('of which saturates', 0, 4),
    cell('Carbohydrate', 0, 5), cell('of which sugars', 0, 6), cell('Fibre', 0, 7), cell('Protein', 0, 8), cell('Salt', 0, 9),
    cell('Per 100g', 1, 0), cell('1046kJ', 1, 1), cell('250kcal', 1, 2), cell('21g', 1, 3), cell('14g', 1, 4),
    cell('4.3g', 1, 5), cell('4.3g', 1, 6), cell('0.5g', 1, 7), cell('5.4g', 1, 8), cell('0.75g', 1, 9),
    cell('Per 30g', 2, 0), cell('314kJ', 2, 1), cell('75kcal', 2, 2), cell('6.3g', 2, 3), cell('4.2g', 2, 4),
    cell('1.3g', 2, 5), cell('1.3g', 2, 6), cell('0.2g', 2, 7), cell('1.6g', 2, 8), cell('0.23g', 2, 9),
  ];
  assert.deepEqual(parseLabel(lines), { unit: 'g', kcal: 250, protein: 5.4, carbs: 4.3, fat: 21, found: 4 });
});

test('label: whole rows read as one piece, per-serving column first', () => {
  const row = (text: string, n: number): LabelLine => ({ text, x: 0.05, y: 0.1 + n * 0.05, w: text.length * 0.012, h: 0.03 });
  const lines = [
    row('Nutrition          Per serving   Per 100g', 0),
    row('Energy             628kJ/150kcal 1570kJ/375kcal', 1),
    row('Fat                2.8g          7.0g', 2),
    row('of which saturates 0.5g          1.3g', 3),
    row('Carbohydrate       24g           60g', 4),
    row('of which sugars    0.4g          1.0g', 5),
    row('Protein            5.2g          13g', 6),
  ];
  assert.deepEqual(parseLabel(lines), { unit: 'g', kcal: 375, protein: 13, carbs: 60, fat: 7, found: 4 });
});

test('label: an Italian pack, comma decimals, kJ only', () => {
  const lines = [
    cell('Valori medi', 0, 0), cell('per 100 ml', 1, 0),
    cell('Energia', 0, 1), cell('268 kJ', 1, 1),
    cell('Grassi', 0, 2), cell('3,6 g', 1, 2),
    cell('di cui acidi grassi saturi', 0, 3), cell('2,4 g', 1, 3),
    cell('Carboidrati', 0, 4), cell('4,8 g', 1, 4),
    cell('di cui zuccheri', 0, 5), cell('4,8 g', 1, 5),
    cell('Proteine', 0, 6), cell('3,3 g', 1, 6),
    cell('Sale', 0, 7), cell('0,1 g', 1, 7),
  ];
  assert.deepEqual(parseLabel(lines), { unit: 'ml', kcal: 64, protein: 3.3, carbs: 4.8, fat: 3.6, found: 4 });
});

test('label: a "g" misread as a 9, "less than" values, and a table that is not there', () => {
  const lines = [
    cell('Per 100g', 1, 0),
    cell('Energy (kcal)', 0, 1), cell('389', 1, 1),
    cell('Fat', 0, 2), cell('6.99', 1, 2), // 6.9g
    cell('Carbohydrate', 0, 3), cell('669', 1, 3), // 66g
    cell('Protein', 0, 4), cell('<0.5g', 1, 4),
  ];
  assert.deepEqual(parseLabel(lines), { unit: 'g', kcal: 389, protein: 0.5, carbs: 66, fat: 6.9, found: 4 });
  assert.equal(parseLabel([cell('Ingredients: milk, salt', 0, 0), cell('Best before', 0, 1)]).found, 0);
  assert.equal(parseLabel([]).found, 0);
});
