import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

// Everything is kept on the phone.
export const phoneStorage = createJSONStorage(() => AsyncStorage);

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
