// "Log food": pick from My foods (the owner's own catalogue), make a new food, or quick-add calories and macros.

import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { TimeWheels } from '../components/Wheel';
import {
  Card,
  Empty,
  Field,
  GhostButton,
  IconButton,
  PrimaryButton,
  Segmented,
  buzz,
  confirmAction,
} from '../components/ui';
import { nowTime, relativeDay, type DateKey } from '../lib/dates';
import {
  basis,
  basisLabel,
  macroKcal,
  parseNum,
  round1,
  scale,
  thousands,
  type Food,
  type FoodUnit,
  type Macros,
} from '../lib/nutrition';
import { ScanCamera, type ScanMode } from '../scan/ScanCamera';
import { barcodeLookup, scanAvailable, type PackValues } from '../scan/scan';
import { useToday } from '../store/hooks';
import { useNutrition } from '../store/nutrition';
import { C, PAD, T } from '../theme';

type View_ = { kind: 'home' } | { kind: 'amount'; food: Food } | { kind: 'form'; food: Food | null };

export function AddFoodModal({ visible, date, onClose }: { visible: boolean; date: DateKey; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const today = useToday();
  const foods = useNutrition((s) => s.foods);
  const addEntry = useNutrition((s) => s.addEntry);

  const [time, setTime] = useState(nowTime);
  const [timeOpen, setTimeOpen] = useState(false);
  const [tab, setTab] = useState<'mine' | 'quick'>('mine');
  const [view, setView] = useState<View_>({ kind: 'home' });
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return foods
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .sort((a, b) => b.lastUsed - a.lastUsed);
  }, [foods, query]);

  const log = (name: string, m: Macros, from?: { foodId: string; amount: number; unit: FoodUnit }) => {
    buzz('done');
    addEntry({ date, time, name, ...m, ...(from ?? {}) });
    onClose();
  };

  const title =
    view.kind === 'amount' ? view.food.name : view.kind === 'form' ? (view.food ? 'Edit food' : 'New food') : 'Log food';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.inner, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.head}>
            {view.kind === 'home' ? (
              <View style={{ width: 38 }} />
            ) : (
              <IconButton icon="chevron-back" label="Back" filled onPress={() => setView({ kind: 'home' })} />
            )}
            <Text style={[T.h2, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>
              {title}
            </Text>
            <IconButton icon="close" label="Close" filled onPress={onClose} />
          </View>

          {view.kind === 'home' ? (
            <>
              <Pressable onPress={() => setTimeOpen(!timeOpen)} style={styles.timeRow} accessibilityRole="button">
                <Ionicons name="time-outline" size={19} color={C.muted} />
                <Text style={T.body}>
                  {relativeDay(date, today)} at <Text style={{ fontWeight: '800' }}>{time}</Text>
                </Text>
                <Text style={[T.muted, { marginLeft: 'auto', color: C.nutrition, fontWeight: '700' }]}>
                  {timeOpen ? 'Done' : 'Change time'}
                </Text>
              </Pressable>
              {timeOpen ? <TimeWheels time={time} onChange={setTime} /> : null}

              <View style={{ marginTop: 12 }}>
                <Segmented
                  options={[
                    { key: 'mine', label: 'My foods' },
                    { key: 'quick', label: 'Quick add' },
                  ]}
                  value={tab}
                  onChange={setTab}
                  color={C.nutrition}
                />
              </View>

              {tab === 'mine' ? (
                <>
                  <View style={styles.search}>
                    <Ionicons name="search" size={18} color={C.faint} />
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Search my foods"
                      placeholderTextColor={C.faint}
                      keyboardAppearance="dark"
                      autoCorrect={false}
                      style={styles.searchInput}
                    />
                  </View>
                  <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    {shown.length === 0 ? (
                      <Empty
                        icon="nutrition-outline"
                        title={foods.length === 0 ? 'Your catalogue is empty' : 'No food by that name'}
                        text="Add a food once with its calories and macros, then reuse it whenever you eat it."
                      />
                    ) : (
                      shown.map((f) => (
                        <View key={f.id} style={styles.foodRow}>
                          <Pressable
                            style={({ pressed }) => [{ flex: 1, paddingVertical: 12 }, pressed && { opacity: 0.6 }]}
                            onPress={() => setView({ kind: 'amount', food: f })}
                            accessibilityRole="button"
                          >
                            <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>
                              {f.name}
                            </Text>
                            <Text style={[T.small, { marginTop: 2 }]} numberOfLines={1}>
                              {basisLabel(f.unit)} · {thousands(f.kcal)} kcal · P {round1(f.protein)} · C{' '}
                              {round1(f.carbs)} · F {round1(f.fat)}
                            </Text>
                          </Pressable>
                          <IconButton
                            icon="create-outline"
                            size={20}
                            color={C.muted}
                            label={`Edit ${f.name}`}
                            onPress={() => setView({ kind: 'form', food: f })}
                          />
                        </View>
                      ))
                    )}
                  </ScrollView>
                  <GhostButton
                    label="New food"
                    icon="add"
                    color={C.nutrition}
                    onPress={() => setView({ kind: 'form', food: null })}
                    style={{ marginTop: 8 }}
                  />
                </>
              ) : (
                <QuickAdd onLog={log} />
              )}
            </>
          ) : view.kind === 'amount' ? (
            <AmountView food={view.food} onLog={log} />
          ) : (
            <FoodForm
              food={view.food}
              onSaved={(food, isNew) => setView(isNew ? { kind: 'amount', food } : { kind: 'home' })}
              onDeleted={() => setView({ kind: 'home' })}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MacroLine({ m }: { m: Macros }) {
  return (
    <View style={styles.macroLine}>
      <Text style={styles.kcal}>{thousands(m.kcal)}</Text>
      <Text style={[T.muted, { marginRight: 'auto' }]}>kcal</Text>
      <Text style={[styles.macro, { color: C.protein }]}>P {round1(m.protein)}</Text>
      <Text style={[styles.macro, { color: C.carbs }]}>C {round1(m.carbs)}</Text>
      <Text style={[styles.macro, { color: C.fat }]}>F {round1(m.fat)}</Text>
    </View>
  );
}

// How much of a food from the catalogue.
function AmountView({
  food,
  onLog,
}: {
  food: Food;
  onLog: (name: string, m: Macros, from: { foodId: string; amount: number; unit: FoodUnit }) => void;
}) {
  const entries = useNutrition((s) => s.entries);
  // Start from the amount used last time.
  const lastAmount = useMemo(() => {
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].foodId === food.id && entries[i].amount) return entries[i].amount;
    }
    return undefined;
  }, [entries, food.id]);
  const [amount, setAmount] = useState(String(round1(lastAmount ?? basis(food.unit))));
  const n = parseNum(amount);
  const m = scale(food, n);

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Card style={{ marginTop: 14, backgroundColor: C.card2 }}>
        <Text style={T.small}>
          {basisLabel(food.unit)}: {thousands(food.kcal)} kcal · P {round1(food.protein)} · C {round1(food.carbs)} · F{' '}
          {round1(food.fat)}
        </Text>
        <MacroLine m={m} />
      </Card>
      <Field
        label="How much"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        suffix={food.unit === 'serving' ? 'servings' : food.unit}
        autoFocus
        selectTextOnFocus
      />
      {food.pack && food.unit !== 'serving' ? (
        <View style={styles.packRow}>
          {(
            [
              ['¼ pack', 0.25],
              ['½ pack', 0.5],
              ['Whole pack', 1],
            ] as const
          ).map(([label, part]) => (
            <Pressable
              key={label}
              onPress={() => {
                buzz();
                setAmount(String(round1(food.pack! * part)));
              }}
              accessibilityRole="button"
              style={styles.packChip}
            >
              <Text style={styles.packChipText}>{label}</Text>
              <Text style={T.small}>
                {round1(food.pack! * part)} {food.unit}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <PrimaryButton
        label="Log it"
        color={C.nutrition}
        disabled={n <= 0}
        onPress={() => onLog(food.name, m, { foodId: food.id, amount: n, unit: food.unit })}
        style={{ marginTop: 18 }}
      />
    </ScrollView>
  );
}

// Add a food to the catalogue, or change one.
function FoodForm({
  food,
  onSaved,
  onDeleted,
}: {
  food: Food | null;
  onSaved: (food: Food, isNew: boolean) => void;
  onDeleted: () => void;
}) {
  const addFood = useNutrition((s) => s.addFood);
  const updateFood = useNutrition((s) => s.updateFood);
  const deleteFood = useNutrition((s) => s.deleteFood);
  const [name, setName] = useState(food?.name ?? '');
  const [unit, setUnit] = useState<FoodUnit>(food?.unit ?? 'g');
  const [kcal, setKcal] = useState(food ? String(food.kcal) : '');
  const [protein, setProtein] = useState(food ? String(food.protein) : '');
  const [carbs, setCarbs] = useState(food ? String(food.carbs) : '');
  const [fat, setFat] = useState(food ? String(food.fat) : '');
  const [pack, setPack] = useState(food?.pack ? String(food.pack) : '');
  const [camera, setCamera] = useState<ScanMode | null>(null); // which scanner is open
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  const macros = { protein: parseNum(protein), carbs: parseNum(carbs), fat: parseNum(fat) };
  const fromMacros = macroKcal(macros);
  const packSize = unit === 'serving' ? 0 : Math.round(parseNum(pack));
  // Calories left blank are worked out from the macros.
  const data = {
    name: name.trim(),
    unit,
    kcal: Math.round(parseNum(kcal)) || fromMacros,
    ...macros,
    pack: packSize > 0 ? packSize : undefined,
  };

  // What a scanner read goes into the boxes below, to be checked before saving.
  const fill = (v: PackValues) => {
    setCamera(null);
    setUnit(v.unit);
    if (v.kcal !== undefined) setKcal(String(v.kcal));
    if (v.protein !== undefined) setProtein(String(v.protein));
    if (v.carbs !== undefined) setCarbs(String(v.carbs));
    if (v.fat !== undefined) setFat(String(v.fat));
    if (v.pack) setPack(String(v.pack));
    if (v.name && !name.trim()) setName(v.name);
    const missing = v.found < 4 ? ' Only ' + v.found + ' of the 4 numbers were found: fill in the rest.' : '';
    setNote({
      ok: true,
      text:
        (v.source === 'barcode' ? 'Found by its barcode (Open Food Facts).' : 'Read from the nutrition table.') +
        ' Check the numbers before saving.' +
        missing,
    });
  };
  const ok = data.name.length > 0 && (data.kcal > 0 || fromMacros > 0);

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {/* Two separate scanners: the barcode (the owner's version only, it looks the product up online) and the
          nutrition table (read on the phone, nothing sent anywhere). */}
      {scanAvailable ? (
        <View style={styles.scanRow}>
          {barcodeLookup ? (
            <GhostButton label="Barcode" icon="barcode-outline" color={C.text} onPress={() => setCamera('barcode')} style={{ flex: 1 }} />
          ) : null}
          <GhostButton
            label={barcodeLookup ? 'Nutrition table' : 'Scan the nutrition table'}
            icon="scan-outline"
            color={C.text}
            onPress={() => setCamera('label')}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
      {camera ? (
        <ScanCamera
          key={camera}
          mode={camera}
          onDone={fill}
          onClose={() => setCamera(null)}
          onUseLabel={() => setCamera('label')}
        />
      ) : null}
      {note ? <Text style={[T.small, { marginTop: 8, lineHeight: 18, color: note.ok ? C.up : C.muted }]}>{note.text}</Text> : null}
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Chicken breast" autoFocus={!food && !scanAvailable} maxLength={60} />
      <Text style={[T.label, { marginTop: 14, marginBottom: 6 }]}>The numbers below are</Text>
      <Segmented
        options={[
          { key: 'g', label: 'Per 100 g' },
          { key: 'ml', label: 'Per 100 ml' },
          { key: 'serving', label: 'Per serving' },
        ]}
        value={unit}
        onChange={setUnit}
        color={C.nutrition}
      />
      <Field
        label="Calories"
        value={kcal}
        onChangeText={setKcal}
        keyboardType="decimal-pad"
        suffix="kcal"
        placeholder={fromMacros > 0 ? String(fromMacros) : '0'}
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Protein" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" suffix="g" placeholder="0" containerStyle={{ flex: 1 }} />
        <Field label="Carbs" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" suffix="g" placeholder="0" containerStyle={{ flex: 1 }} />
        <Field label="Fat" value={fat} onChangeText={setFat} keyboardType="decimal-pad" suffix="g" placeholder="0" containerStyle={{ flex: 1 }} />
      </View>
      {unit !== 'serving' ? (
        <Field
          label="Whole pack (optional, for half a pack)"
          value={pack}
          onChangeText={setPack}
          keyboardType="decimal-pad"
          suffix={unit}
          placeholder="e.g. 180"
        />
      ) : null}
      <PrimaryButton
        label={food ? 'Save changes' : 'Save to My foods'}
        color={C.nutrition}
        disabled={!ok}
        onPress={() => {
          if (food) {
            updateFood(food.id, data);
            onSaved({ ...food, ...data }, false);
          } else {
            const id = addFood(data);
            onSaved({ ...data, id, lastUsed: Date.now() }, true);
          }
        }}
        style={{ marginTop: 20 }}
      />
      {food ? (
        <GhostButton
          label="Delete from My foods"
          icon="trash-outline"
          color={C.down}
          outlined={false}
          onPress={() =>
            confirmAction(`Delete ${food.name}?`, 'It leaves your catalogue. Days you already logged it keep it.', 'Delete', () => {
              deleteFood(food.id);
              onDeleted();
            })
          }
          style={{ marginTop: 8 }}
        />
      ) : null}
    </ScrollView>
  );
}

// A one-off: just the calories and macros.
function QuickAdd({
  onLog,
}: {
  onLog: (name: string, m: Macros, from?: { foodId: string; amount: number; unit: FoodUnit }) => void;
}) {
  const addFood = useNutrition((s) => s.addFood);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [keep, setKeep] = useState(false);

  const macros = { protein: parseNum(protein), carbs: parseNum(carbs), fat: parseNum(fat) };
  const fromMacros = macroKcal(macros);
  const m: Macros = { kcal: Math.round(parseNum(kcal)) || fromMacros, ...macros };
  const canKeep = name.trim().length > 0;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Field label="Name (optional)" value={name} onChangeText={setName} placeholder="e.g. Lunch out" maxLength={60} />
      <Field
        label="Calories"
        value={kcal}
        onChangeText={setKcal}
        keyboardType="decimal-pad"
        suffix="kcal"
        placeholder={fromMacros > 0 ? String(fromMacros) : '0'}
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Protein" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" suffix="g" placeholder="0" containerStyle={{ flex: 1 }} />
        <Field label="Carbs" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" suffix="g" placeholder="0" containerStyle={{ flex: 1 }} />
        <Field label="Fat" value={fat} onChangeText={setFat} keyboardType="decimal-pad" suffix="g" placeholder="0" containerStyle={{ flex: 1 }} />
      </View>
      <View style={styles.keepRow}>
        <View style={{ flex: 1 }}>
          <Text style={[T.body, { fontWeight: '600', color: canKeep ? C.text : C.faint }]}>Keep in My foods</Text>
          <Text style={T.small}>{canKeep ? 'Saved as one serving, to reuse.' : 'Give it a name to keep it.'}</Text>
        </View>
        <Switch
          value={keep && canKeep}
          onValueChange={setKeep}
          disabled={!canKeep}
          trackColor={{ true: C.nutrition, false: C.card2 }}
        />
      </View>
      <PrimaryButton
        label="Log it"
        color={C.nutrition}
        disabled={m.kcal <= 0}
        onPress={() => {
          const label = name.trim() || 'Quick add';
          if (keep && canKeep) {
            const foodId = addFood({ name: label, unit: 'serving', ...m });
            onLog(label, m, { foodId, amount: 1, unit: 'serving' });
          } else onLog(label, m);
        }}
        style={{ marginTop: 18 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cardSolid },
  inner: { flex: 1, width: '100%', maxWidth: 500, alignSelf: 'center', paddingHorizontal: PAD, paddingTop: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.card2,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.card2,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    marginTop: 12,
    marginBottom: 4,
  },
  searchInput: { flex: 1, minWidth: 0, color: C.text, fontSize: 17, height: 46, padding: 0 },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  macroLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 10 },
  kcal: { color: C.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  macro: { fontSize: 15, fontWeight: '700', marginLeft: 8, fontVariant: ['tabular-nums'] },
  scanRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  packRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  packChip: { flex: 1, alignItems: 'center', backgroundColor: C.card2, borderRadius: 14, paddingVertical: 9 },
  packChipText: { color: C.text, fontSize: 15, fontWeight: '600' },
  keepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
});
