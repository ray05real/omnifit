// Run with: npm.cmd test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { combineReadings, fixDigits, parseLabel, validBarcode, type LabelLine, type LabelResult } from './label.ts';

// A piece of text at a column and a row of a made-up photo (rows 0.05 apart, text 0.03 tall).
const COL = [0.05, 0.55, 0.78];
const cell = (text: string, col: number, row: number, tilt = 0): LabelLine => ({
  text,
  x: COL[col],
  y: 0.1 + row * 0.05 + (col === 1 ? 0.004 : 0) + tilt * COL[col],
  w: text.length * 0.012,
  h: 0.03,
});
const values = (r: LabelResult) => ({ unit: r.unit, kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat, found: r.found });

const PHILLY = [
  ['Typical values', 'Per 100g', 'Per 30g'],
  ['Energy', '1046kJ', '314kJ'],
  ['', '250kcal', '75kcal'],
  ['Fat', '21g', '6.3g'],
  ['of which saturates', '14g', '4.2g'],
  ['Carbohydrate', '4.3g', '1.3g'],
  ['of which sugars', '4.3g', '1.3g'],
  ['Fibre', '0.5g', '0.2g'],
  ['Protein', '5.4g', '1.6g'],
  ['Salt', '0.75g', '0.23g'],
];
const phillyCells = (tilt = 0, rowGap = 1) =>
  // Read column by column, as the phone often hands them over.
  [0, 1, 2].flatMap((c) =>
    PHILLY.map((r, i) => (r[c] ? cell(r[c], c, i * rowGap, tilt) : null)).filter((x): x is LabelLine => x !== null),
  );

test('label: a UK table read cell by cell, in column order (Philadelphia)', () => {
  assert.deepEqual(values(parseLabel(phillyCells())), { unit: 'g', kcal: 250, protein: 5.4, carbs: 4.3, fat: 21, found: 4 });
});

test('label: a slightly tilted photo, and rows packed tightly together', () => {
  assert.deepEqual(values(parseLabel(phillyCells(0.03))), { unit: 'g', kcal: 250, protein: 5.4, carbs: 4.3, fat: 21, found: 4 });
  assert.deepEqual(values(parseLabel(phillyCells(0, 0.75))), { unit: 'g', kcal: 250, protein: 5.4, carbs: 4.3, fat: 21, found: 4 });
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
  assert.deepEqual(values(parseLabel(lines)), { unit: 'g', kcal: 375, protein: 13, carbs: 60, fat: 7, found: 4 });
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
  assert.deepEqual(values(parseLabel(lines)), { unit: 'ml', kcal: 64, protein: 3.3, carbs: 4.8, fat: 3.6, found: 4 });
});

test('label: misreads ("g" as 9, O for 0), "less than", kJ/kcal pairs, the reference-intake footnote', () => {
  const lines = [
    cell('Per 100g', 1, 0),
    cell('Energy (kcal)', 0, 1), cell('389', 1, 1),
    cell('Fat', 0, 2), cell('6.99', 1, 2), // 6.9g
    cell('Carbohydrate', 0, 3), cell('669', 1, 3), // 66g
    cell('Protein', 0, 4), cell('<O.5g', 1, 4), // "<0.5g" with an O
  ];
  assert.deepEqual(values(parseLabel(lines)), { unit: 'g', kcal: 389, protein: 0.5, carbs: 66, fat: 6.9, found: 4 });

  const pairs = [
    cell('Per 100g', 1, 0), cell('Energy kJ/kcal', 0, 1), cell('1046/250', 1, 1),
    cell('Fat', 0, 2), cell('21g', 1, 2), cell('Carbohydrate', 0, 3), cell('4.3g', 1, 3), cell('Protein', 0, 4), cell('5.4g', 1, 4),
    cell('Reference intake of an average adult (8400kJ/2000kcal)', 0, 6),
  ];
  assert.equal(parseLabel(pairs).kcal, 250);

  assert.equal(fixDigits('O.5g'), '0.5g');
  assert.equal(fixDigits('1O.2g'), '10.2g');
  assert.equal(fixDigits('l.3g'), '1.3g');
  assert.equal(fixDigits('Total fat'), 'Total fat');
});

test('label: what the camera hints are based on', () => {
  const none = parseLabel([cell('Ingredients: milk, salt', 0, 0), cell('Best before', 0, 1)]);
  assert.equal(none.found, 0);
  assert.equal(none.seen, 0);
  const far = parseLabel(phillyCells().map((l) => ({ ...l, h: 0.008 })));
  assert.ok(far.seen >= 3 && far.textHeight < 0.012);
  assert.equal(parseLabel([]).found, 0);
});

test('label: several frames agree on a value, one bad read loses', () => {
  const r = (kcal: number, protein: number, carbs: number, fat: number): LabelResult => ({ unit: 'g', kcal, protein, carbs, fat, found: 4, seen: 4, textHeight: 0.03 });
  const c = combineReadings([r(250, 5.4, 4.3, 21), r(250, 5.4, 4.3, 2.1), r(250, 5.4, 4.3, 21)]);
  assert.deepEqual([c.kcal, c.protein, c.carbs, c.fat, c.agree], [250, 5.4, 4.3, 21, 2]);
  const partial = combineReadings([{ unit: 'g', fat: 21, found: 1, seen: 2, textHeight: 0.02 }]);
  assert.deepEqual([partial.found, partial.agree], [1, 0]);
});

test('label: barcodes with a wrong check digit are refused', () => {
  assert.equal(validBarcode('5000112637922'), true); // a real EAN-13
  assert.equal(validBarcode('5000112637923'), false);
  assert.equal(validBarcode('96385074'), true); // EAN-8
  assert.equal(validBarcode('036000291452'), true); // UPC-A
  assert.equal(validBarcode('12345'), false);
});
