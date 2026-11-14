// The split (sessions and their exercises) and every workout that's been logged.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DateKey } from '../lib/dates';
import { isBlank, type SetVal, type Workout } from '../lib/overload';
import { phoneStorage, uid } from './persist';

// An exercise's sets always show the last numbers done, like the owner's notes.
export type Exercise = { id: string; name: string; sets: SetVal[] };
export type Session = { id: string; name: string; exercises: Exercise[] };

type State = {
  sessions: Session[];
  workouts: Workout[];

  addSession: (name: string) => string;
  renameSession: (id: string, name: string) => void;
  deleteSession: (id: string) => void;
  moveSession: (from: number, to: number) => void;
  addExercise: (sessionId: string) => string;
  renameExercise: (sessionId: string, exId: string, name: string) => void;
  deleteExercise: (sessionId: string, exId: string) => void;
  moveExercise: (sessionId: string, exId: string, dir: -1 | 1) => void;
  addSet: (sessionId: string, exId: string) => void;
  removeSet: (sessionId: string, exId: string, index: number, today: DateKey) => void;
  // Edit mode: change a set's numbers without logging a workout.
  setNumbers: (sessionId: string, exId: string, index: number, val: SetVal) => void;
  // Mark a set done on `date` with these numbers (or change what was logged).
  logSet: (sessionId: string, exId: string, index: number, val: SetVal, date: DateKey) => void;
  unlogSet: (sessionId: string, exId: string, index: number, date: DateKey) => void;
};

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

      addExercise: (sessionId) => {
        const id = uid();
        const blank = (): SetVal => ({ weight: 0, reps: 0 });
        set((st) => ({
          sessions: st.sessions.map((s) =>
            s.id !== sessionId
              ? s
              : { ...s, exercises: [...s.exercises, { id, name: '', sets: [blank(), blank(), blank()] }] },
          ),
        }));
        return id;
      },

      renameExercise: (sessionId, exId, name) =>
        set((st) => ({ sessions: mapExercise(st.sessions, sessionId, exId, (e) => ({ ...e, name })) })),

      deleteExercise: (sessionId, exId) =>
        set((st) => ({
          sessions: st.sessions.map((s) =>
            s.id !== sessionId ? s : { ...s, exercises: s.exercises.filter((e) => e.id !== exId) },
          ),
        })),

      moveExercise: (sessionId, exId, dir) =>
        set((st) => ({
          sessions: st.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            const i = s.exercises.findIndex((e) => e.id === exId);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= s.exercises.length) return s;
            const exercises = s.exercises.slice();
            [exercises[i], exercises[j]] = [exercises[j], exercises[i]];
            return { ...s, exercises };
          }),
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
        set((st) => ({
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
                      .filter((s) => !(s.exerciseId === exId && s.setIndex === index))
                      .map((s) =>
                        s.exerciseId === exId && s.setIndex > index ? { ...s, setIndex: s.setIndex - 1 } : s,
                      ),
                  },
            )
            .filter((w) => w.sets.length > 0),
        })),

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

          const workouts = st.workouts.slice();
          let wi = workouts.findIndex((w) => w.date === date && w.sessionId === sessionId);
          if (wi < 0) {
            workouts.push({ id: uid(), date, sessionId, sessionName: session.name, sets: [] });
            wi = workouts.length - 1;
          }
          const w = { ...workouts[wi], sessionName: session.name, sets: workouts[wi].sets.slice() };
          const si = w.sets.findIndex((s) => s.exerciseId === exId && s.setIndex === index);
          if (si >= 0) {
            // Changing a set already logged today: what it's compared with stays the last time's numbers.
            w.sets[si] = { ...w.sets[si], exerciseName: ex.name, weight: val.weight, reps: val.reps };
          } else {
            w.sets.push({
              exerciseId: exId,
              exerciseName: ex.name,
              setIndex: index,
              weight: val.weight,
              reps: val.reps,
              prev: isBlank(before) ? null : { ...before },
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
          const logged = w?.sets.find((s) => s.exerciseId === exId && s.setIndex === index);
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
