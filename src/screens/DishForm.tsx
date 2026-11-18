// A dish (the owner, 18 Nov 2026): a meal made of several ingredients, saved as one food so the day's log gets
// one line ("Chicken, rice & veg") instead of one per ingredient.
//
// Kept to one page: the dish's name, its ingredients (each with how much went in), the totals, Save.
// "+ Add ingredient" offers the ways a food already gets in: scan its barcode (the owner's version only),
// scan its nutrition table, pick it from My foods, or type the numbers. All of them end in the same small
// form, where the numbers can be checked and the amount used is typed (or ¼ / ½ / whole pack when known).
// The ingredients are kept inside the dish, so they don't fill up My foods.

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  Card,
  Field,
  GhostButton,
  Group,
  PrimaryButton,
  Row,
  SectionTitle,
  Segmented,
  Sheet,
  buzz,
  confirmAction,
} from '../components/ui';
import {
  amountLabel,
  basis,
  basisLabel,
  dishTotals,
  macroKcal,
  parseNum,
  round1,
  scale,
  thousands,
  type Food,
  type FoodUnit,
  type Ingredient,
} from '../lib/nutrition';
import { ScanCamera, type ScanMode } from '../scan/ScanCamera';
import { barcodeLookup, scanAvailable, type PackValues } from '../scan/scan';
import { uid } from '../store/persist';
import { useNutrition } from '../store/nutrition';
import { C, T } from '../theme';

type Step =
  | { kind: 'dish' }
  | { kind: 'pick' } // choosing from My foods
  | { kind: 'ingredient'; draft: Ingredient; isNew: boolean; note?: string };

export function DishForm({
  dish,
  onSaved,
  onDeleted,
}: {
  dish: Food | null;
  onSaved: (food: Food, isNew: boolean) => void;
  onDeleted: () => void;
}) {
  const addFood = useNutrition((s) => s.addFood);
  const updateFood = useNutrition((s) => s.updateFood);
  const deleteFood = useNutrition((s) => s.deleteFood);
  const [name, setName] = useState(dish?.name ?? '');
  const [ingredients, setIngredients] = useState<Ingredient[]>(dish?.ingredients ?? []);
  const [step, setStep] = useState<Step>({ kind: 'dish' });
  const [choosing, setChoosing] = useState(false); // the "add ingredient" choices
  const [camera, setCamera] = useState<ScanMode | null>(null);

  const total = useMemo(() => dishTotals(ingredients), [ingredients]);

  const startIngredient = (draft: Partial<Ingredient>, note?: string) => {
    const unit = draft.unit ?? 'g';
    setStep({
      kind: 'ingredient',
      isNew: true,
      note,
      draft: {
        id: uid(),
        name: draft.name ?? '',
        unit,
        kcal: draft.kcal ?? 0,
        protein: draft.protein ?? 0,
        carbs: draft.carbs ?? 0,
        fat: draft.fat ?? 0,
        pack: draft.pack,
        amount: draft.amount ?? basis(unit),
      },
    });
  };

  // What a scanner read becomes a new ingredient, to check and give an amount.
  const fromScan = (v: PackValues) => {
    setCamera(null);
    const missing = v.found < 4 ? ` Only ${v.found} of the 4 numbers were found: fill in the rest.` : '';
    startIngredient(
      { name: v.name, unit: v.unit, kcal: v.kcal, protein: v.protein, carbs: v.carbs, fat: v.fat, pack: v.pack, amount: v.unit === 'serving' ? 1 : undefined },
      (v.source === 'barcode' ? 'Found by its barcode.' : 'Read from the nutrition table.') + ' Check the numbers.' + missing,
    );
  };

  const saveIngredient = (ing: Ingredient) => {
    setIngredients((list) => (list.some((i) => i.id === ing.id) ? list.map((i) => (i.id === ing.id ? ing : i)) : [...list, ing]));
    setStep({ kind: 'dish' });
  };

  if (step.kind === 'pick') {
    return (
      <PickFood
        onPick={(f) => startIngredient({ name: f.name, unit: f.unit, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, pack: f.pack })}
        onCancel={() => setStep({ kind: 'dish' })}
      />
    );
  }

  if (step.kind === 'ingredient') {
    return (
      <IngredientForm
        key={step.draft.id}
        initial={step.draft}
        isNew={step.isNew}
        note={step.note}
        onSave={saveIngredient}
        onRemove={() => {
          setIngredients((list) => list.filter((i) => i.id !== step.draft.id));
          setStep({ kind: 'dish' });
        }}
        onCancel={() => setStep({ kind: 'dish' })}
      />
    );
  }

  const ok = name.trim().length > 0 && ingredients.length > 0 && total.kcal > 0;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Field label="Dish name" value={name} onChangeText={setName} placeholder="e.g. Chicken, rice & veg" autoFocus={!dish} maxLength={60} />

      <SectionTitle style={{ marginTop: 20 }}>What went into it</SectionTitle>
      {ingredients.length > 0 ? (
        <Group>
          {ingredients.map((ing, i) => (
            <Row
              key={ing.id}
              onPress={() => setStep({ kind: 'ingredient', draft: ing, isNew: false })}
              last={i === ingredients.length - 1}
              chevron
            >
              <View style={{ flex: 1 }}>
                <Text style={T.body} numberOfLines={1}>
                  {ing.name || 'Ingredient'}
                </Text>
                <Text style={[T.small, { marginTop: 2 }]}>{amountLabel(ing.amount, ing.unit)}</Text>
              </View>
              <Text style={styles.kcal}>{thousands(scale(ing, ing.amount).kcal)}</Text>
              <Text style={T.small}>kcal</Text>
            </Row>
          ))}
        </Group>
      ) : (
        <Text style={[T.small, { marginLeft: 16, lineHeight: 18 }]}>
          Add each thing that went in: scan it, pick it from My foods, or type its numbers.
        </Text>
      )}
      <GhostButton label="Add ingredient" icon="add" color={C.text} onPress={() => setChoosing(true)} style={{ marginTop: 12 }} />

      {ingredients.length > 0 ? (
        <Card style={{ marginTop: 16, backgroundColor: C.card2 }}>
          <Text style={T.small}>The whole dish</Text>
          <View style={styles.totals}>
            <Text style={styles.bigKcal}>{thousands(total.kcal)}</Text>
            <Text style={[T.muted, { marginRight: 'auto' }]}>kcal</Text>
            <Text style={styles.macro}>P {round1(total.protein)}</Text>
            <Text style={styles.macro}>C {round1(total.carbs)}</Text>
            <Text style={styles.macro}>F {round1(total.fat)}</Text>
          </View>
        </Card>
      ) : null}

      <PrimaryButton
        label={dish ? 'Save changes' : 'Save dish'}
        disabled={!ok}
        onPress={() => {
          buzz('done');
          const data = { name: name.trim(), unit: 'serving' as FoodUnit, ...total, ingredients, pack: undefined };
          if (dish) {
            updateFood(dish.id, data);
            onSaved({ ...dish, ...data }, false);
          } else {
            const id = addFood(data);
            onSaved({ ...data, id, lastUsed: Date.now() }, true);
          }
        }}
        style={{ marginTop: 20 }}
      />
      {!ok && ingredients.length > 0 && !name.trim() ? <Text style={[T.small, { textAlign: 'center', marginTop: 8 }]}>Give the dish a name to save it.</Text> : null}
      {dish ? (
        <GhostButton
          label="Delete dish"
          icon="trash-outline"
          color={C.down}
          outlined={false}
          onPress={() =>
            confirmAction(`Delete ${dish.name}?`, 'It leaves My foods. Days you already logged it keep it.', 'Delete', () => {
              deleteFood(dish.id);
              onDeleted();
            })
          }
          style={{ marginTop: 8 }}
        />
      ) : null}

      {/* The ways an ingredient gets in. */}
      <Sheet visible={choosing} onClose={() => setChoosing(false)} title="Add an ingredient">
        <View style={{ marginTop: 8 }}>
          {scanAvailable && barcodeLookup ? (
            <Choice icon="barcode-outline" title="Scan its barcode" onPress={() => { setChoosing(false); setCamera('barcode'); }} />
          ) : null}
          {scanAvailable ? (
            <Choice icon="scan-outline" title="Scan its nutrition table" onPress={() => { setChoosing(false); setCamera('label'); }} />
          ) : null}
          <Choice icon="list-outline" title="Pick from My foods" onPress={() => { setChoosing(false); setStep({ kind: 'pick' }); }} />
          <Choice icon="create-outline" title="Type the numbers" last onPress={() => { setChoosing(false); startIngredient({}); }} />
        </View>
      </Sheet>

      {camera ? (
        <ScanCamera key={camera} mode={camera} onDone={fromScan} onClose={() => setCamera(null)} onUseLabel={() => setCamera('label')} />
      ) : null}
    </ScrollView>
  );
}

function Choice({ icon, title, onPress, last }: { icon: keyof typeof Ionicons.glyphMap; title: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.choice, !last && styles.line, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={22} color={C.text} />
      <Text style={[T.body, { flex: 1 }]}>{title}</Text>
      <Ionicons name="chevron-forward" size={17} color={C.faint} />
    </Pressable>
  );
}

// ───────────────────────── Pick an ingredient from My foods ─────────────────────────

function PickFood({ onPick, onCancel }: { onPick: (f: Food) => void; onCancel: () => void }) {
  const foods = useNutrition((s) => s.foods);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return foods
      .filter((f) => !f.ingredients?.length && (!q || f.name.toLowerCase().includes(q))) // not other dishes
      .sort((a, b) => b.lastUsed - a.lastUsed);
  }, [foods, query]);
  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
      {shown.length === 0 ? (
        <Text style={[T.muted, { textAlign: 'center', marginTop: 24 }]}>{foods.length === 0 ? 'My foods is empty.' : 'No food by that name.'}</Text>
      ) : (
        shown.map((f) => (
          <Pressable key={f.id} onPress={() => onPick(f)} accessibilityRole="button" style={({ pressed }) => [styles.pickRow, pressed && { opacity: 0.6 }]}>
            <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>
              {f.name}
            </Text>
            <Text style={[T.small, { marginTop: 2 }]} numberOfLines={1}>
              {basisLabel(f.unit)} · {thousands(f.kcal)} kcal · P {round1(f.protein)} · C {round1(f.carbs)} · F {round1(f.fat)}
            </Text>
          </Pressable>
        ))
      )}
      <GhostButton label="Cancel" color={C.muted} outlined={false} onPress={onCancel} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}

// ───────────────────────── One ingredient: its numbers and how much went in ─────────────────────────

function IngredientForm({
  initial,
  isNew,
  note,
  onSave,
  onRemove,
  onCancel,
}: {
  initial: Ingredient;
  isNew: boolean;
  note?: string;
  onSave: (ing: Ingredient) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const s = (v: number) => (v ? String(round1(v)) : '');
  const [name, setName] = useState(initial.name);
  const [unit, setUnit] = useState<FoodUnit>(initial.unit);
  const [kcal, setKcal] = useState(s(initial.kcal));
  const [protein, setProtein] = useState(s(initial.protein));
  const [carbs, setCarbs] = useState(s(initial.carbs));
  const [fat, setFat] = useState(s(initial.fat));
  const [amount, setAmount] = useState(String(round1(initial.amount)));

  const macros = { protein: parseNum(protein), carbs: parseNum(carbs), fat: parseNum(fat) };
  const per = { kcal: Math.round(parseNum(kcal)) || macroKcal(macros), ...macros };
  const n = parseNum(amount);
  const adds = scale({ ...per, unit }, n);
  const ok = name.trim().length > 0 && n > 0 && per.kcal > 0;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {note ? <Text style={[T.small, { color: C.up, lineHeight: 18, marginTop: 4 }]}>{note}</Text> : null}
      <Field label="Ingredient" value={name} onChangeText={setName} placeholder="e.g. Chicken breast" autoFocus={!initial.name} maxLength={60} />
      <Text style={[T.label, { marginTop: 14, marginBottom: 6 }]}>Its numbers are</Text>
      <Segmented
        options={[
          { key: 'g', label: 'Per 100 g' },
          { key: 'ml', label: 'Per 100 ml' },
          { key: 'serving', label: 'Per serving' },
        ]}
        value={unit}
        onChange={(u) => {
          setUnit(u);
          if (u === 'serving' && n >= 10) setAmount('1');
        }}
      />
      <Field label="Calories" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" suffix="kcal" placeholder={String(macroKcal(macros) || 0)} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Protein" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" suffix="g" placeholder="0" containerStyle={{ flex: 1 }} />
        <Field label="Carbs" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" suffix="g" placeholder="0" containerStyle={{ flex: 1 }} />
        <Field label="Fat" value={fat} onChangeText={setFat} keyboardType="decimal-pad" suffix="g" placeholder="0" containerStyle={{ flex: 1 }} />
      </View>

      <Field
        label="How much went in"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        suffix={unit === 'serving' ? 'servings' : unit}
        selectTextOnFocus
        containerStyle={{ marginTop: 22 }}
      />
      {initial.pack && unit !== 'serving' ? (
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
                setAmount(String(round1(initial.pack! * part)));
              }}
              accessibilityRole="button"
              style={styles.packChip}
            >
              <Text style={styles.packChipText}>{label}</Text>
              <Text style={T.small}>
                {round1(initial.pack! * part)} {unit}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {n > 0 && per.kcal > 0 ? (
        <Text style={[T.small, { marginTop: 10 }]}>
          Adds {thousands(adds.kcal)} kcal · P {adds.protein} · C {adds.carbs} · F {adds.fat}
        </Text>
      ) : null}

      <PrimaryButton
        label={isNew ? 'Add to dish' : 'Save'}
        disabled={!ok}
        onPress={() => {
          buzz();
          onSave({ ...initial, name: name.trim(), unit, ...per, amount: n });
        }}
        style={{ marginTop: 18 }}
      />
      {isNew ? (
        <GhostButton label="Cancel" color={C.muted} outlined={false} onPress={onCancel} style={{ marginTop: 6 }} />
      ) : (
        <GhostButton label="Remove from dish" icon="trash-outline" color={C.down} outlined={false} onPress={onRemove} style={{ marginTop: 6 }} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  kcal: { color: C.text, fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  totals: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 },
  bigKcal: { color: C.text, fontSize: 32, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  macro: { color: C.text, fontSize: 15, fontWeight: '600', marginLeft: 8, fontVariant: ['tabular-nums'] },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.card2,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 4,
  },
  searchInput: { flex: 1, minWidth: 0, color: C.text, fontSize: 17, height: 46, padding: 0 },
  pickRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  packRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  packChip: { flex: 1, alignItems: 'center', backgroundColor: C.card2, borderRadius: 14, paddingVertical: 9 },
  packChipText: { color: C.text, fontSize: 15, fontWeight: '600' },
});
