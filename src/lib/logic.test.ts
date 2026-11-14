// Run with: npm.cmd test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays, agoLabel, daysBetween, formatDay, fromKey, monthGrid, relativeDay, toKey } from './dates.ts';
import { compareSet, dayChange, describeChange, formatMinutes, formatWeight, setLabel, splitWeight, topSet, type LoggedSet } from './overload.ts';
import { dayStatus, macroKcal, parseNum, proteinHit, scale, sum, thousands } from './nutrition.ts';
import { formatDuration, hours1, sleepStatus, toPoints, trend } from './body.ts';

test('dates: keys are local days and survive month ends and clock changes', () => {
  assert.equal(toKey(new Date(2026, 10, 11, 23, 59)), '2026-11-11');
  assert.equal(toKey(fromKey('2026-03-29')), '2026-03-29');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-03-28', 2), '2026-03-30'); // across the UK clock change
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(daysBetween('2026-10-20', '2026-11-11'), 22);
  assert.equal(formatDay('2026-11-11'), 'Wed 11 Nov');
  assert.equal(relativeDay('2026-11-10', '2026-11-11'), 'Yesterday');
  assert.equal(agoLabel('2026-11-08', '2026-11-11'), '3 days ago');
});

test('dates: the month grid starts on Monday', () => {
  const nov = monthGrid(2026, 10); // 1 Nov 2026 is a Sunday
  assert.equal(nov.length % 7, 0);
  assert.equal(nov[6], '2026-11-01');
  assert.equal(nov.slice(0, 6).every((c) => c === null), true);
  assert.equal(nov.filter(Boolean).length, 30);
  const feb = monthGrid(2027, 1); // 1 Feb 2027 is a Monday
  assert.equal(feb[0], '2027-02-01');
  assert.equal(feb.length, 28);
});

test('overload: a set is up, the same or down on last time', () => {
  const prev = { weight: 80, reps: 8 };
  assert.equal(compareSet({ weight: 80, reps: 8 }, prev), 'same');
  assert.equal(compareSet({ weight: 82.5, reps: 8 }, prev), 'up');
  assert.equal(compareSet({ weight: 80, reps: 9 }, prev), 'up');
  assert.equal(compareSet({ weight: 80, reps: 7 }, prev), 'down');
  assert.equal(compareSet({ weight: 77.5, reps: 8 }, prev), 'down');
  assert.equal(compareSet({ weight: 80, reps: 8 }, null), 'first');
  assert.equal(compareSet({ weight: 80, reps: 8 }, { weight: 0, reps: 0 }), 'first');
  // More weight for fewer reps: the estimated one-rep max decides.
  assert.equal(compareSet({ weight: 85, reps: 7 }, prev), 'up'); // 104.8 against 101.3
  assert.equal(compareSet({ weight: 85, reps: 5 }, prev), 'down'); // 99.2 against 101.3
  // Bodyweight exercises (0 kg) go by reps.
  assert.equal(compareSet({ weight: 0, reps: 12 }, { weight: 0, reps: 10 }), 'up');
});

test('overload: the day takes the colour of most of its sets', () => {
  const s = (weight: number, reps: number, pw: number | null, pr = 8): LoggedSet => ({
    exerciseId: 'e', exerciseName: 'Bench', setIndex: 0, weight, reps, prev: pw === null ? null : { weight: pw, reps: pr },
  });
  assert.equal(dayChange([]), null);
  assert.equal(dayChange([s(80, 8, null)]), 'first');
  assert.equal(dayChange([s(82.5, 8, 80), s(80, 8, 80)]), 'up');
  assert.equal(dayChange([s(80, 8, 80), s(80, 8, 80)]), 'same');
  assert.equal(dayChange([s(82.5, 8, 80), s(77.5, 8, 80)]), 'same');
  assert.equal(dayChange([s(77.5, 8, 80), s(80, 8, 80), s(80, 8, null)]), 'down');
});

test('overload: labels and the wheel', () => {
  assert.equal(describeChange({ weight: 82.5, reps: 8 }, { weight: 80, reps: 8 }), '+2.5 kg');
  assert.equal(describeChange({ weight: 80, reps: 7 }, { weight: 80, reps: 8 }), '−1 rep');
  assert.equal(describeChange({ weight: 85, reps: 6 }, { weight: 80, reps: 8 }), '+5 kg · −2 reps');
  assert.equal(describeChange({ weight: 80, reps: 8 }, null), '');
  assert.equal(formatWeight(41.25), '41.25');
  assert.equal(formatWeight(80), '80');
  assert.deepEqual(splitWeight(41.25), { whole: 41, quarter: 0.25 });
  assert.deepEqual(splitWeight(82.5), { whole: 82, quarter: 0.5 });
  assert.deepEqual(splitWeight(79.99), { whole: 80, quarter: 0 });
  assert.deepEqual(topSet([{ weight: 80, reps: 8 }, { weight: 85, reps: 5 }, { weight: 85, reps: 6 }]), { weight: 85, reps: 6 });
});

test('overload: cardio is minutes and watts', () => {
  const prev = { weight: 20, reps: 150 };
  assert.equal(compareSet({ weight: 25, reps: 150 }, prev, 'cardio'), 'up');
  assert.equal(compareSet({ weight: 20, reps: 140 }, prev, 'cardio'), 'down');
  assert.equal(compareSet({ weight: 20, reps: 150 }, prev, 'cardio'), 'same');
  // Shorter but harder: the work done (minutes × watts) decides. 15 × 210 = 3150 against 3000.
  assert.equal(compareSet({ weight: 15, reps: 210 }, prev, 'cardio'), 'up');
  assert.equal(compareSet({ weight: 15, reps: 180 }, prev, 'cardio'), 'down');
  assert.equal(formatMinutes(20), '20');
  assert.equal(formatMinutes(20.5), '20:30');
  assert.equal(formatMinutes(0.25), '0:15');
  assert.equal(setLabel({ weight: 20.5, reps: 150 }, 'cardio', 'W'), '20:30min – 150W');
  assert.equal(setLabel({ weight: 30, reps: 8 }, 'cardio', 'level'), '30min – lvl 8');
  assert.equal(setLabel({ weight: 50, reps: 10 }), '50kg – 10');
  assert.equal(describeChange({ weight: 25, reps: 160 }, prev, 'cardio', 'W'), '+5 min · +10 W');
  assert.equal(describeChange({ weight: 19.5, reps: 150 }, prev, 'cardio', 'W'), '−0:30 min');
});

test('nutrition: amounts, totals and the day', () => {
  const chicken = { kcal: 165, protein: 31, carbs: 0, fat: 3.6, unit: 'g' as const };
  assert.deepEqual(scale(chicken, 150), { kcal: 248, protein: 46.5, carbs: 0, fat: 5.4 });
  const shake = { kcal: 120, protein: 24, carbs: 3, fat: 1.5, unit: 'serving' as const };
  assert.deepEqual(scale(shake, 2), { kcal: 240, protein: 48, carbs: 6, fat: 3 });
  assert.deepEqual(sum([scale(chicken, 150), scale(shake, 2)]), { kcal: 488, protein: 94.5, carbs: 6, fat: 8.4 });
  assert.equal(macroKcal({ protein: 160, carbs: 300, fat: 70 }), 2470);
  assert.equal(dayStatus(0, 2500), 'none');
  assert.equal(dayStatus(2000, 2500), 'under');
  assert.equal(dayStatus(2375, 2500), 'hit');
  assert.equal(dayStatus(2750, 2500), 'hit');
  assert.equal(dayStatus(2800, 2500), 'over');
  assert.equal(proteinHit(152, 160), true);
  assert.equal(proteinHit(140, 160), false);
  assert.equal(thousands(12850), '12,850');
  assert.equal(parseNum('12,5'), 12.5);
  assert.equal(parseNum(''), 0);
  assert.equal(parseNum('-4'), 0);
});

test('body: sleep and the weight trend', () => {
  assert.equal(formatDuration(450), '7 h 30 m');
  assert.equal(formatDuration(480), '8 h');
  assert.equal(hours1(450), 7.5);
  assert.equal(sleepStatus(480, 480), 'hit');
  assert.equal(sleepStatus(430, 480), 'near');
  assert.equal(sleepStatus(400, 480), 'low');
  const pts = toPoints({ '2026-11-03': 81, '2026-11-01': 80, '2026-11-02': 82 });
  assert.deepEqual(pts.map((p) => p.date), ['2026-11-01', '2026-11-02', '2026-11-03']);
  const t = trend(pts);
  assert.equal(t[0].value, 80);
  assert.equal(t[1].value, 80.4); // a fifth of the way to 82
  assert.ok(t[2].value > 80.4 && t[2].value < 81);
});
