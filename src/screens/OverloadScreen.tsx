// Overload: the split (sessions), and inside a session its exercises with their sets, laid out like the owner's
// notes (each exercise its own paragraph, each set a line "50kg – 10"; cardio as "20min – 150W"). Tap a number
// for its wheel; press and hold a session or an exercise, then drag, to reorder; exercises only change after
// tapping Edit.

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DragList } from '../components/DragList';
import { Glass } from '../components/Glass';
import { WheelColumn, WheelRow, range } from '../components/Wheel';
import {
  Empty,
  Field,
  GhostButton,
  Group,
  IconButton,
  PrimaryButton,
  Screen,
  SectionTitle,
  Segmented,
  Sheet,
  buzz,
  confirmAction,
} from '../components/ui';
import { agoLabel, formatDay } from '../lib/dates';
import {
  CARDIO_METRICS,
  compareSet,
  dayChange,
  describeChange,
  formatMinutes,
  formatWeight,
  isBlank,
  setLabel,
  splitWeight,
  type CardioMetric,
  type ExerciseKind,
  type SetVal,
  type Workout,
} from '../lib/overload';
import { useToday } from '../store/hooks';
import { backSwipe } from '../store/pageLock';
import { useTraining, type Exercise, type Session } from '../store/training';
import { C, T, alpha, changeColor } from '../theme';
import variant from '../../variant.json';

const CHANGE_WORD = { up: 'went up', same: 'stayed the same', down: 'went down', first: 'first time logged' };
const METRIC_WORD: Record<CardioMetric, string> = { W: 'watts', km: 'distance', kcal: 'calories', level: 'level' };

export const OverloadScreen = React.memo(function OverloadScreen() {
  const [open, setOpen] = useState<{ id: string; edit: boolean } | null>(null);
  const sessions = useTraining((s) => s.sessions);
  const session = open ? sessions.find((s) => s.id === open.id) : undefined;

  if (open && session) {
    return <SessionView key={session.id} session={session} startInEdit={open.edit} onBack={() => setOpen(null)} />;
  }
  return <SplitList onOpen={(id, edit) => setOpen({ id, edit })} />;
});

// ───────────────────────── The split: one row per session ─────────────────────────

function SplitList({ onOpen }: { onOpen: (id: string, edit: boolean) => void }) {
  const today = useToday();
  const sessions = useTraining((s) => s.sessions);
  const workouts = useTraining((s) => s.workouts);
  const addSession = useTraining((s) => s.addSession);
  const moveSession = useTraining((s) => s.moveSession);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  // The most recent workout of each session.
  const last = useMemo(() => {
    const m = new Map<string, Workout>();
    for (const w of workouts) {
      const cur = m.get(w.sessionId);
      if (!cur || w.date > cur.date) m.set(w.sessionId, w);
    }
    return m;
  }, [workouts]);

  const create = () => {
    const n = name.trim();
    if (!n) return;
    const id = addSession(n);
    setAdding(false);
    setName('');
    onOpen(id, true);
  };

  return (
    <Screen title="Overload" subtitle={formatDay(today)} glow={C.glowOverload}>
      {sessions.length === 0 ? (
        <Empty
          icon="barbell-outline"
          title="Set up your split"
          text="Add your first session (for example Push day), then write in its exercises and sets."
        />
      ) : (
        <>
          <SectionTitle style={{ marginTop: 10 }}>Your split</SectionTitle>
          {/* Tap a session to open it; press and hold, then drag, to reorder. */}
          <Group>
            <DragList
              items={sessions}
              keyOf={(s) => s.id}
              onPress={(s) => onOpen(s.id, false)}
              onReorder={moveSession}
              renderRow={(s, { lifted, last: lastRow }) => {
                const w = last.get(s.id);
                const total = s.exercises.reduce((n, e) => n + e.sets.length, 0);
                const doneToday = w && w.date === today ? w.sets.length : 0;
                const change = w ? dayChange(w.sets) : null;
                return (
                  <View style={[styles.sessionRow, !lastRow && !lifted && styles.line]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sessionName} numberOfLines={1}>
                        {s.name}
                      </Text>
                      <Text style={[T.small, { marginTop: 2 }]} numberOfLines={1}>
                        {s.exercises.length} {s.exercises.length === 1 ? 'exercise' : 'exercises'} · {total}{' '}
                        {total === 1 ? 'set' : 'sets'}
                      </Text>
                      <View style={styles.sessionStatus}>
                        {w ? <View style={[styles.dot, { backgroundColor: changeColor(change) }]} /> : null}
                        {doneToday > 0 ? (
                          <Text style={[T.small, { color: C.text, fontWeight: '600' }]} numberOfLines={1}>
                            Today · {doneToday} of {total} sets done
                          </Text>
                        ) : w ? (
                          <Text style={T.small} numberOfLines={1}>
                            Last time {agoLabel(w.date, today)} · {change ? CHANGE_WORD[change] : ''}
                          </Text>
                        ) : (
                          <Text style={T.small}>Not logged yet</Text>
                        )}
                      </View>
                    </View>
                    <Ionicons name={lifted ? 'reorder-three' : 'chevron-forward'} size={lifted ? 22 : 17} color={C.faint} />
                  </View>
                );
              }}
            />
          </Group>
          {sessions.length > 1 ? (
            <Text style={[T.small, { marginTop: 8, marginLeft: 16, color: C.faint }]}>Press and hold a session, then drag it to reorder.</Text>
          ) : null}
        </>
      )}

      <GhostButton label="Add session" icon="add" color={C.text} onPress={() => setAdding(true)} style={{ marginTop: 16 }} />

      {/* Which build is installed (written in by the GitHub build). */}
      <Text style={styles.build}>Omniload · {variant.build > 0 ? `build ${variant.build}` : 'preview'}</Text>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="New session">
        <Field
          label="Name"
          placeholder="e.g. Push day"
          value={name}
          onChangeText={setName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={create}
          maxLength={40}
        />
        <PrimaryButton label="Add and write its exercises" onPress={create} disabled={!name.trim()} style={{ marginTop: 18 }} />
      </Sheet>
    </Screen>
  );
}

// ───────────────────────── One session: each exercise a paragraph ─────────────────────────

type WheelTarget = { exId: string; index: number; part: 'weight' | 'reps' };

function SessionView({ session, startInEdit, onBack }: { session: Session; startInEdit: boolean; onBack: () => void }) {
  const today = useToday();
  const [edit, setEdit] = useState(startInEdit);
  const [wheel, setWheel] = useState<WheelTarget | null>(null);
  const [fresh, setFresh] = useState<string | null>(null); // the exercise just added: its name box gets the keyboard

  const workouts = useTraining((s) => s.workouts);
  const t = useTraining.getState(); // the actions never change

  // Swiping right (pulling the page past its left edge) goes back to the split, like the arrow.
  useEffect(() => {
    backSwipe.handler = onBack;
    return () => {
      backSwipe.handler = null;
    };
  }, [onBack]);

  const todays = useMemo(
    () => workouts.find((w) => w.date === today && w.sessionId === session.id),
    [workouts, today, session.id],
  );
  const loggedSet = (exId: string, i: number) => todays?.sets.find((s) => s.exerciseId === exId && s.setIndex === i);

  const wheelEx = wheel ? session.exercises.find((e) => e.id === wheel.exId) : undefined;
  const wheelSet = wheel && wheelEx ? wheelEx.sets[wheel.index] : undefined;
  const wheelLogged = wheel ? loggedSet(wheel.exId, wheel.index) : undefined;

  const total = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  const done = todays ? todays.sets.length : 0;

  const toggleEdit = () => {
    buzz();
    setEdit(!edit);
    setFresh(null);
  };

  const renderExercise = (ex: Exercise, { lifted, last }: { lifted: boolean; last: boolean }) => {
    const kind: ExerciseKind = ex.kind ?? 'strength';
    const metric: CardioMetric = ex.metric ?? 'W';
    return (
      <View style={[styles.exercise, !last && !lifted && styles.line]}>
        {edit ? (
          <>
            <View style={styles.exHead}>
              <TextInput
                value={ex.name}
                onChangeText={(v) => t.renameExercise(session.id, ex.id, v)}
                placeholder={kind === 'cardio' ? 'Cardio (e.g. Bike, Rower)' : 'Exercise name'}
                placeholderTextColor={C.faint}
                keyboardAppearance="dark"
                autoFocus={fresh === ex.id}
                style={styles.exInput}
                maxLength={60}
              />
              {/* Hold here (or anywhere on the exercise that isn't a button) and drag to move it. */}
              <View style={styles.handle}>
                <Ionicons name="reorder-three" size={24} color={C.faint} />
              </View>
              <IconButton
                icon="trash-outline"
                size={19}
                color={C.down}
                label="Delete exercise"
                onPress={() =>
                  confirmAction(
                    `Delete ${ex.name || 'this exercise'}?`,
                    'It leaves this session. What you already logged stays in Metrics.',
                    'Delete',
                    () => t.deleteExercise(session.id, ex.id),
                  )
                }
              />
            </View>
            {kind === 'cardio' ? (
              <View style={{ marginBottom: 6, marginTop: 2 }}>
                <Segmented options={CARDIO_METRICS} value={metric} onChange={(m) => t.setMetric(session.id, ex.id, m)} />
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.exName}>{ex.name || (kind === 'cardio' ? 'Cardio' : 'Untitled exercise')}</Text>
        )}

        {ex.sets.map((s, i) => (
          <SetRow
            key={i}
            index={i}
            set={s}
            kind={kind}
            metric={metric}
            logged={loggedSet(ex.id, i)}
            edit={edit}
            onWeight={() => setWheel({ exId: ex.id, index: i, part: 'weight' })}
            onReps={() => setWheel({ exId: ex.id, index: i, part: 'reps' })}
            onTick={() => {
              const lg = loggedSet(ex.id, i);
              if (lg) {
                buzz();
                t.unlogSet(session.id, ex.id, i, today);
              } else if (isBlank(s)) {
                setWheel({ exId: ex.id, index: i, part: 'weight' });
              } else {
                buzz('done');
                t.logSet(session.id, ex.id, i, s, today);
              }
            }}
            onRemove={() => t.removeSet(session.id, ex.id, i, today)}
          />
        ))}

        {edit ? (
          <GhostButton
            label={kind === 'cardio' ? 'Add round' : 'Add set'}
            icon="add-circle"
            color={C.text}
            outlined={false}
            onPress={() => t.addSet(session.id, ex.id)}
            style={{ alignSelf: 'flex-start', height: 40, paddingHorizontal: 0 }}
          />
        ) : null}
      </View>
    );
  };

  const wheelKind: ExerciseKind = wheelEx?.kind ?? 'strength';
  const wheelMetric: CardioMetric = wheelEx?.metric ?? 'W';
  const partWord =
    wheel?.part === 'weight' ? (wheelKind === 'cardio' ? 'time' : 'weight') : wheelKind === 'cardio' ? METRIC_WORD[wheelMetric] : 'reps';

  return (
    <Screen
      glow={C.glowOverload}
      left={<IconButton icon="chevron-back" onPress={onBack} label="Back to your split" filled />}
      title={
        edit ? (
          <TextInput
            value={session.name}
            onChangeText={(v) => t.renameSession(session.id, v)}
            placeholder="Session name"
            placeholderTextColor={C.faint}
            keyboardAppearance="dark"
            style={styles.titleInput}
            maxLength={40}
          />
        ) : (
          <Text style={[T.title, { fontSize: 28 }]} numberOfLines={1}>
            {session.name || 'Session'}
          </Text>
        )
      }
      subtitle={edit ? undefined : done > 0 ? `Today · ${done} of ${total} sets done` : formatDay(today)}
      right={
        edit ? (
          <Pressable onPress={toggleEdit} accessibilityRole="button" style={styles.donePill}>
            <Text style={[styles.editText, { color: C.ink }]}>Done</Text>
          </Pressable>
        ) : (
          <Pressable onPress={toggleEdit} accessibilityRole="button">
            <Glass style={styles.editPill} interactive>
              <Text style={styles.editText}>Edit</Text>
            </Glass>
          </Pressable>
        )
      }
    >
      {session.exercises.length === 0 && !edit ? (
        <Empty icon="create-outline" title="No exercises yet" text="Tap Edit to write in this session's exercises." />
      ) : null}

      <DragList
        items={session.exercises}
        keyOf={(ex) => ex.id}
        highlight={false}
        onReorder={(from, to) => t.moveExercise(session.id, from, to)}
        renderRow={renderExercise}
      />

      {edit ? (
        <>
          <View style={styles.addRow}>
            <GhostButton
              label="Exercise"
              icon="add"
              color={C.text}
              onPress={() => setFresh(t.addExercise(session.id))}
              style={{ flex: 1 }}
            />
            <GhostButton
              label="Cardio"
              icon="add"
              color={C.text}
              onPress={() => setFresh(t.addExercise(session.id, 'cardio'))}
              style={{ flex: 1 }}
            />
          </View>
          <GhostButton
            label="Delete this session"
            icon="trash-outline"
            color={C.down}
            outlined={false}
            onPress={() =>
              confirmAction(
                `Delete ${session.name || 'this session'}?`,
                'The session and its exercises go. What you already logged stays in Metrics.',
                'Delete',
                () => {
                  onBack();
                  t.deleteSession(session.id);
                },
              )
            }
            style={{ marginTop: 14 }}
          />
        </>
      ) : session.exercises.length > 0 ? (
        <Text style={[T.small, { textAlign: 'center', marginTop: 10, lineHeight: 18, color: C.faint }]}>
          Tap a number to change it with the wheel.{'\n'}Tap the circle when it's done as written.{'\n'}Press and hold an
          exercise, then drag it to reorder.
        </Text>
      ) : null}

      {wheel && wheelEx && wheelSet ? (
        <SetWheelSheet
          key={wheel.exId + ':' + wheel.index + wheel.part}
          part={wheel.part}
          kind={wheelKind}
          metric={wheelMetric}
          title={(wheelEx.name || (wheelKind === 'cardio' ? 'Cardio' : 'Exercise')) + ' · ' + partWord}
          subtitle={
            edit
              ? `Set ${wheel.index + 1} · starting numbers`
              : wheelLogged
                ? `Set ${wheel.index + 1} · logged today` +
                  (wheelLogged.prev ? ` · last time ${setLabel(wheelLogged.prev, wheelKind, wheelMetric)}` : '')
                : isBlank(wheelSet)
                  ? `Set ${wheel.index + 1}`
                  : `Set ${wheel.index + 1} · last time ${setLabel(wheelSet, wheelKind, wheelMetric)}`
          }
          initial={wheelSet}
          action={edit ? 'Save' : wheelLogged ? 'Update set' : 'Log set'}
          onClose={() => setWheel(null)}
          onSave={(val) => {
            if (edit) t.setNumbers(session.id, wheel.exId, wheel.index, val);
            else {
              buzz('done');
              t.logSet(session.id, wheel.exId, wheel.index, val, today);
            }
            setWheel(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

// One line of the note: "50kg – 10" (or "20min – 150W"), what changed, and a round tick like Reminders'.
function SetRow({
  index,
  set,
  kind,
  metric,
  logged,
  edit,
  onWeight,
  onReps,
  onTick,
  onRemove,
}: {
  index: number;
  set: SetVal;
  kind: ExerciseKind;
  metric: CardioMetric;
  logged: Workout['sets'][number] | undefined;
  edit: boolean;
  onWeight: () => void;
  onReps: () => void;
  onTick: () => void;
  onRemove: () => void;
}) {
  const change = logged ? compareSet(logged, logged.prev, kind) : null;
  const color = changeColor(change);
  const delta = logged ? describeChange(logged, logged.prev, kind, metric) : '';
  const tag = delta || (change === 'same' ? 'Same' : '');
  const cardio = kind === 'cardio';
  const blank = isBlank(set) && { color: C.faint };
  return (
    <View style={styles.setRow}>
      {edit ? (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove set ${index + 1}`} style={{ marginRight: 10 }}>
          <Ionicons name="remove-circle" size={23} color={C.down} />
        </Pressable>
      ) : null}
      {/* The two numbers are separate things to tap: each opens its own wheel. */}
      <View style={styles.numbers}>
        <Pressable
          onPress={onWeight}
          hitSlop={{ top: 6, bottom: 6, left: 8 }}
          accessibilityRole="button"
          accessibilityLabel={
            cardio
              ? `Set ${index + 1} time: ${formatMinutes(set.weight)} minutes. Tap to change.`
              : `Set ${index + 1} weight: ${formatWeight(set.weight)} kilos. Tap to change.`
          }
          style={({ pressed }) => [styles.part, pressed && styles.partPressed]}
        >
          <Text style={[styles.setText, blank]}>
            {cardio ? formatMinutes(set.weight) : formatWeight(set.weight)}
            <Text style={styles.unit}>{cardio ? 'min' : 'kg'}</Text>
          </Text>
        </Pressable>
        <Text style={[styles.setText, styles.dash]}>–</Text>
        <Pressable
          onPress={onReps}
          hitSlop={{ top: 6, bottom: 6, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Set ${index + 1} ${cardio ? METRIC_WORD[metric] : 'reps'}: ${set.reps}. Tap to change.`}
          style={({ pressed }) => [styles.part, pressed && styles.partPressed]}
        >
          <Text style={[styles.setText, blank]}>
            {cardio && metric === 'level' ? <Text style={styles.unit}>lvl </Text> : null}
            {formatWeight(set.reps)}
            {cardio && metric !== 'level' ? <Text style={styles.unit}>{metric}</Text> : null}
          </Text>
        </Pressable>
        {!edit && tag ? (
          <View style={[styles.tag, { backgroundColor: alpha(color, 0.18) }]}>
            <Text style={[styles.tagText, { color }]} numberOfLines={1}>
              {tag}
            </Text>
          </View>
        ) : null}
      </View>
      {edit ? null : (
        <Pressable
          onPress={onTick}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!logged }}
          accessibilityLabel={`Set ${index + 1} done`}
          style={styles.tick}
        >
          <Ionicons name={logged ? 'checkmark-circle' : 'ellipse-outline'} size={23} color={logged ? color : C.faint} />
        </Pressable>
      )}
    </View>
  );
}

// ───────────────────────── The wheels ─────────────────────────

const KG = range(0, 400);
const QUARTERS = [0, 0.25, 0.5, 0.75];
const REPS = range(0, 60);
const MINUTES = range(0, 300);
const WATTS = range(0, 1000, 5);
const KM = range(0, 200);
const TENTHS = range(0, 9);
const KCAL = range(0, 3000, 10);
const LEVELS = range(0, 30);

// The nearest value the wheel has (a number typed in another unit may fall between two of them).
function snap(value: number, values: number[]): number {
  let best = values[0];
  for (const v of values) if (Math.abs(v - value) < Math.abs(best - value)) best = v;
  return best;
}

function SetWheelSheet({
  title,
  subtitle,
  part,
  kind,
  metric,
  initial,
  action,
  onSave,
  onClose,
}: {
  title: string;
  subtitle: string;
  part: 'weight' | 'reps'; // which of the two was tapped: only that one's wheel shows
  kind: ExerciseKind;
  metric: CardioMetric;
  initial: SetVal;
  action: string;
  onSave: (v: SetVal) => void;
  onClose: () => void;
}) {
  const cardio = kind === 'cardio';
  // The first number: kg and quarter kg, or minutes and quarter minutes.
  const start = splitWeight(initial.weight);
  const [whole, setWhole] = useState(Math.min(start.whole, cardio ? 300 : 400));
  const [quarter, setQuarter] = useState(start.quarter);
  // The second: reps, or the cardio machine's number (km has a tenths wheel).
  const secondValues = !cardio ? REPS : metric === 'W' ? WATTS : metric === 'kcal' ? KCAL : metric === 'level' ? LEVELS : KM;
  const [second, setSecond] = useState(snap(metric === 'km' && cardio ? Math.floor(initial.reps) : initial.reps, secondValues));
  const [tenth, setTenth] = useState(cardio && metric === 'km' ? Math.round((initial.reps % 1) * 10) % 10 : 0);

  const value = (): SetVal => ({
    weight: whole + quarter,
    reps: cardio && metric === 'km' ? Math.round((second + tenth / 10) * 10) / 10 : second,
  });

  return (
    <Sheet visible onClose={onClose} title={title} subtitle={subtitle}>
      {part === 'weight' ? (
        <WheelRow>
          <WheelColumn label={cardio ? 'min' : 'kg'} values={cardio ? MINUTES : KG} value={whole} onChange={setWhole} flex={1.4} />
          <WheelColumn
            label={cardio ? 'sec' : '+'}
            values={QUARTERS}
            value={quarter}
            onChange={setQuarter}
            format={(v) => (cardio ? ':' + (v === 0 ? '00' : String(v * 60)) : v === 0 ? '.0' : '.' + String(v).slice(2))}
          />
        </WheelRow>
      ) : (
        <WheelRow>
          <WheelColumn
            label={!cardio ? 'reps' : metric === 'level' ? 'level' : metric}
            values={secondValues}
            value={second}
            onChange={setSecond}
            flex={1.4}
          />
          {cardio && metric === 'km' ? <WheelColumn label="+" values={TENTHS} value={tenth} onChange={setTenth} format={(v) => '.' + v} /> : null}
        </WheelRow>
      )}
      <PrimaryButton label={action} onPress={() => onSave(value())} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 16, paddingRight: 16, paddingVertical: 13 },
  sessionName: { color: C.text, fontSize: 19, fontWeight: '600', letterSpacing: -0.4 },
  sessionStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  build: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 28 },

  titleInput: {
    minWidth: 0,
    color: C.text,
    fontSize: 22,
    fontWeight: '700',
    backgroundColor: C.card2,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    height: 44,
  },
  editPill: { height: 40, paddingHorizontal: 18, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  donePill: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.text,
  },
  editText: { color: C.text, fontSize: 16, fontWeight: '600' },

  // No card behind an exercise (the owner found it looked generated): plain paragraphs like the Notes page,
  // with one very thin line between exercises.
  exercise: { paddingTop: 12, paddingBottom: 10, paddingHorizontal: 8 },
  exName: { color: C.text, fontSize: 17, fontWeight: '600', letterSpacing: -0.4, marginBottom: 2 },
  exHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  exInput: {
    flex: 1,
    minWidth: 0,
    color: C.text,
    fontSize: 17,
    fontWeight: '600',
    backgroundColor: C.card2,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    height: 42,
    marginRight: 2,
  },
  handle: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', gap: 10, marginTop: 10 },

  setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 31 },
  numbers: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  part: { marginHorizontal: -5, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8 },
  partPressed: { backgroundColor: 'rgba(255,255,255,0.14)' },
  setText: { color: C.text, fontSize: 17, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  unit: { color: C.muted, fontSize: 17 },
  dash: { color: C.faint, marginHorizontal: 4 },
  tag: { borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2, flexShrink: 1, marginLeft: 6 },
  tagText: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tick: { width: 36, height: 30, alignItems: 'flex-end', justifyContent: 'center' },
});
