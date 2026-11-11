// Sleep: how long you slept each night, typed in with the wheel, against a goal.

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Ring } from '../components/Ring';
import { WheelColumn, WheelRow, range } from '../components/Wheel';
import {
  Card,
  Group,
  Row,
  SectionTitle,
  DateStepper,
  Empty,
  GhostButton,
  PrimaryButton,
  Screen,
  Sheet,
  buzz,
  confirmAction,
} from '../components/ui';
import { average, formatDuration, sleepStatus, toPoints, type SleepStatus } from '../lib/body';
import { addDays, formatDay, relativeDay, type DateKey } from '../lib/dates';
import { useBody } from '../store/body';
import { useToday } from '../store/hooks';
import { C, T } from '../theme';

export function sleepColor(s: SleepStatus): string {
  return s === 'hit' ? C.up : s === 'near' ? C.same : C.down;
}

// Nights are filed under the morning you woke up.
export function nightLabel(date: DateKey, today: DateKey): string {
  return date === today ? 'Last night' : 'Night before ' + formatDay(date);
}

export const SleepScreen = React.memo(function SleepScreen() {
  const today = useToday();
  const sleep = useBody((s) => s.sleep);
  const goal = useBody((s) => s.sleepGoalMin);
  const points = useMemo(() => toPoints(sleep), [sleep]);
  const [sheet, setSheet] = useState<DateKey | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);

  const lastNight = sleep[today];
  const week = points.filter((p) => p.date > addDays(today, -7) && p.date <= today).map((p) => p.value);
  const weekAvg = average(week);

  return (
    <Screen
      title="Sleep"
      glow={C.sleep}
      footer={
        <PrimaryButton
          label={lastNight === undefined ? 'Log last night’s sleep' : 'Change last night’s sleep'}
          icon={lastNight === undefined ? 'add' : 'create-outline'}
          color={C.sleep}
          onPress={() => setSheet(today)}
        />
      }
    >
      <Card style={{ alignItems: 'center', marginTop: 6, paddingTop: 20 }}>
        <Ring size={200} stroke={20} progress={lastNight === undefined ? 0 : lastNight / goal} color={C.sleep}>
          <Text style={T.label}>Last night</Text>
          <Text style={styles.big}>{lastNight === undefined ? '–' : formatDuration(lastNight)}</Text>
          <Text style={T.muted}>{lastNight === undefined ? 'not logged yet' : `of ${formatDuration(goal)}`}</Text>
        </Ring>
        <View style={styles.stats}>
          <Pressable onPress={() => setGoalOpen(true)} style={styles.stat} accessibilityRole="button">
            <Text style={T.label}>Goal</Text>
            <Text style={styles.statValue}>{formatDuration(goal)}</Text>
            <Text style={[T.small, { color: C.sleep, fontWeight: '700' }]}>Change</Text>
          </Pressable>
          <View style={styles.stat}>
            <Text style={T.label}>7-day average</Text>
            <Text style={styles.statValue}>{weekAvg === null ? '–' : formatDuration(Math.round(weekAvg))}</Text>
            <Text style={T.small}>
              {week.length} {week.length === 1 ? 'night' : 'nights'} logged
            </Text>
          </View>
        </View>
      </Card>

      <SectionTitle>History</SectionTitle>
      {points.length === 0 ? (
        <Empty icon="moon-outline" title="No sleep logged yet" text="Each morning, tap the button below and put in how long you slept." />
      ) : (
        <Group>{points
          .slice()
          .reverse()
          .slice(0, 90)
          .map((p, i, arr) => (
            <Row key={p.date} onPress={() => setSheet(p.date)} last={i === arr.length - 1} chevron>
              <View style={[styles.dot, { backgroundColor: sleepColor(sleepStatus(p.value, goal)) }]} />
              <Text style={[T.body, { flex: 1 }]}>{nightLabel(p.date, today)}</Text>
              <Text style={styles.rowValue}>{formatDuration(p.value)}</Text>
              </Row>
          ))}</Group>
      )}

      <GhostButton
        label="Add a night you missed"
        icon="calendar-outline"
        color={C.sleep}
        outlined={false}
        onPress={() => setSheet(addDays(today, -1))}
        style={{ marginTop: 10 }}
      />

      {sheet ? <SleepSheet startDate={sheet} today={today} onClose={() => setSheet(null)} /> : null}
      {goalOpen ? <GoalSheet onClose={() => setGoalOpen(false)} /> : null}
    </Screen>
  );
});

const HOURS = range(0, 16);
const FIVES = range(0, 55, 5);
const two = (v: number) => (v < 10 ? '0' + v : String(v));

function split(min: number): { h: number; m: number } {
  const rounded = Math.round(min / 5) * 5;
  return { h: Math.min(16, Math.floor(rounded / 60)), m: rounded % 60 };
}

function SleepSheet({ startDate, today, onClose }: { startDate: DateKey; today: DateKey; onClose: () => void }) {
  const sleep = useBody((s) => s.sleep);
  const goal = useBody((s) => s.sleepGoalMin);
  const setSleep = useBody((s) => s.setSleep);
  const [date, setDate] = useState(startDate);
  const existing = sleep[date];
  const start = split(existing ?? goal);
  const [h, setH] = useState(start.h);
  const [m, setM] = useState(start.m);
  useEffect(() => {
    if (existing === undefined) return;
    const s = split(existing);
    setH(s.h);
    setM(s.m);
  }, [date, existing]);

  return (
    <Sheet visible onClose={onClose} title="Sleep">
      <View style={{ marginTop: 12 }}>
        <DateStepper
          label={nightLabel(date, today)}
          onPrev={() => setDate(addDays(date, -1))}
          onNext={() => setDate(addDays(date, 1))}
          nextDisabled={date >= today}
        />
      </View>
      <WheelRow>
        <WheelColumn label="Hours" values={HOURS} value={h} onChange={setH} />
        <WheelColumn label="Minutes" values={FIVES} value={m} onChange={setM} format={two} />
      </WheelRow>
      <PrimaryButton
        label={existing === undefined ? 'Save' : 'Save change'}
        color={C.sleep}
        disabled={h * 60 + m === 0}
        onPress={() => {
          buzz('done');
          setSleep(date, h * 60 + m);
          onClose();
        }}
      />
      {existing !== undefined ? (
        <GhostButton
          label="Delete this entry"
          icon="trash-outline"
          color={C.down}
          outlined={false}
          onPress={() =>
            confirmAction('Delete this night?', `${nightLabel(date, today)}: ${formatDuration(existing)}`, 'Delete', () => {
              setSleep(date, null);
              onClose();
            })
          }
          style={{ marginTop: 6 }}
        />
      ) : null}
    </Sheet>
  );
}

const GOAL_HOURS = range(4, 12);
const QUARTERS = [0, 15, 30, 45];

function GoalSheet({ onClose }: { onClose: () => void }) {
  const goal = useBody((s) => s.sleepGoalMin);
  const setGoal = useBody((s) => s.setSleepGoal);
  const [h, setH] = useState(Math.max(4, Math.min(12, Math.floor(goal / 60))));
  const [m, setM] = useState(QUARTERS.includes(goal % 60) ? goal % 60 : 0);
  return (
    <Sheet visible onClose={onClose} title="Sleep goal" subtitle="How long you aim to sleep each night.">
      <WheelRow>
        <WheelColumn label="Hours" values={GOAL_HOURS} value={h} onChange={setH} />
        <WheelColumn label="Minutes" values={QUARTERS} value={m} onChange={setM} format={two} />
      </WheelRow>
      <PrimaryButton
        label="Save goal"
        color={C.sleep}
        onPress={() => {
          setGoal(h * 60 + m);
          onClose();
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  big: { color: C.text, fontSize: 34, fontWeight: '700', letterSpacing: -0.5, marginVertical: 2, fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 20, gap: 10 },
  stat: { flex: 1, backgroundColor: C.card2, borderRadius: 14, padding: 12 },
  statValue: { color: C.text, fontSize: 20, fontWeight: '700', marginTop: 4, marginBottom: 2, fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowValue: { color: C.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
