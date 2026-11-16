// While something is being dragged (a session being reordered), the page and the tab swiping hold still.

import { create } from 'zustand';

export const usePageLock = create<{ locked: boolean; setLocked: (v: boolean) => void }>((set) => ({
  locked: false,
  setLocked: (locked) => set({ locked }),
}));
