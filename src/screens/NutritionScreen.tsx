// Nutrition: the day's ring against the calorie goal, the three macros, and the food log by time.

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Ring } from '../components/Ring';
import { TimeWheels } from '../components/Wheel';
import {
  Card,
  Group,
  Row,
  SectionTitle,
  DateStepper,
  Empty,
  Field,
  GhostButton,
  IconButton,
  PrimaryButton,
  Screen,
  Sheet,
  buzz,
  confirmAction,
} from '../components/ui';
import { addDays, formatDay, relativeDay, type DateKey } from '../lib/dates';
import {
  amountLabel,
  dayStatus,
  macroKcal,
  parseNum,
  round1,
  sum,
  thousands,
  type FoodEntry,
  type Macros,
} from '../lib/nutrition';
import { useToday } from '../store/hooks';
import { useNutrition } from '../store/nutrition';
import { C, T } from '../theme';
import { AddFoodModal } from './AddFoodModal';

export const NutritionScreen = React.memo(function NutritionScreen() {
  const today = useToday();
  const [picked, setPicked] = useState<DateKey | null>(null); // null = today, whatever day that is
  const day = picked ?? today;

  const goals = useNutrition((s) => s.goals);
  const goalsSet = useNutrition((s) => s.goalsSet);
  const entries = useNutrition((s) => s.entries);

  const dayEntries = useMemo(
    () => entries.filter((e) => e.date === day).sort((a, b) => a.time.localeCompare(b.time)),
    [entries, day],
  );
  const total = useMemo(() => sum(dayEntries), [dayEntries]);

  const [adding, setAdding] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);

  const status = dayStatus(total.kcal, goals.kcal);
  const ringColor = status === 'over' ? C.down : C.nutrition;
  const left = goals.kcal - total.kcal;
  const leftText =
    status === 'over'
      ? `${thousands(-left)} over`
      : left <= 0
        ? 'Goal reached'
        : `${thousands(left)} left`;

  const move = (n: number) => {
    const next = addDays(day, n);
    setPicked(next === today ? null : next);
  };
  const dayName = relativeDay(day, today);
  const label = dayName === formatDay(day) ? dayName : `${dayName} · ${formatDay(day)}`;

  return (
    <Screen
      title="Nutrition"
      glow={C.nutrition}
      right={<IconButton icon="options-outline" label="Daily goals" filled onPress={() => setGoalsOpen(true)} />}
      footer={
        <PrimaryButton
          label="Log food"
          icon="add"
          color={C.nutrition}
          onPress={() => {
            setAddKey((k) => k + 1);
            setAdding(true);
          }}
        />
      }
    >
      <DateStepper
        label={label}
        onPrev={() => move(-1)}
        onNext={() => move(1)}
        onPressLabel={picked ? () => setPicked(null) : undefined}
      />

      <Card style={{ alignItems: 'center', marginTop: 14, paddingTop: 20 }}>
        <Ring size={210} stroke={22} progress={total.kcal / goals.kcal} color={ringColor}>
          <Text style={styles.bigNum}>{thousands(total.kcal)}</Text>
          <Text style={T.muted}>of {thousands(goals.kcal)} kcal</Text>
          <Text style={[styles.leftText, { color: status === 'none' ? C.muted : ringColor }]}>{leftText}</Text>
        </Ring>
        <View style={styles.macros}>
          <MacroRing label="Protein" value={total.protein} goal={goals.protein} color={C.protein} />
          <MacroRing label="Carbs" value={total.carbs} goal={goals.carbs} color={C.carbs} />
          <MacroRing label="Fat" value={total.fat} goal={goals.fat} color={C.fat} />
        </View>
      </Card>

      {!goalsSet ? (
        <Pressable onPress={() => setGoalsOpen(true)} style={styles.banner} accessibilityRole="button">
          <View style={{ flex: 1 }}>
            <Text style={[T.body, { fontWeight: '700' }]}>Set your daily goals</Text>
            <Text style={[T.muted, { marginTop: 2 }]}>These are placeholders. Tap to put in your own calories and macros.</Text>
          </View>
        </Pressable>
      ) : null}

      <SectionTitle>Food log</SectionTitle>
      {dayEntries.length === 0 ? (
        <Empty icon="restaurant-outline" title="Nothing logged" text="Tap Log food to add what you ate or drank." />
      ) : (
        <Group>
          {dayEntries.map((e, i) => (
            <Row key={e.id} onPress={() => setEditing(e)} last={i === dayEntries.length - 1}>
              <Text style={styles.time}>{e.time}</Text>
              <View style={{ flex: 1 }}>
                <Text style={T.body} numberOfLines={1}>
                  {e.name}
                </Text>
                <Text style={[T.small, { marginTop: 2 }]} numberOfLines={1}>
                  {e.amount && e.unit ? amountLabel(e.amount, e.unit) + ' · ' : ''}P {round1(e.protein)} · C{' '}
                  {round1(e.carbs)} · F {round1(e.fat)}
                </Text>
              </View>
              <Text style={styles.entryKcal}>{thousands(e.kcal)}</Text>
              <Text style={T.small}>kcal</Text>
            </Row>
          ))}
        </Group>
      )}

      <AddFoodModal key={addKey} visible={adding} date={day} onClose={() => setAdding(false)} />
      {editing ? <EntrySheet key={editing.id} entry={editing} onClose={() => setEditing(null)} /> : null}
      {goalsOpen ? <GoalsSheet onClose={() => setGoalsOpen(false)} /> : null}
    </Screen>
  );
});

function MacroRing({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Ring size={66} stroke={9} progress={goal > 0 ? value / goal : 0} color={color}>
        <Text style={styles.macroPct}>{goal > 0 ? Math.round((value / goal) * 100) : 0}%</Text>
      </Ring>
      <Text style={[T.small, { marginTop: 8, color, fontWeight: '700' }]}>{label}</Text>
      <Text style={[T.small, T.num, { marginTop: 1 }]}>
        <Text style={{ color: C.text, fontWeight: '700' }}>{Math.round(value)}</Text> / {Math.round(goal)} g
      </Text>
    </View>
  );
}

// ───────────────────────── Change or delete something already logged ─────────────────────────

function EntrySheet({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const updateEntry = useNutrition((s) => s.updateEntry);
  const deleteEntry = useNutrition((s) => s.deleteEntry);
  const [time, setTime] = useState(entry.time);
  const [amount, setAmount] = useState(entry.amount ? String(round1(entry.amount)) : '');

  // A new amount scales what was logged in proportion.
  const factor = entry.amount && parseNum(amount) > 0 ? parseNum(amount) / entry.amount : 1;
  const scaled: Macros = {
    kcal: Math.round(entry.kcal * factor),
    protein: round1(entry.protein * factor),
    carbs: round1(entry.carbs * factor),
    fat: round1(entry.fat * factor),
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={entry.name}
      subtitle={`${thousands(scaled.kcal)} kcal · P ${scaled.protein} · C ${scaled.carbs} · F ${scaled.fat}`}
    >
      {entry.amount && entry.unit ? (
        <Field
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          suffix={entry.unit === 'serving' ? 'servings' : entry.unit}
          selectTextOnFocus
        />
      ) : null}
      <TimeWheels time={time} onChange={setTime} />
      <PrimaryButton
        label="Save"
        color={C.nutrition}
        onPress={() => {
          updateEntry(entry.id, {
            time,
            ...(entry.amount ? { ...scaled, amount: parseNum(amount) || entry.amount } : {}),
          });
          onClose();
        }}
      />
      <GhostButton
        label="Delete from the log"
        icon="trash-outline"
        color={C.down}
        outlined={false}
        onPress={() =>
          confirmAction(`Delete ${entry.name}?`, 'It comes off this day’s log.', 'Delete', () => {
            deleteEntry(entry.id);
            onClose();
          })
        }
        style={{ marginTop: 6 }}
      />
    </Sheet>
  );
}

// ───────────────────────── Daily goals ─────────────────────────

function GoalsSheet({ onClose }: { onClose: () => void }) {
  const goals = useNutrition((s) => s.goals);
  const setGoals = useNutrition((s) => s.setGoals);
  const [kcal, setKcal] = useState(String(goals.kcal));
  const [protein, setProtein] = useState(String(goals.protein));
  const [carbs, setCarbs] = useState(String(goals.carbs));
  const [fat, setFat] = useState(String(goals.fat));

  const g: Macros = { kcal: Math.round(parseNum(kcal)), protein: parseNum(protein), carbs: parseNum(carbs), fat: parseNum(fat) };
  const fromMacros = macroKcal(g);
  const off = g.kcal > 0 && Math.abs(fromMacros - g.kcal) > g.kcal * 0.05;

  return (
    <Sheet visible onClose={onClose} title="Daily goals" subtitle="What you aim to eat each day.">
      <Field label="Calories" value={kcal} onChangeText={setKcal} keyboardType="number-pad" suffix="kcal" selectTextOnFocus />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Protein" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" suffix="g" containerStyle={{ flex: 1 }} selectTextOnFocus />
        <Field label="Carbs" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" suffix="g" containerStyle={{ flex: 1 }} selectTextOnFocus />
        <Field label="Fat" value={fat} onChangeText={setFat} keyboardType="decimal-pad" suffix="g" containerStyle={{ flex: 1 }} selectTextOnFocus />
      </View>
      <Text style={[T.small, { marginTop: 12, color: off ? C.same : C.muted }]}>
        Those macros add up to {thousands(fromMacros)} kcal
        {off ? `, not ${thousands(g.kcal)}. That's fine if you mean it.` : '.'}
      </Text>
      <PrimaryButton
        label="Save goals"
        color={C.nutrition}
        disabled={g.kcal <= 0}
        onPress={() => {
          buzz('done');
          setGoals(g);
          onClose();
        }}
        style={{ marginTop: 16 }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  bigNum: { color: C.text, fontSize: 46, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  leftText: { fontSize: 14, fontWeight: '700', marginTop: 6 },
  macros: { flexDirection: 'row', marginTop: 22, alignSelf: 'stretch' },
  macroPct: { color: C.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 16,
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(48,209,88,0.16)',
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  time: { width: 48, color: C.muted, fontSize: 15, fontVariant: ['tabular-nums'] },
  entryKcal: { color: C.text, fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
