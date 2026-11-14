// While something is being dragged (a session being reordered), the page and the tab swiping hold still.

import { create } from 'zustand';

export const usePageLock = create<{ locked: boolean; setLocked: (v: boolean) => void }>((set) => ({
  locked: false,
  setLocked: (locked) => set({ locked }),
}));

// Swiping right on the first section while a session is open goes back to the split (as the iPhone's own
// "swipe back"). The open session leaves its "go back" here; the pager calls it.
export const backSwipe: { handler: (() => void) | null } = { handler: null };
