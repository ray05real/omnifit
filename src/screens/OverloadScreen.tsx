// Overload: the split (sessions), and inside a session its exercises with their sets, like the owner's notes.
// Tap a set's numbers for the wheel; exercises only change after tapping Edit.

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { WheelColumn, WheelRow, range } from '../components/Wheel';
import {
  Card,
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
import { agoLabel, formatDay } from '../lib/dates';
import {
  compareSet,
  dayChange,
  describeChange,
  formatWeight,
  isBlank,
  splitWeight,
  type SetVal,
  type Workout,
} from '../lib/overload';
import { useToday } from '../store/hooks';
import { useTraining, type Exercise, type Session } from '../store/training';
import { C, T, changeColor } from '../theme';

const CHANGE_WORD = { up: 'went up', same: 'stayed the same', down: 'went down', first: 'first time logged' };

export const OverloadScreen = React.memo(function OverloadScreen() {
  const [open, setOpen] = useState<{ id: string; edit: boolean } | null>(null);
  const sessions = useTraining((s) => s.sessions);
  const session = open ? sessions.find((s) => s.id === open.id) : undefined;

  if (open && session) {
    return <SessionView key={session.id} session={session} startInEdit={open.edit} onBack={() => setOpen(null)} />;
  }
  return <SplitList onOpen={(id, edit) => setOpen({ id, edit })} />;
});

// ───────────────────────── The split: one card per session ─────────────────────────

function SplitList({ onOpen }: { onOpen: (id: string, edit: boolean) => void }) {
  const today = useToday();
  const sessions = useTraining((s) => s.sessions);
  const workouts = useTraining((s) => s.workouts);
  const addSession = useTraining((s) => s.addSession);
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
    <Screen title="Overload" subtitle={formatDay(today)}>
      {sessions.length === 0 ? (
        <Empty
          icon="barbell-outline"
          title="Set up your split"
          text="Add your first session (for example Push day), then write in its exercises and sets."
        />
      ) : (
        <Text style={[T.label, { marginBottom: 10, marginTop: 6 }]}>Your split</Text>
      )}

      {sessions.map((s) => {
        const w = last.get(s.id);
        const total = s.exercises.reduce((n, e) => n + e.sets.length, 0);
        const doneToday = w && w.date === today ? w.sets.length : 0;
        const change = w ? dayChange(w.sets) : null;
        return (
          <Pressable
            key={s.id}
            onPress={() => onOpen(s.id, false)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.sessionCard, pressed && { opacity: 0.7 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.sessionName} numberOfLines={1}>
                {s.name}
              </Text>
              <Text style={[T.muted, { marginTop: 2 }]}>
                {s.exercises.length} {s.exercises.length === 1 ? 'exercise' : 'exercises'} · {total}{' '}
                {total === 1 ? 'set' : 'sets'}
              </Text>
              <View style={styles.sessionStatus}>
                {w ? <View style={[styles.dot, { backgroundColor: changeColor(change) }]} /> : null}
                {doneToday > 0 ? (
                  <Text style={[T.muted, { color: C.overload, fontWeight: '700' }]}>
                    Today · {doneToday} of {total} sets done
                  </Text>
                ) : w ? (
                  <Text style={T.muted}>
                    Last time {agoLabel(w.date, today)} · {change ? CHANGE_WORD[change] : ''}
                  </Text>
                ) : (
                  <Text style={T.muted}>Not logged yet</Text>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color={C.faint} />
          </Pressable>
        );
      })}

      <GhostButton
        label="Add session"
        icon="add"
        color={C.overload}
        onPress={() => setAdding(true)}
        style={{ marginTop: 6 }}
      />

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
        <PrimaryButton
          label="Add and write its exercises"
          color={C.overload}
          onPress={create}
          disabled={!name.trim()}
          style={{ marginTop: 18 }}
        />
      </Sheet>
    </Screen>
  );
}

// ───────────────────────── One session: exercises and their sets ─────────────────────────

function SessionView({ session, startInEdit, onBack }: { session: Session; startInEdit: boolean; onBack: () => void }) {
  const today = useToday();
  const [edit, setEdit] = useState(startInEdit);
  const [wheel, setWheel] = useState<{ exId: string; index: number } | null>(null);
  const [fresh, setFresh] = useState<string | null>(null); // the exercise just added: its name box gets the keyboard

  const workouts = useTraining((s) => s.workouts);
  const t = useTraining.getState(); // the actions never change

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

  return (
    <Screen
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
          <Text style={[T.title, { fontSize: 26 }]} numberOfLines={1}>
            {session.name || 'Session'}
          </Text>
        )
      }
      subtitle={edit ? undefined : done > 0 ? `Today · ${done} of ${total} sets done` : undefined}
      right={
        <Pressable
          onPress={() => {
            buzz();
            setEdit(!edit);
            setFresh(null);
          }}
          accessibilityRole="button"
          style={[styles.editPill, edit && { backgroundColor: C.overload }]}
        >
          <Text style={[styles.editText, edit && { color: C.ink }]}>{edit ? 'Done' : 'Edit'}</Text>
        </Pressable>
      }
    >
      {session.exercises.length === 0 && !edit ? (
        <Empty icon="create-outline" title="No exercises yet" text="Tap Edit to write in this session's exercises." />
      ) : null}

      {session.exercises.map((ex, exIndex) => (
        <Card key={ex.id} style={styles.exercise}>
          {edit ? (
            <View style={styles.exHead}>
              <TextInput
                value={ex.name}
                onChangeText={(v) => t.renameExercise(session.id, ex.id, v)}
                placeholder="Exercise name"
                placeholderTextColor={C.faint}
                keyboardAppearance="dark"
                autoFocus={fresh === ex.id}
                style={styles.exInput}
                maxLength={60}
              />
              <IconButton
                icon="arrow-up"
                size={19}
                color={C.muted}
                label="Move up"
                disabled={exIndex === 0}
                onPress={() => t.moveExercise(session.id, ex.id, -1)}
              />
              <IconButton
                icon="arrow-down"
                size={19}
                color={C.muted}
                label="Move down"
                disabled={exIndex === session.exercises.length - 1}
                onPress={() => t.moveExercise(session.id, ex.id, 1)}
              />
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
          ) : (
            <Text style={styles.exName}>{ex.name || 'Untitled exercise'}</Text>
          )}

          {ex.sets.map((s, i) => (
            <SetRow
              key={i}
              index={i}
              set={s}
              logged={loggedSet(ex.id, i)}
              edit={edit}
              onNumbers={() => setWheel({ exId: ex.id, index: i })}
              onTick={() => {
                const lg = loggedSet(ex.id, i);
                if (lg) {
                  buzz();
                  t.unlogSet(session.id, ex.id, i, today);
                } else if (isBlank(s)) {
                  setWheel({ exId: ex.id, index: i });
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
              label="Add set"
              icon="add"
              color={C.overload}
              outlined={false}
              onPress={() => t.addSet(session.id, ex.id)}
              style={{ alignSelf: 'flex-start', height: 40, paddingHorizontal: 4 }}
            />
          ) : null}
        </Card>
      ))}

      {edit ? (
        <>
          <GhostButton
            label="Add exercise"
            icon="add"
            color={C.overload}
            onPress={() => setFresh(t.addExercise(session.id))}
            style={{ marginTop: 4 }}
          />
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
            style={{ marginTop: 18 }}
          />
        </>
      ) : session.exercises.length > 0 ? (
        <Text style={[T.small, { textAlign: 'center', marginTop: 10, lineHeight: 18 }]}>
          Tap the numbers to change them with the wheel.{'\n'}Tap the circle when a set is done as written.
        </Text>
      ) : null}

      {wheel && wheelEx && wheelSet ? (
        <SetWheelSheet
          key={wheel.exId + ':' + wheel.index}
          title={wheelEx.name || 'Exercise'}
          subtitle={
            edit
              ? `Set ${wheel.index + 1} · starting numbers`
              : wheelLogged
                ? `Set ${wheel.index + 1} · logged today` +
                  (wheelLogged.prev ? ` · last time ${formatWeight(wheelLogged.prev.weight)} kg × ${wheelLogged.prev.reps}` : '')
                : isBlank(wheelSet)
                  ? `Set ${wheel.index + 1}`
                  : `Set ${wheel.index + 1} · last time ${formatWeight(wheelSet.weight)} kg × ${wheelSet.reps}`
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

function SetRow({
  index,
  set,
  logged,
  edit,
  onNumbers,
  onTick,
  onRemove,
}: {
  index: number;
  set: SetVal;
  logged: Workout['sets'][number] | undefined;
  edit: boolean;
  onNumbers: () => void;
  onTick: () => void;
  onRemove: () => void;
}) {
  const change = logged ? compareSet(logged, logged.prev) : null;
  const color = changeColor(change);
  const delta = logged ? describeChange(logged, logged.prev) : '';
  return (
    <View style={styles.setRow}>
      <Text style={styles.setIndex}>{index + 1}</Text>
      <Pressable
        onPress={onNumbers}
        accessibilityRole="button"
        accessibilityLabel={`Set ${index + 1}: ${formatWeight(set.weight)} kilos for ${set.reps} reps. Tap to change.`}
        style={({ pressed }) => [styles.numbers, pressed && { opacity: 0.6 }]}
      >
        <View style={styles.pill}>
          <Text style={styles.num}>{formatWeight(set.weight)}</Text>
          <Text style={styles.unit}>kg</Text>
        </View>
        <Text style={styles.times}>×</Text>
        <View style={styles.pill}>
          <Text style={styles.num}>{set.reps}</Text>
          <Text style={styles.unit}>reps</Text>
        </View>
      </Pressable>
      <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 8 }}>
        {!edit && logged ? (
          <Text style={[styles.delta, { color }]} numberOfLines={2}>
            {delta.replace(' · ', '\n') || (change === 'same' ? 'same' : '')}
          </Text>
        ) : null}
      </View>
      {edit ? (
        <IconButton icon="remove-circle-outline" color={C.down} label={`Remove set ${index + 1}`} onPress={onRemove} />
      ) : (
        <Pressable
          onPress={onTick}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!logged }}
          accessibilityLabel={`Set ${index + 1} done`}
          style={styles.tick}
        >
          <Ionicons
            name={logged ? 'checkmark-circle' : 'ellipse-outline'}
            size={30}
            color={logged ? color : C.faint}
          />
        </Pressable>
      )}
    </View>
  );
}

// ───────────────────────── The wheel: kg, quarter kg, reps ─────────────────────────

const KG = range(0, 400);
const QUARTERS = [0, 0.25, 0.5, 0.75];
const REPS = range(0, 60);

function SetWheelSheet({
  title,
  subtitle,
  initial,
  action,
  onSave,
  onClose,
}: {
  title: string;
  subtitle: string;
  initial: SetVal;
  action: string;
  onSave: (v: SetVal) => void;
  onClose: () => void;
}) {
  const start = splitWeight(initial.weight);
  const [whole, setWhole] = useState(Math.min(start.whole, 400));
  const [quarter, setQuarter] = useState(start.quarter);
  const [reps, setReps] = useState(Math.min(initial.reps, 60));
  return (
    <Sheet visible onClose={onClose} title={title} subtitle={subtitle}>
      <WheelRow>
        <WheelColumn label="kg" values={KG} value={whole} onChange={setWhole} flex={1.25} />
        <WheelColumn
          label="+"
          values={QUARTERS}
          value={quarter}
          onChange={setQuarter}
          format={(v) => (v === 0 ? '.0' : '.' + String(v).slice(2))}
        />
        <WheelColumn label="reps" values={REPS} value={reps} onChange={setReps} flex={1.25} />
      </WheelRow>
      <PrimaryButton label={action} color={C.overload} onPress={() => onSave({ weight: whole + quarter, reps })} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sessionCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sessionName: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  sessionStatus: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },

  titleInput: {
    minWidth: 0,
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
    backgroundColor: C.card2,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
  },
  editPill: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: C.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: { color: C.text, fontSize: 15, fontWeight: '700' },

  exercise: { marginBottom: 10, paddingVertical: 14, paddingRight: 10 },
  exName: { color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  exHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  exInput: {
    flex: 1,
    minWidth: 0,
    color: C.text,
    fontSize: 17,
    fontWeight: '700',
    backgroundColor: C.card2,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 42,
    marginRight: 2,
  },

  setRow: { flexDirection: 'row', alignItems: 'center', height: 48 },
  setIndex: { width: 22, color: C.faint, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  numbers: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    backgroundColor: C.card2,
    borderRadius: 10,
    paddingHorizontal: 11,
    height: 38,
    paddingTop: 6,
    minWidth: 64,
    justifyContent: 'center',
  },
  num: { color: C.text, fontSize: 19, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { color: C.muted, fontSize: 13 },
  times: { color: C.faint, fontSize: 15 },
  delta: { fontSize: 13, lineHeight: 16, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] },
  tick: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
});
