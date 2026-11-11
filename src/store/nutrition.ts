// Daily goals, the owner's own food catalogue ("My foods") and everything eaten.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Food, FoodEntry, Macros } from '../lib/nutrition';
import { phoneStorage, uid } from './persist';

type State = {
  goals: Macros;
  goalsSet: boolean; // false until the owner has typed their own goals
  foods: Food[];
  entries: FoodEntry[];

  setGoals: (g: Macros) => void;
  addFood: (f: Omit<Food, 'id' | 'lastUsed'>) => string;
  updateFood: (id: string, f: Omit<Food, 'id' | 'lastUsed'>) => void;
  deleteFood: (id: string) => void;
  addEntry: (e: Omit<FoodEntry, 'id'>) => void;
  updateEntry: (id: string, patch: Partial<FoodEntry>) => void;
  deleteEntry: (id: string) => void;
};

export const useNutrition = create<State>()(
  persist(
    (set) => ({
      goals: { kcal: 2500, protein: 160, carbs: 300, fat: 70 },
      goalsSet: false,
      foods: [],
      entries: [],

      setGoals: (goals) => set({ goals, goalsSet: true }),

      addFood: (f) => {
        const id = uid();
        set((st) => ({ foods: [...st.foods, { ...f, id, lastUsed: Date.now() }] }));
        return id;
      },

      updateFood: (id, f) =>
        set((st) => ({ foods: st.foods.map((x) => (x.id === id ? { ...x, ...f } : x)) })),

      // What was already logged from it stays in the days' logs.
      deleteFood: (id) => set((st) => ({ foods: st.foods.filter((x) => x.id !== id) })),

      addEntry: (e) =>
        set((st) => ({
          entries: [...st.entries, { ...e, id: uid() }],
          // The foods used most recently come first in My foods.
          foods: e.foodId ? st.foods.map((f) => (f.id === e.foodId ? { ...f, lastUsed: Date.now() } : f)) : st.foods,
        })),

      updateEntry: (id, patch) =>
        set((st) => ({ entries: st.entries.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

      deleteEntry: (id) => set((st) => ({ entries: st.entries.filter((x) => x.id !== id) })),
    }),
    {
      name: 'omnifit-nutrition',
      version: 1,
      storage: phoneStorage,
      partialize: (st) => ({ goals: st.goals, goalsSet: st.goalsSet, foods: st.foods, entries: st.entries }),
    },
  ),
);
