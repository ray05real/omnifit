// Nutrition: the day's ring against the calorie goal, the three macros, and the food log by time.
// The date bar sits above the card; in the card the calorie ring is on the left and the three macro rings are
// stacked on its right (the owner's layout: full-size rings, less height).

import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Ring } from '../components/Ring';
import { TimeWheels } from '../components/Wheel';
import {
  Card,
  DateStepper,
  Empty,
  Field,
  GhostButton,
  Group,
  IconButton,
  PrimaryButton,
  Row,
  Screen,
  SectionTitle,
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
import { C, PAD, T } from '../theme';
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
  // Green once the goal is reached, red if well over, white on the way there.
  const ringColor = status === 'over' ? C.down : status === 'hit' ? C.up : C.text;
  const left = goals.kcal - total.kcal;
  const leftText = status === 'over' ? `${thousands(-left)} over` : left <= 0 ? 'Goal reached' : `${thousands(left)} left`;
  const dayName = relativeDay(day, today);
  const label = dayName === formatDay(day) ? dayName : `${dayName} · ${formatDay(day)}`;

  const move = (n: number) => {
    const next = addDays(day, n);
    setPicked(next === today ? null : next);
  };

  return (
    <Screen
      title="Nutrition"
      glow={C.glowNutrition}
      right={<IconButton icon="options-outline" label="Daily goals" filled onPress={() => setGoalsOpen(true)} />}
      fab={{
        icon: 'add',
        label: 'Log food',
        onPress: () => {
          setAddKey((k) => k + 1);
          setAdding(true);
        },
      }}
    >
      <DateStepper label={label} onPrev={() => move(-1)} onNext={() => move(1)} onPressLabel={picked ? () => setPicked(null) : undefined} />

      <Card style={styles.dayCard}>
        <Ring size={210} stroke={22} progress={total.kcal / goals.kcal} color={ringColor}>
          <Text style={styles.bigNum}>{thousands(total.kcal)}</Text>
          <Text style={T.muted}>of {thousands(goals.kcal)} kcal</Text>
          <Text style={[styles.leftText, { color: status === 'none' ? C.muted : ringColor }]}>{leftText}</Text>
        </Ring>
        <View style={styles.macros}>
          <MacroRing label="Protein" value={total.protein} goal={goals.protein} />
          <MacroRing label="Carbs" value={total.carbs} goal={goals.carbs} />
          <MacroRing label="Fat" value={total.fat} goal={goals.fat} />
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
        <Empty icon="restaurant-outline" title="Nothing logged" text="Tap + to add what you ate or drank." />
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
      {editing ? <EntryEditor key={editing.id} entry={editing} onClose={() => setEditing(null)} /> : null}
      {goalsOpen ? <GoalsSheet onClose={() => setGoalsOpen(false)} /> : null}
    </Screen>
  );
});

// One macro: its ring (the size it always was) with the numbers underneath.
function MacroRing({ label, value, goal }: { label: string; value: number; goal: number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Ring size={66} stroke={9} progress={goal > 0 ? value / goal : 0} color={goal > 0 && value >= goal * 0.95 ? C.up : C.text}>
        <Text style={styles.macroPct}>{goal > 0 ? Math.round((value / goal) * 100) : 0}%</Text>
      </Ring>
      <Text style={[T.small, { marginTop: 5, color: C.text, fontWeight: '600' }]}>{label}</Text>
      <Text style={[T.small, T.num]}>
        <Text style={{ color: C.text, fontWeight: '600' }}>{Math.round(value)}</Text> / {Math.round(goal)} g
      </Text>
    </View>
  );
}

// ───────────────────────── Edit something already logged: everything in one place ─────────────────────────

function EntryEditor({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const updateEntry = useNutrition((s) => s.updateEntry);
  const deleteEntry = useNutrition((s) => s.deleteEntry);
  const [name, setName] = useState(entry.name);
  const [time, setTime] = useState(entry.time);
  const [timeOpen, setTimeOpen] = useState(false);
  const [amount, setAmount] = useState(entry.amount ? String(round1(entry.amount)) : '');
  const [kcal, setKcal] = useState(String(Math.round(entry.kcal)));
  const [protein, setProtein] = useState(String(round1(entry.protein)));
  const [carbs, setCarbs] = useState(String(round1(entry.carbs)));
  const [fat, setFat] = useState(String(round1(entry.fat)));

  // A new amount scales the calories and macros in proportion; they can still be typed over afterwards.
  const changeAmount = (text: string) => {
    setAmount(text);
    const n = parseNum(text);
    if (!entry.amount || n <= 0) return;
    const f = n / entry.amount;
    setKcal(String(Math.round(entry.kcal * f)));
    setProtein(String(round1(entry.protein * f)));
    setCarbs(String(round1(entry.carbs * f)));
    setFat(String(round1(entry.fat * f)));
  };

  const save = () => {
    buzz('done');
    updateEntry(entry.id, {
      name: name.trim() || entry.name,
      time,
      kcal: Math.round(parseNum(kcal)),
      protein: parseNum(protein),
      carbs: parseNum(carbs),
      fat: parseNum(fat),
      ...(entry.amount ? { amount: parseNum(amount) || entry.amount } : {}),
    });
    onClose();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.editorPage} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.editorInner, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.editorHead}>
            <View style={{ width: 44 }} />
            <Text style={[T.h2, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>
              Edit food
            </Text>
            <IconButton icon="close" label="Close" filled onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Field label="Name" value={name} onChangeText={setName} maxLength={60} />
            {entry.amount && entry.unit ? (
              <Field
                label="Amount"
                value={amount}
                onChangeText={changeAmount}
                keyboardType="decimal-pad"
                suffix={entry.unit === 'serving' ? 'servings' : entry.unit}
                selectTextOnFocus
              />
            ) : null}
            <Field label="Calories" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" suffix="kcal" selectTextOnFocus />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field label="Protein" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" suffix="g" containerStyle={{ flex: 1 }} selectTextOnFocus />
              <Field label="Carbs" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" suffix="g" containerStyle={{ flex: 1 }} selectTextOnFocus />
              <Field label="Fat" value={fat} onChangeText={setFat} keyboardType="decimal-pad" suffix="g" containerStyle={{ flex: 1 }} selectTextOnFocus />
            </View>

            <Pressable onPress={() => setTimeOpen(!timeOpen)} style={styles.timeRow} accessibilityRole="button">
              <Ionicons name="time-outline" size={19} color={C.muted} />
              <Text style={T.body}>
                Time <Text style={{ fontWeight: '700' }}>{time}</Text>
              </Text>
              <Text style={[T.muted, { marginLeft: 'auto', color: C.text, fontWeight: '600' }]}>{timeOpen ? 'Done' : 'Change'}</Text>
            </Pressable>
            {timeOpen ? <TimeWheels time={time} onChange={setTime} /> : null}

            <PrimaryButton label="Save" onPress={save} disabled={parseNum(kcal) <= 0 && macroKcal({ protein: parseNum(protein), carbs: parseNum(carbs), fat: parseNum(fat) }) <= 0} style={{ marginTop: 20 }} />
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
              style={{ marginTop: 8 }}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
      <Text style={[T.small, { marginTop: 12, color: C.muted }]}>
        Those macros add up to {thousands(fromMacros)} kcal
        {off ? `, not ${thousands(g.kcal)}. That's fine if you mean it.` : '.'}
      </Text>
      <PrimaryButton
        label="Save goals"
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
  dayCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingVertical: 14, paddingLeft: 12, paddingRight: 12 },
  bigNum: { color: C.text, fontSize: 46, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  leftText: { fontSize: 14, fontWeight: '700', marginTop: 6 },
  macros: { flex: 1, alignItems: 'center', gap: 10 },
  macroPct: { color: C.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 16,
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: C.fill,
  },
  time: { width: 48, color: C.muted, fontSize: 15, fontVariant: ['tabular-nums'] },
  entryKcal: { color: C.text, fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },

  editorPage: { flex: 1, backgroundColor: C.cardSolid },
  editorInner: { flex: 1, width: '100%', maxWidth: 500, alignSelf: 'center', paddingHorizontal: PAD + 4, paddingTop: 14 },
  editorHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.card2,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    height: 50,
    marginTop: 16,
  },
});
