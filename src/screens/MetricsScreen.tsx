// Metrics: one calendar (and one graph) that switches between overload, nutrition, weight and sleep.
// Colour says it, not text: green = up / goal reached, amber = the same / a bit short, red = down / over.

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Chart, type Bar } from '../components/Chart';
import { Ring } from '../components/Ring';
import { Glass } from '../components/Glass';
import { Card, IconButton, Screen, Segmented, Sheet, buzz } from '../components/ui';
import {
  average,
  formatDuration,
  hours1,
  sleepStatus,
  toPoints,
  trend,
  type Point,
} from '../lib/body';
import {
  addDays,
  formatDay,
  fromKey,
  monthGrid,
  monthTitle,
  relativeDay,
  type DateKey,
} from '../lib/dates';
import { dayStatus, proteinHit, round1, sum, thousands, type Macros } from '../lib/nutrition';
import {
  compareSet,
  dayChange,
  e1rm,
  setLabel,
  CARDIO_METRICS,
  tally,
  type CardioMetric,
  type ExerciseKind,
  topSet,
  type Change,
  type LoggedSet,
  type Workout,
} from '../lib/overload';
import { useBody } from '../store/body';
import { useToday } from '../store/hooks';
import { useNutrition } from '../store/nutrition';
import { optionsOf, useTraining } from '../store/training';
import { C, T, changeColor } from '../theme';
import { nightLabel, sleepColor } from './SleepScreen';

type Metric = 'overload' | 'nutrition' | 'weight' | 'sleep';
type Range = '1M' | '3M' | '6M' | '1Y' | 'All';

const METRICS: { key: Metric; label: string; color: string }[] = [
  { key: 'overload', label: 'Overload', color: C.overload },
  { key: 'nutrition', label: 'Nutrition', color: C.nutrition },
  { key: 'weight', label: 'Weight', color: C.weight },
  { key: 'sleep', label: 'Sleep', color: C.sleep },
];
const RANGE_DAYS: Record<Range, number> = { '1M': 30, '3M': 91, '6M': 182, '1Y': 365, All: 0 };

function nutritionColor(kcal: number, goal: number): string {
  const s = dayStatus(kcal, goal);
  return s === 'hit' ? C.up : s === 'over' ? C.down : C.same;
}

export const MetricsScreen = React.memo(function MetricsScreen() {
  const today = useToday();
  const [metric, setMetric] = useState<Metric>('overload');
  const [mode, setMode] = useState<'calendar' | 'graph'>('calendar');
  const color = METRICS.find((m) => m.key === metric)!.color;

  return (
    <Screen
      title="Metrics"
      glow={C.glowMetrics}
      glowSoft
      right={
        <Glass style={styles.modeSwitch}>
          <View pointerEvents="none" style={[styles.modeThumb, mode === 'graph' && { left: 45 }]} />
          <IconButton
            icon={mode === 'calendar' ? 'calendar' : 'calendar-outline'}
            label="Calendar"
            color={mode === 'calendar' ? C.text : C.muted}
            size={19}
            onPress={() => {
              buzz();
              setMode('calendar');
            }}
          />
          <IconButton
            icon={mode === 'graph' ? 'stats-chart' : 'stats-chart-outline'}
            label="Graph"
            color={mode === 'graph' ? C.text : C.muted}
            size={19}
            onPress={() => {
              buzz();
              setMode('graph');
            }}
          />
        </Glass>
      }
    >
      <Segmented options={METRICS} value={metric} onChange={setMetric} />
      {mode === 'calendar' ? (
        <CalendarView metric={metric} color={color} today={today} />
      ) : (
        <GraphView metric={metric} color={color} today={today} />
      )}
    </Screen>
  );
});

// Everything the calendar and graphs read, gathered per day.
function useData() {
  const workouts = useTraining((s) => s.workouts);
  const sessions = useTraining((s) => s.sessions);
  const entries = useNutrition((s) => s.entries);
  const goals = useNutrition((s) => s.goals);
  const weights = useBody((s) => s.weights);
  const sleep = useBody((s) => s.sleep);
  const sleepGoal = useBody((s) => s.sleepGoalMin);

  const workoutsByDay = useMemo(() => {
    const m = new Map<DateKey, Workout[]>();
    for (const w of workouts) m.set(w.date, [...(m.get(w.date) ?? []), w]);
    return m;
  }, [workouts]);

  const foodByDay = useMemo(() => {
    const lists = new Map<DateKey, Macros[]>();
    for (const e of entries) lists.set(e.date, [...(lists.get(e.date) ?? []), e]);
    const m = new Map<DateKey, Macros>();
    lists.forEach((list, date) => m.set(date, sum(list)));
    return m;
  }, [entries]);

  const weightPoints = useMemo(() => toPoints(weights), [weights]);
  const sleepPoints = useMemo(() => toPoints(sleep), [sleep]);

  return { workouts, sessions, workoutsByDay, foodByDay, goals, weights, weightPoints, sleep, sleepPoints, sleepGoal };
}

// ───────────────────────── Calendar ─────────────────────────

function CalendarView({ metric, color, today }: { metric: Metric; color: string; today: DateKey }) {
  const d = useData();
  const now = fromKey(today);
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState<DateKey>(today);
  const cells = useMemo(() => monthGrid(ym.y, ym.m), [ym]);
  const move = (n: number) => {
    const dt = new Date(ym.y, ym.m + n, 1, 12);
    setYm({ y: dt.getFullYear(), m: dt.getMonth() });
  };
  const isThisMonth = ym.y === now.getFullYear() && ym.m === now.getMonth();

  const daySets = (date: DateKey): LoggedSet[] => (d.workoutsByDay.get(date) ?? []).flatMap((w) => w.sets);

  // The line under the month: what the month adds up to.
  const monthDays = cells.filter((c): c is DateKey => c !== null);
  let summary = '';
  if (metric === 'overload') {
    const changes = monthDays.map((c) => dayChange(daySets(c))).filter((c): c is Change => c !== null);
    const up = changes.filter((c) => c === 'up').length;
    summary = changes.length === 0 ? 'No gym days this month' : `${changes.length} gym ${changes.length === 1 ? 'day' : 'days'} · ${up} went up`;
  } else if (metric === 'nutrition') {
    const logged = monthDays.map((c) => d.foodByDay.get(c)).filter((m): m is Macros => !!m && m.kcal > 0);
    const hit = logged.filter((m) => dayStatus(m.kcal, d.goals.kcal) === 'hit').length;
    summary = logged.length === 0 ? 'Nothing logged this month' : `Goal reached on ${hit} of ${logged.length} logged ${logged.length === 1 ? 'day' : 'days'}`;
  } else if (metric === 'weight') {
    const vals = monthDays.map((c) => d.weights[c]).filter((v): v is number => v !== undefined);
    if (vals.length === 0) summary = 'No weigh-ins this month';
    else if (vals.length === 1) summary = '1 weigh-in';
    else {
      const diff = round1(vals[vals.length - 1] - vals[0]);
      summary = `${vals.length} weigh-ins · ${diff === 0 ? 'no change' : (diff > 0 ? '+' : '−') + Math.abs(diff).toFixed(1) + ' kg'} over the month`;
    }
  } else {
    const vals = monthDays.map((c) => d.sleep[c]).filter((v): v is number => v !== undefined);
    const avg = average(vals);
    summary = avg === null ? 'No nights logged this month' : `Average ${formatDuration(Math.round(avg))} over ${vals.length} ${vals.length === 1 ? 'night' : 'nights'}`;
  }

  return (
    <>
      {/* As in Apple's Calendar: the month's name big on the left, glass arrows on the right. */}
      <View style={styles.monthRow}>
        <Pressable
          style={{ flex: 1 }}
          disabled={isThisMonth}
          onPress={() => {
            setYm({ y: now.getFullYear(), m: now.getMonth() });
            setSelected(today);
          }}
        >
          <Text style={styles.monthName}>
            {monthTitle(ym.y, ym.m).split(' ')[0]} <Text style={{ color: C.muted }}>{ym.y}</Text>
          </Text>
          <Text style={[T.small, { marginTop: 2 }]}>{summary}</Text>
        </Pressable>
        <IconButton icon="chevron-back" label="Previous month" filled onPress={() => move(-1)} />
        <IconButton icon="chevron-forward" label="Next month" filled onPress={() => move(1)} disabled={isThisMonth} />
      </View>

      <View style={styles.weekdays}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => (
          <Text key={i} style={[styles.weekday, i >= 5 && { color: C.faint }]}>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((date, i) => {
          const rowTop = i % 7 === 0 ? <View key={'l' + i} style={styles.weekLine} /> : null;
          if (!date) return [rowTop, <View key={i} style={styles.cell} />];
          const dayNum = Number(date.slice(8));
          const future = date > today;
          const isToday = date === today;
          const isSel = date === selected;
          let mark: React.ReactNode = null;

          if (metric === 'overload') {
            const change = dayChange(daySets(date));
            if (change) mark = <View style={[styles.disc, { backgroundColor: changeColor(change) }]} />;
          } else if (metric === 'nutrition') {
            const m = d.foodByDay.get(date);
            if (m && m.kcal > 0) {
              mark = (
                <Ring size={26} stroke={4} progress={m.kcal / d.goals.kcal} color={nutritionColor(m.kcal, d.goals.kcal)}>
                  {proteinHit(m.protein, d.goals.protein) ? <View style={[styles.subDot, { backgroundColor: C.protein }]} /> : null}
                </Ring>
              );
            }
          } else if (metric === 'weight') {
            const v = d.weights[date];
            if (v !== undefined) mark = <Text style={[styles.subText, { color: C.weight }]}>{v.toFixed(1)}</Text>;
          } else {
            const v = d.sleep[date];
            if (v !== undefined) {
              mark = <Text style={[styles.subText, { color: sleepColor(sleepStatus(v, d.sleepGoal)) }]}>{hours1(v)}h</Text>;
            }
          }

          return [
            rowTop,
            <Pressable
              key={i}
              style={styles.cell}
              onPress={() => {
                buzz();
                setSelected(date);
              }}
              accessibilityRole="button"
              accessibilityLabel={formatDay(date)}
            >
              <View style={[styles.numWrap, isToday && { backgroundColor: C.thumb }, isSel && { backgroundColor: C.text }]}>
                <Text
                  style={[
                    styles.dayNum,
                    { color: future ? C.faint : C.text },
                    isToday && { fontWeight: '700' },
                    isSel && { color: C.ink, fontWeight: '700' },
                  ]}
                >
                  {dayNum}
                </Text>
              </View>
              <View style={styles.markArea}>{mark}</View>
            </Pressable>,
          ];
        })}
      </View>

      <Legend metric={metric} />

      <Card style={{ marginTop: 14 }}>
        <Text style={T.label}>{relativeDay(selected, today) === formatDay(selected) ? formatDay(selected) : `${relativeDay(selected, today)} · ${formatDay(selected)}`}</Text>
        {metric === 'overload' ? (
          <OverloadDay workouts={d.workoutsByDay.get(selected) ?? []} future={selected > today} />
        ) : metric === 'nutrition' ? (
          <NutritionDay total={d.foodByDay.get(selected)} goals={d.goals} />
        ) : metric === 'weight' ? (
          <WeightDay date={selected} points={d.weightPoints} />
        ) : (
          <SleepDay date={selected} today={today} value={d.sleep[selected]} goal={d.sleepGoal} />
        )}
      </Card>
    </>
  );
}

function Legend({ metric }: { metric: Metric }) {
  const items: { color: string; label: string }[] =
    metric === 'overload'
      ? [
          { color: C.up, label: 'Went up' },
          { color: C.same, label: 'Same' },
          { color: C.down, label: 'Went down' },
          { color: C.overload, label: 'First log' },
        ]
      : metric === 'nutrition'
        ? [
            { color: C.up, label: 'Goal reached' },
            { color: C.same, label: 'Under' },
            { color: C.down, label: 'Over' },
            { color: C.protein, label: 'Protein hit' },
          ]
        : metric === 'sleep'
          ? [
              { color: C.up, label: 'At goal' },
              { color: C.same, label: 'Within 1 h' },
              { color: C.down, label: 'Short' },
            ]
          : [{ color: C.weight, label: 'Weight that morning (kg)' }];
  return (
    <View style={styles.legend}>
      {items.map((it) => (
        <View key={it.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: it.color }]} />
          <Text style={T.small}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

function OverloadDay({ workouts, future }: { workouts: Workout[]; future: boolean }) {
  if (workouts.length === 0) return <Text style={styles.dayNone}>{future ? 'Not yet.' : 'No gym logged.'}</Text>;
  return (
    <>
      {workouts.map((w) => {
        const t = tally(w.sets);
        // The sets in the order they are in the session, grouped by exercise.
        const groups: { name: string; sets: LoggedSet[] }[] = [];
        for (const s of w.sets) {
          let g = groups.find((x) => x.sets[0].exerciseId === s.exerciseId);
          if (!g) groups.push((g = { name: s.exerciseName || 'Exercise', sets: [] }));
          g.sets.push(s);
        }
        return (
          <View key={w.id} style={{ marginTop: 8 }}>
            <Text style={T.h2}>{w.sessionName}</Text>
            <Text style={[T.small, { marginTop: 2, marginBottom: 6 }]}>
              <Text style={{ color: C.up, fontWeight: '700' }}>{t.up} up</Text> ·{' '}
              <Text style={{ color: C.same, fontWeight: '700' }}>{t.same} same</Text> ·{' '}
              <Text style={{ color: C.down, fontWeight: '700' }}>{t.down} down</Text>
              {t.first ? ` · ${t.first} new` : ''}
            </Text>
            {groups.map((g) => (
              <View key={g.sets[0].exerciseId} style={styles.exLine}>
                <Text style={[T.body, { flex: 1, fontWeight: '600' }]} numberOfLines={1}>
                  {g.name}
                </Text>
                <Text style={[T.body, T.num, { flexShrink: 1, textAlign: 'right' }]}>
                  {g.sets
                    .slice()
                    .sort((a, b) => a.setIndex - b.setIndex)
                    .map((s, i) => (
                      <Text key={i} style={{ color: changeColor(compareSet(s, s.prev, s.kind)), fontWeight: '700' }}>
                        {i > 0 ? '   ' : ''}
                        {s.kind === 'cardio' ? setLabel(s, 'cardio', s.metric).replace(' – ', '·') : `${setLabel(s).replace('kg – ', '×')}`}
                      </Text>
                    ))}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </>
  );
}

function NutritionDay({ total, goals }: { total: Macros | undefined; goals: Macros }) {
  if (!total || total.kcal <= 0) return <Text style={styles.dayNone}>Nothing logged.</Text>;
  const s = dayStatus(total.kcal, goals.kcal);
  const c = nutritionColor(total.kcal, goals.kcal);
  return (
    <>
      <View style={styles.bigRow}>
        <Text style={styles.big}>{thousands(total.kcal)}</Text>
        <Text style={T.muted}>of {thousands(goals.kcal)} kcal</Text>
      </View>
      <Text style={{ color: c, fontWeight: '700', fontSize: 14 }}>
        {s === 'hit' ? 'Goal reached' : s === 'over' ? `${thousands(total.kcal - goals.kcal)} over` : `${thousands(goals.kcal - total.kcal)} under`}
      </Text>
      <View style={styles.macroRow}>
        <Text style={[styles.macro, { color: C.protein }]}>Protein {Math.round(total.protein)} / {goals.protein} g</Text>
        <Text style={[styles.macro, { color: C.carbs }]}>Carbs {Math.round(total.carbs)} / {goals.carbs} g</Text>
        <Text style={[styles.macro, { color: C.fat }]}>Fat {Math.round(total.fat)} / {goals.fat} g</Text>
      </View>
    </>
  );
}

function WeightDay({ date, points }: { date: DateKey; points: Point[] }) {
  const i = points.findIndex((p) => p.date === date);
  if (i < 0) return <Text style={styles.dayNone}>No weigh-in.</Text>;
  const before = points[i - 1];
  const diff = before ? round1(points[i].value - before.value) : 0;
  return (
    <>
      <View style={styles.bigRow}>
        <Text style={styles.big}>{points[i].value.toFixed(1)}</Text>
        <Text style={T.muted}>kg</Text>
      </View>
      {before ? (
        <Text style={T.muted}>
          <Text style={{ color: C.weight, fontWeight: '700' }}>
            {diff === 0 ? 'No change' : (diff > 0 ? '+' : '−') + Math.abs(diff).toFixed(1) + ' kg'}
          </Text>{' '}
          since {formatDay(before.date)}
        </Text>
      ) : null}
    </>
  );
}

function SleepDay({ date, today, value, goal }: { date: DateKey; today: DateKey; value: number | undefined; goal: number }) {
  if (value === undefined) return <Text style={styles.dayNone}>No sleep logged.</Text>;
  const c = sleepColor(sleepStatus(value, goal));
  const diff = value - goal;
  return (
    <>
      <View style={styles.bigRow}>
        <Text style={styles.big}>{formatDuration(value)}</Text>
      </View>
      <Text style={T.muted}>
        {nightLabel(date, today)} ·{' '}
        <Text style={{ color: c, fontWeight: '700' }}>
          {diff >= 0 ? 'goal reached' : `${formatDuration(-diff)} short of ${formatDuration(goal)}`}
        </Text>
      </Text>
    </>
  );
}

// ───────────────────────── Graph ─────────────────────────

function GraphView({ metric, color, today }: { metric: Metric; color: string; today: DateKey }) {
  const d = useData();
  const [range, setRange] = useState<Range>('1M');
  const [exId, setExId] = useState<string | null>(null);
  const [measure, setMeasure] = useState<'weight' | 'strength'>('weight');
  const [picking, setPicking] = useState(false);

  // Every exercise that has been logged (current name if it still exists, else the name it was logged under).
  const exercises = useMemo(() => {
    const m = new Map<string, { name: string; kind: ExerciseKind; unit: CardioMetric }>();
    for (const w of d.workouts) {
      for (const s of w.sets) m.set(s.exerciseId, { name: s.exerciseName || 'Exercise', kind: s.kind ?? 'strength', unit: s.metric ?? 'W' });
    }
    for (const sess of d.sessions) {
      for (const e of sess.exercises) {
        // Each option of an exercise (e.g. single-arm) has its own history, under its own current name.
        for (const op of optionsOf(e)) {
          if (m.has(op.id)) m.set(op.id, { name: op.name || 'Exercise', kind: e.kind ?? 'strength', unit: e.metric ?? 'W' });
        }
      }
    }
    return [...m.entries()].map(([id, v]) => ({ id, ...v }));
  }, [d.workouts, d.sessions]);
  const ex = exercises.find((e) => e.id === exId) ?? exercises[0];
  const cardio = ex?.kind === 'cardio'; // minutes and (say) watts instead of kg and reps

  // The best set of that exercise on each day it was done.
  const tops = useMemo(() => {
    if (!ex) return [];
    const out: { date: DateKey; weight: number; reps: number }[] = [];
    const days = [...d.workoutsByDay.keys()].sort();
    for (const date of days) {
      const sets = (d.workoutsByDay.get(date) ?? []).flatMap((w) => w.sets).filter((s) => s.exerciseId === ex.id);
      const best =
        measure === 'weight'
          ? topSet(sets)
          : sets.slice().sort((a, b) => (cardio ? b.reps - a.reps : e1rm(b) - e1rm(a)))[0];
      if (best) out.push({ date, weight: best.weight, reps: best.reps });
    }
    return out;
  }, [ex, cardio, d.workoutsByDay, measure]);

  let points: Point[] = [];
  let bars: Bar[] | undefined;
  let line: Point[] | undefined;
  let dots: Point[] | undefined;
  let goal: number | undefined;
  let format: ((v: number) => string) | undefined;
  let faintDots = false;

  if (metric === 'overload') {
    points = tops.map((t) => ({
      date: t.date,
      value: measure === 'weight' ? t.weight : cardio ? t.reps : Math.round(e1rm(t) * 10) / 10,
    }));
    line = points;
    dots = points;
  } else if (metric === 'nutrition') {
    points = [...d.foodByDay.entries()]
      .filter(([, m]) => m.kcal > 0)
      .map(([date, m]) => ({ date, value: m.kcal }))
      .sort((a, b) => a.date.localeCompare(b.date));
    bars = points.map((p) => ({ ...p, color: nutritionColor(p.value, d.goals.kcal) }));
    goal = d.goals.kcal;
    format = (v) => thousands(v);
  } else if (metric === 'weight') {
    points = d.weightPoints;
    dots = points;
    line = trend(points);
    faintDots = true;
  } else {
    points = d.sleepPoints.map((p) => ({ date: p.date, value: Math.round((p.value / 60) * 100) / 100 }));
    bars = d.sleepPoints.map((p, i) => ({ ...points[i], color: sleepColor(sleepStatus(p.value, d.sleepGoal)) }));
    goal = d.sleepGoal / 60;
    format = (v) => v + ' h';
  }

  const from = range === 'All' ? (points[0] && points[0].date < addDays(today, -14) ? points[0].date : addDays(today, -14)) : addDays(today, -RANGE_DAYS[range]);
  const shown = points.filter((p) => p.date >= from && p.date <= today);

  // One line that says what the graph shows.
  let summary = '';
  if (shown.length > 0) {
    const first = shown[0].value;
    const last = shown[shown.length - 1].value;
    if (metric === 'overload') {
      const a = tops.find((t) => t.date === shown[0].date)!;
      const b = tops.find((t) => t.date === shown[shown.length - 1].date)!;
      summary =
        shown.length === 1
          ? `Best: ${setLabel(b, ex?.kind, ex?.unit)}`
          : `Best: ${setLabel(a, ex?.kind, ex?.unit)}  →  ${setLabel(b, ex?.kind, ex?.unit)}`;
    } else if (metric === 'nutrition') {
      const hit = shown.filter((p) => dayStatus(p.value, d.goals.kcal) === 'hit').length;
      summary = `Average ${thousands(average(shown.map((p) => p.value)) ?? 0)} kcal · goal reached on ${hit} of ${shown.length} logged days`;
    } else if (metric === 'weight') {
      const diff = round1(last - first);
      summary = shown.length === 1 ? `${first.toFixed(1)} kg` : `${first.toFixed(1)} kg  →  ${last.toFixed(1)} kg  (${diff === 0 ? 'no change' : (diff > 0 ? '+' : '−') + Math.abs(diff).toFixed(1) + ' kg'})`;
    } else {
      summary = `Average ${formatDuration(Math.round((average(shown.map((p) => p.value)) ?? 0) * 60))} over ${shown.length} ${shown.length === 1 ? 'night' : 'nights'}`;
    }
  }

  return (
    <>
      <View style={{ marginTop: 12 }}>
        <Segmented
          options={(['1M', '3M', '6M', '1Y', 'All'] as Range[]).map((r) => ({ key: r, label: r }))}
          value={range}
          onChange={setRange}
          color={color}
        />
      </View>

      {metric === 'overload' ? (
        exercises.length === 0 ? null : (
          <>
            <Pressable style={styles.exPick} onPress={() => setPicking(true)} accessibilityRole="button">
              <Text style={[T.body, { fontWeight: '700', flex: 1 }]} numberOfLines={1}>
                {ex?.name}
              </Text>
              <Text style={[T.small, { color: C.text, fontWeight: '600' }]}>Change exercise</Text>
            </Pressable>
            <View style={{ marginTop: 8 }}>
              <Segmented
                options={[
                  { key: 'weight', label: cardio ? 'Time' : 'Top weight' },
                  { key: 'strength', label: cardio ? (CARDIO_METRICS.find((m) => m.key === ex?.unit)?.label ?? 'Watts') : 'Strength' },
                ]}
                value={measure}
                onChange={setMeasure}
                color={color}
              />
            </View>
          </>
        )
      ) : null}

      <Card style={{ marginTop: 12, paddingHorizontal: 8 }}>
        <Chart from={from} to={today} bars={bars} line={line} dots={dots} goal={goal} color={color} format={format} faintDots={faintDots} />
      </Card>

      {summary ? <Text style={[T.body, { marginTop: 14, fontWeight: '600', lineHeight: 22 }]}>{summary}</Text> : null}
      <Text style={[T.small, { marginTop: 6, lineHeight: 18 }]}>
        {metric === 'overload'
          ? cardio
            ? measure === 'weight'
              ? 'The longest round of this cardio each time you did it, in minutes.'
              : 'The highest number (watts, distance, calories or level) of this cardio each time you did it.'
            : measure === 'weight'
            ? 'The heaviest set of this exercise each time you did it, in kg.'
            : 'Strength = weight and reps as one number (your estimated one-rep max, in kg), so more reps at the same weight shows as progress too.'
          : metric === 'nutrition'
            ? 'Calories each day. The dashed line is your goal. Green = reached, amber = under, red = over.'
            : metric === 'weight'
              ? 'The dots are your weigh-ins. The line smooths out day-to-day jumps so you see the real direction.'
              : 'Hours slept each night. The dashed line is your goal.'}
      </Text>

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Which exercise?">
        <ScrollView style={{ maxHeight: 380, marginTop: 8 }} showsVerticalScrollIndicator={false}>
          {exercises.map((e) => (
            <Pressable
              key={e.id}
              style={styles.exOption}
              onPress={() => {
                setExId(e.id);
                setPicking(false);
              }}
              accessibilityRole="button"
            >
              <Text style={[T.body, { fontWeight: e.id === ex?.id ? '800' : '500', color: e.id === ex?.id ? C.overload : C.text }]}>
                {e.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  modeSwitch: { flexDirection: 'row', borderRadius: 22, padding: 2, gap: 3 },
  modeThumb: { position: 'absolute', left: 2, top: 2, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)' },

  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 14 },
  monthName: { color: C.text, fontSize: 28, fontWeight: '700', letterSpacing: 0.3 },
  weekdays: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', color: C.muted, fontSize: 13, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekLine: { width: '100%', height: StyleSheet.hairlineWidth, backgroundColor: C.line },
  cell: { width: `${100 / 7}%`, height: 70, alignItems: 'center', paddingTop: 5 },
  numWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 19, fontWeight: '400', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  markArea: { height: 28, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  disc: { width: 18, height: 18, borderRadius: 9 },
  subText: { fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  subDot: { width: 6, height: 6, borderRadius: 3 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, rowGap: 6, marginTop: 14, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },

  dayNone: { color: C.muted, fontSize: 16, marginTop: 8 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  big: { color: C.text, fontSize: 34, fontWeight: '700', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, rowGap: 4, marginTop: 10 },
  macro: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  exLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },

  exPick: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  exOption: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
});
