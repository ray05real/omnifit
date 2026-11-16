// The split (sessions and their exercises) and every workout that's been logged.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DateKey } from '../lib/dates';
import { isBlank, type CardioMetric, type ExerciseKind, type SetVal, type Workout } from '../lib/overload';
import { phoneStorage, uid } from './persist';

// An exercise's sets always show the last numbers done, like the owner's notes.
// A cardio exercise (bike, rower…) keeps minutes in `weight` and its metric (watts by default) in `reps`.
//
// Options (the owner, 16 Nov 2026): other versions of the same exercise, e.g. "Preacher curl" and "Single-arm
// preacher curl". Each has its own id and remembers its own numbers; the one being done shows in the
// exercise's own name / sets, the others wait in `alts`. Swapping trades them over, even halfway through.
// Logged sets carry the option's id, so each option has its own history in Metrics.
export type ExerciseOption = { id: string; name: string; sets: SetVal[] };
export type Exercise = {
  id: string; // the exercise's place in the session (stays the same whichever option is showing)
  name: string; // the option showing now
  sets: SetVal[];
  kind?: ExerciseKind;
  metric?: CardioMetric;
  vid?: string; // the id of the option showing now (missing = the exercise's own id: the first option)
  alts?: ExerciseOption[]; // the other options
  order?: string[]; // every option's id, in the order they were added
};

// The id the option showing now logs its sets under.
export function optionId(ex: Exercise): string {
  return ex.vid ?? ex.id;
}

// Every option of an exercise, the one showing now included, in the order they were added.
export function optionsOf(ex: Exercise): ExerciseOption[] {
  const all = [{ id: optionId(ex), name: ex.name, sets: ex.sets }, ...(ex.alts ?? [])];
  const order = ex.order ?? [];
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i < 0 ? order.length : i;
  };
  return all.sort((a, b) => rank(a.id) - rank(b.id));
}
export type Session = { id: string; name: string; exercises: Exercise[] };

type State = {
  sessions: Session[];
  workouts: Workout[];

  addSession: (name: string) => string;
  renameSession: (id: string, name: string) => void;
  deleteSession: (id: string) => void;
  moveSession: (from: number, to: number) => void;
  addExercise: (sessionId: string, kind?: ExerciseKind) => string;
  setMetric: (sessionId: string, exId: string, metric: CardioMetric) => void;
  renameExercise: (sessionId: string, exId: string, name: string) => void;
  deleteExercise: (sessionId: string, exId: string) => void;
  moveExercise: (sessionId: string, from: number, to: number) => void;
  addOption: (sessionId: string, exId: string) => string; // a new, empty option, shown straight away
  switchOption: (sessionId: string, exId: string, optionId: string) => void;
  removeOption: (sessionId: string, exId: string, optionId: string) => void; // not the one showing
  addSet: (sessionId: string, exId: string) => void;
  removeSet: (sessionId: string, exId: string, index: number, today: DateKey) => void;
  // Edit mode: change a set's numbers without logging a workout.
  setNumbers: (sessionId: string, exId: string, index: number, val: SetVal) => void;
  // Mark a set done on `date` with these numbers (or change what was logged).
  logSet: (sessionId: string, exId: string, index: number, val: SetVal, date: DateKey) => void;
  unlogSet: (sessionId: string, exId: string, index: number, date: DateKey) => void;
};

// What a logged set remembers about the kind of exercise it was (nothing extra for strength).
function kindOf(ex: Exercise): { kind?: ExerciseKind; metric?: CardioMetric } {
  return ex.kind === 'cardio' ? { kind: 'cardio', metric: ex.metric ?? 'W' } : {};
}

function mapExercise(sessions: Session[], sessionId: string, exId: string, fn: (e: Exercise) => Exercise): Session[] {
  return sessions.map((s) =>
    s.id !== sessionId ? s : { ...s, exercises: s.exercises.map((e) => (e.id !== exId ? e : fn(e))) },
  );
}

export const useTraining = create<State>()(
  persist(
    (set) => ({
      sessions: [],
      workouts: [],

      addSession: (name) => {
        const id = uid();
        set((st) => ({ sessions: [...st.sessions, { id, name, exercises: [] }] }));
        return id;
      },

      renameSession: (id, name) =>
        set((st) => ({ sessions: st.sessions.map((s) => (s.id === id ? { ...s, name } : s)) })),

      // The workouts already logged stay in the history (they keep the session's name).
      deleteSession: (id) => set((st) => ({ sessions: st.sessions.filter((s) => s.id !== id) })),

      moveSession: (from, to) =>
        set((st) => {
          if (from === to || from < 0 || to < 0 || from >= st.sessions.length || to >= st.sessions.length) return st;
          const sessions = st.sessions.slice();
          const [moved] = sessions.splice(from, 1);
          sessions.splice(to, 0, moved);
          return { sessions };
        }),

      addExercise: (sessionId, kind = 'strength') => {
        const id = uid();
        const blank = (): SetVal => ({ weight: 0, reps: 0 });
        const exercise: Exercise =
          kind === 'cardio'
            ? { id, name: '', sets: [blank()], kind: 'cardio', metric: 'W' }
            : { id, name: '', sets: [blank(), blank(), blank()] };
        set((st) => ({
          sessions: st.sessions.map((s) => (s.id !== sessionId ? s : { ...s, exercises: [...s.exercises, exercise] })),
        }));
        return id;
      },

      setMetric: (sessionId, exId, metric) =>
        set((st) => ({ sessions: mapExercise(st.sessions, sessionId, exId, (e) => ({ ...e, metric })) })),

      renameExercise: (sessionId, exId, name) =>
        set((st) => ({ sessions: mapExercise(st.sessions, sessionId, exId, (e) => ({ ...e, name })) })),

      deleteExercise: (sessionId, exId) =>
        set((st) => ({
          sessions: st.sessions.map((s) =>
            s.id !== sessionId ? s : { ...s, exercises: s.exercises.filter((e) => e.id !== exId) },
          ),
        })),

      moveExercise: (sessionId, from, to) =>
        set((st) => ({
          sessions: st.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            if (from === to || from < 0 || to < 0 || from >= s.exercises.length || to >= s.exercises.length) return s;
            const exercises = s.exercises.slice();
            const [moved] = exercises.splice(from, 1);
            exercises.splice(to, 0, moved);
            return { ...s, exercises };
          }),
        })),

      addOption: (sessionId, exId) => {
        const id = uid();
        set((st) => ({
          sessions: mapExercise(st.sessions, sessionId, exId, (e) => {
            const current: ExerciseOption = { id: optionId(e), name: e.name, sets: e.sets };
            return {
              ...e,
              vid: id,
              name: '',
              // As many sets as the one it's an option of; its numbers are its own, so they start empty.
              sets: e.sets.map(() => ({ weight: 0, reps: 0 })),
              alts: [...(e.alts ?? []), current],
              order: [...(e.order ?? [current.id]), id],
            };
          }),
        }));
        return id;
      },

      switchOption: (sessionId, exId, target) =>
        set((st) => ({
          sessions: mapExercise(st.sessions, sessionId, exId, (e) => {
            const next = (e.alts ?? []).find((a) => a.id === target);
            if (!next || target === optionId(e)) return e;
            const current: ExerciseOption = { id: optionId(e), name: e.name, sets: e.sets };
            return {
              ...e,
              vid: next.id,
              name: next.name,
              sets: next.sets,
              alts: [...(e.alts ?? []).filter((a) => a.id !== target), current],
              order: e.order ?? [current.id, ...(e.alts ?? []).map((a) => a.id)],
            };
          }),
        })),

      // What was already logged with it stays in Metrics.
      removeOption: (sessionId, exId, target) =>
        set((st) => ({
          sessions: mapExercise(st.sessions, sessionId, exId, (e) =>
            target === optionId(e)
              ? e
              : {
                  ...e,
                  alts: (e.alts ?? []).filter((a) => a.id !== target),
                  order: (e.order ?? []).filter((id) => id !== target),
                },
          ),
        })),

      // A new set starts from the numbers of the one above it.
      addSet: (sessionId, exId) =>
        set((st) => ({
          sessions: mapExercise(st.sessions, sessionId, exId, (e) => {
            const last = e.sets[e.sets.length - 1];
            return { ...e, sets: [...e.sets, last ? { ...last } : { weight: 0, reps: 0 }] };
          }),
        })),

      removeSet: (sessionId, exId, index, today) =>
        set((st) => {
          const ex = st.sessions.find((s) => s.id === sessionId)?.exercises.find((e) => e.id === exId);
          const oid = ex ? optionId(ex) : exId;
          return {
          sessions: mapExercise(st.sessions, sessionId, exId, (e) => ({
            ...e,
            sets: e.sets.filter((_, i) => i !== index),
          })),
          // Keep today's ticks lined up with the sets that are left.
          workouts: st.workouts
            .map((w) =>
              w.date !== today || w.sessionId !== sessionId
                ? w
                : {
                    ...w,
                    sets: w.sets
                      .filter((s) => !(s.exerciseId === oid && s.setIndex === index))
                      .map((s) =>
                        s.exerciseId === oid && s.setIndex > index ? { ...s, setIndex: s.setIndex - 1 } : s,
                      ),
                  },
            )
            .filter((w) => w.sets.length > 0),
          };
        }),

      setNumbers: (sessionId, exId, index, val) =>
        set((st) => ({
          sessions: mapExercise(st.sessions, sessionId, exId, (e) => ({
            ...e,
            sets: e.sets.map((s, i) => (i === index ? { ...val } : s)),
          })),
        })),

      logSet: (sessionId, exId, index, val, date) =>
        set((st) => {
          const session = st.sessions.find((s) => s.id === sessionId);
          const ex = session?.exercises.find((e) => e.id === exId);
          if (!session || !ex || !ex.sets[index]) return st;
          const before = ex.sets[index];
          const oid = optionId(ex);

          const workouts = st.workouts.slice();
          let wi = workouts.findIndex((w) => w.date === date && w.sessionId === sessionId);
          if (wi < 0) {
            workouts.push({ id: uid(), date, sessionId, sessionName: session.name, sets: [] });
            wi = workouts.length - 1;
          }
          const w = { ...workouts[wi], sessionName: session.name, sets: workouts[wi].sets.slice() };
          const si = w.sets.findIndex((s) => s.exerciseId === oid && s.setIndex === index);
          if (si >= 0) {
            // Changing a set already logged today: what it's compared with stays the last time's numbers.
            w.sets[si] = { ...w.sets[si], exerciseName: ex.name, weight: val.weight, reps: val.reps, ...kindOf(ex) };
          } else {
            w.sets.push({
              exerciseId: oid,
              exerciseName: ex.name,
              setIndex: index,
              weight: val.weight,
              reps: val.reps,
              prev: isBlank(before) ? null : { ...before },
              ...kindOf(ex),
            });
          }
          workouts[wi] = w;

          return {
            workouts,
            sessions: mapExercise(st.sessions, sessionId, exId, (e) => ({
              ...e,
              sets: e.sets.map((s, i) => (i === index ? { ...val } : s)),
            })),
          };
        }),

      // Un-tick: the set goes back to last time's numbers.
      unlogSet: (sessionId, exId, index, date) =>
        set((st) => {
          const w = st.workouts.find((x) => x.date === date && x.sessionId === sessionId);
          const ex = st.sessions.find((s) => s.id === sessionId)?.exercises.find((e) => e.id === exId);
          const oid = ex ? optionId(ex) : exId;
          const logged = w?.sets.find((s) => s.exerciseId === oid && s.setIndex === index);
          if (!w || !logged) return st;
          const sets = w.sets.filter((s) => s !== logged);
          const prev = logged.prev;
          return {
            workouts:
              sets.length === 0
                ? st.workouts.filter((x) => x !== w)
                : st.workouts.map((x) => (x === w ? { ...w, sets } : x)),
            sessions: prev
              ? mapExercise(st.sessions, sessionId, exId, (e) => ({
                  ...e,
                  sets: e.sets.map((s, i) => (i === index ? { ...prev } : s)),
                }))
              : st.sessions,
          };
        }),
    }),
    {
      name: 'omnifit-training',
      version: 1,
      storage: phoneStorage,
      partialize: (st) => ({ sessions: st.sessions, workouts: st.workouts }),
    },
  ),
);
