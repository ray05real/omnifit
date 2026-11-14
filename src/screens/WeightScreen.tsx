// Weight: one entry a day, typed in with the wheel. In the owner's "with scale" version (variant.json) it can
// also come straight from their Bluetooth scale.

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Chart } from '../components/Chart';
import { WheelColumn, WheelRow, range } from '../components/Wheel';
import {
  Card,
  Group,
  Row,
  SectionTitle,
  DateStepper,
  Empty,
  GhostButton,
  IconButton,
  PrimaryButton,
  Screen,
  Sheet,
  buzz,
  confirmAction,
} from '../components/ui';
import { toPoints, trend } from '../lib/body';
import { addDays, formatDay, relativeDay, type DateKey } from '../lib/dates';
import { useBody } from '../store/body';
import { useToday } from '../store/hooks';
import { C, T } from '../theme';
import variant from '../../variant.json';
import { ScaleSheet } from './ScaleSheet';

const kg = (v: number) => v.toFixed(1);

function delta(now: number, before: number): string {
  const d = Math.round((now - before) * 10) / 10;
  if (d === 0) return 'no change';
  return (d > 0 ? '+' : '−') + Math.abs(d).toFixed(1) + ' kg';
}

export const WeightScreen = React.memo(function WeightScreen() {
  const today = useToday();
  const weights = useBody((s) => s.weights);
  const points = useMemo(() => toPoints(weights), [weights]);
  const smooth = useMemo(() => trend(points), [points]);
  const [sheet, setSheet] = useState<DateKey | null>(null);
  const [weighing, setWeighing] = useState(false);

  const latest = points[points.length - 1];
  const before = points[points.length - 2];
  const hasToday = weights[today] !== undefined;

  return (
    <Screen
      title="Weight"
      glow={C.glowWeight}
      right={
        variant.scale ? (
          <IconButton icon="bluetooth" label="Weigh with my scale" filled onPress={() => setWeighing(true)} />
        ) : undefined
      }
      fab={{ icon: 'add', label: hasToday ? 'Change today’s weight' : 'Log today’s weight', onPress: () => setSheet(today) }}
    >
      {!latest ? (
        <Empty icon="scale-outline" title="No weight logged yet" text="Weigh yourself and tap +. Same time each day works best." />
      ) : (
        <>
          <Card style={{ marginTop: 6 }}>
            <Text style={T.label}>{relativeDay(latest.date, today)}</Text>
            <View style={styles.bigRow}>
              <Text style={styles.big}>{kg(latest.value)}</Text>
              <Text style={styles.bigUnit}>kg</Text>
            </View>
            {before ? (
              <Text style={T.muted}>
                <Text style={{ color: C.weight, fontWeight: '700' }}>{delta(latest.value, before.value)}</Text> since{' '}
                {relativeDay(before.date, today).toLowerCase() === 'yesterday' ? 'yesterday' : formatDay(before.date)}
              </Text>
            ) : (
              <Text style={T.muted}>Your first entry. The change shows from the next one.</Text>
            )}
          </Card>

          {points.length > 1 ? (
            <Card style={{ marginTop: 10, paddingHorizontal: 8 }}>
              <Text style={[T.label, { marginLeft: 8, marginBottom: 6 }]}>Last 30 days</Text>
              <Chart
                from={addDays(today, -30)}
                to={today}
                dots={points}
                line={smooth}
                faintDots
                color={C.weight}
                height={170}
                format={(v) => String(Math.round(v * 10) / 10)}
              />
            </Card>
          ) : null}

          <SectionTitle>History</SectionTitle>
          <Group>
          {points
            .slice()
            .reverse()
            .slice(0, 90)
            .map((p, i, arr) => {
              const older = arr[i + 1];
              return (
                <Row key={p.date} onPress={() => setSheet(p.date)} last={i === arr.length - 1} chevron>
                  <Text style={[T.body, { flex: 1 }]}>{relativeDay(p.date, today)}</Text>
                  {older ? <Text style={[T.small, T.num, { marginRight: 12 }]}>{delta(p.value, older.value)}</Text> : null}
                  <Text style={styles.rowValue}>{kg(p.value)} kg</Text>
                  </Row>
              );
            })}
          </Group>
        </>
      )}

      <GhostButton
        label="Add a day you missed"
        icon="calendar-outline"
        color={C.weight}
        outlined={false}
        onPress={() => setSheet(addDays(today, -1))}
        style={{ marginTop: 10 }}
      />

      {variant.scale ? (
        <GhostButton
          label="Weigh with my scale"
          icon="bluetooth"
          onPress={() => setWeighing(true)}
          style={{ marginTop: 10 }}
        />
      ) : null}

      {weighing ? <ScaleSheet today={today} onClose={() => setWeighing(false)} /> : null}
      {sheet ? <WeightSheet startDate={sheet} today={today} onClose={() => setSheet(null)} /> : null}
    </Screen>
  );
});

const WHOLE = range(30, 250);
const TENTHS = range(0, 9);

function WeightSheet({ startDate, today, onClose }: { startDate: DateKey; today: DateKey; onClose: () => void }) {
  const weights = useBody((s) => s.weights);
  const setWeight = useBody((s) => s.setWeight);
  const [date, setDate] = useState(startDate);

  // Start the wheel on that day's weight, or else the most recent one.
  const fallback = useMemo(() => {
    const pts = toPoints(weights);
    return pts.length ? pts[pts.length - 1].value : 75;
  }, [weights]);
  const existing = weights[date];
  const startTenths = Math.round((existing ?? fallback) * 10);
  const [whole, setWhole] = useState(Math.floor(startTenths / 10));
  const [tenth, setTenth] = useState(startTenths % 10);
  useEffect(() => {
    if (existing === undefined) return;
    const tenths = Math.round(existing * 10);
    setWhole(Math.floor(tenths / 10));
    setTenth(tenths % 10);
  }, [date, existing]);

  return (
    <Sheet visible onClose={onClose} title="Body weight">
      <View style={{ marginTop: 12 }}>
        <DateStepper
          label={relativeDay(date, today)}
          onPrev={() => setDate(addDays(date, -1))}
          onNext={() => setDate(addDays(date, 1))}
          nextDisabled={date >= today}
        />
      </View>
      <WheelRow>
        <WheelColumn label="kg" values={WHOLE} value={Math.max(30, Math.min(250, whole))} onChange={setWhole} flex={1.3} />
        <WheelColumn label="+" values={TENTHS} value={tenth} onChange={setTenth} format={(v) => '.' + v} />
      </WheelRow>
      <PrimaryButton
        label={existing === undefined ? 'Save' : 'Save change'}
        color={C.weight}
        onPress={() => {
          buzz('done');
          setWeight(date, whole + tenth / 10);
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
            confirmAction('Delete this weight?', `${relativeDay(date, today)}: ${kg(existing)} kg`, 'Delete', () => {
              setWeight(date, null);
              onClose();
            })
          }
          style={{ marginTop: 6 }}
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4, marginBottom: 2 },
  big: { color: C.text, fontSize: 60, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  bigUnit: { color: C.muted, fontSize: 22, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  rowValue: { color: C.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
