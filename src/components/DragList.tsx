// A list whose rows you press and hold, then drag up or down to reorder (as on the iPhone's Home Screen).
// A quick tap still opens the row, and buttons inside a row still work. Rows may have different heights
// (exercises with more or fewer sets). While a row is being dragged, the page and the tabs stop scrolling.

import React, { useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet } from 'react-native';

import { usePageLock } from '../store/pageLock';
import { C } from '../theme';
import { buzz } from './ui';

const HOLD_MS = 320; // how long to hold before the row lifts
const SLOP = 8; // moving more than this before the hold ends means "scrolling", not "holding"

type Layout = { heights: number[]; tops: number[]; total: number };

export function DragList<T>({
  items,
  keyOf,
  renderRow,
  onPress,
  onReorder,
  highlight = true,
}: {
  items: T[];
  keyOf: (item: T) => string;
  renderRow: (item: T, state: { lifted: boolean; last: boolean; index: number }) => React.ReactNode;
  onPress?: (item: T) => void;
  onReorder: (from: number, to: number) => void;
  highlight?: boolean; // light the row up while it is touched (for rows that are buttons)
}) {
  const [drag, setDrag] = useState<{ from: number; to: number; height: number } | null>(null);
  const dy = useRef(new Animated.Value(0)).current;
  const setLocked = usePageLock((s) => s.setLocked);
  const heights = useRef(new Map<string, number>()).current;
  const layout = useRef<Layout>({ heights: [], tops: [], total: 0 });

  // Where every row is, measured at the moment one is lifted.
  const measure = () => {
    const hs = items.map((it) => heights.get(keyOf(it)) ?? 0);
    const tops: number[] = [];
    let y = 0;
    for (const h of hs) {
      tops.push(y);
      y += h;
    }
    layout.current = { heights: hs, tops, total: y };
  };

  // For a finger moved by `move` since the lift: how far the row may go, and which place it is over.
  const place = (from: number, move: number) => {
    const { heights: hs, tops, total } = layout.current;
    const clamped = Math.max(-tops[from], Math.min(total - tops[from] - hs[from], move));
    const top = tops[from] + clamped;
    const bottom = top + hs[from];
    let to = from;
    // It takes a row's place once its leading edge passes that row's middle.
    for (let j = from + 1; j < hs.length; j++) if (bottom > tops[j] + hs[j] / 2) to = j;
    for (let j = from - 1; j >= 0; j--) if (top < tops[j] + hs[j] / 2) to = j;
    return { clamped, to };
  };

  return (
    <>
      {items.map((item, i) => {
        const key = keyOf(item);
        // The rows between where the dragged one came from and where it is now step aside.
        let shift = 0;
        if (drag && i !== drag.from) {
          if (drag.from < i && i <= drag.to) shift = -drag.height;
          else if (drag.to <= i && i < drag.from) shift = drag.height;
        }
        const lifted = drag?.from === i;
        return (
          <DragRow
            key={key}
            lifted={lifted}
            shift={shift}
            dy={dy}
            highlight={highlight}
            onHeight={(h) => heights.set(key, h)}
            place={(move) => place(i, move)}
            onTap={onPress ? () => onPress(item) : undefined}
            onLift={() => {
              measure();
              buzz('done');
              dy.setValue(0);
              setLocked(true);
              setDrag({ from: i, to: i, height: layout.current.heights[i] });
            }}
            onMove={(to) => setDrag((d) => (d && d.to !== to ? { ...d, to } : d))}
            onDrop={(to, moved) => {
              setLocked(false);
              setDrag(null);
              dy.setValue(0);
              if (moved && to !== i) onReorder(i, to);
            }}
          >
            {renderRow(item, { lifted, last: i === items.length - 1, index: i })}
          </DragRow>
        );
      })}
    </>
  );
}

function DragRow({
  lifted,
  shift,
  dy,
  highlight,
  onHeight,
  place,
  onTap,
  onLift,
  onMove,
  onDrop,
  children,
}: {
  lifted: boolean;
  shift: number;
  dy: Animated.Value;
  highlight: boolean;
  onHeight: (h: number) => void;
  place: (move: number) => { clamped: number; to: number };
  onTap?: () => void;
  onLift: () => void;
  onMove: (to: number) => void;
  onDrop: (to: number, moved: boolean) => void;
  children: React.ReactNode;
}) {
  // The gesture handlers are made once, so they read the latest values from here.
  const p = useRef({ place, onTap, onLift, onMove, onDrop });
  p.current = { place, onTap, onLift, onMove, onDrop };
  const g = useRef({ active: false, moved: false, to: -1, timer: null as ReturnType<typeof setTimeout> | null });
  const [pressed, setPressed] = useState(false);

  const clear = () => {
    if (g.current.timer) clearTimeout(g.current.timer);
    g.current.timer = null;
  };

  const responder = useRef(
    PanResponder.create({
      // A button inside the row (a set's numbers, a tick) gets the touch first; everything else starts here.
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        g.current = { active: false, moved: false, to: -1, timer: null };
        setPressed(true);
        g.current.timer = setTimeout(() => {
          g.current.timer = null;
          if (g.current.moved) return;
          g.current.active = true;
          p.current.onLift();
        }, HOLD_MS);
      },
      onPanResponderMove: (_, s) => {
        if (!g.current.active) {
          if (Math.abs(s.dx) > SLOP || Math.abs(s.dy) > SLOP) {
            g.current.moved = true; // a scroll or a swipe: let the page have it
            clear();
            setPressed(false);
          }
          return;
        }
        const { clamped, to } = p.current.place(s.dy);
        dy.setValue(clamped);
        if (to !== g.current.to) {
          if (g.current.to !== -1) buzz();
          g.current.to = to;
          p.current.onMove(to);
        }
      },
      // Once a row is lifted nothing else may take the touch away.
      onPanResponderTerminationRequest: () => !g.current.active,
      onPanResponderRelease: () => {
        clear();
        setPressed(false);
        if (g.current.active) {
          g.current.active = false;
          p.current.onDrop(g.current.to, g.current.to !== -1);
        } else if (!g.current.moved) p.current.onTap?.();
      },
      onPanResponderTerminate: () => {
        clear();
        setPressed(false);
        if (g.current.active) {
          g.current.active = false;
          p.current.onDrop(g.current.to, false);
        }
      },
    }),
  ).current;

  return (
    <Animated.View
      {...responder.panHandlers}
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
      accessibilityHint="Press and hold, then drag to reorder."
      style={[
        lifted ? [styles.lifted, { transform: [{ translateY: dy }, { scale: 1.02 }] }] : { transform: [{ translateY: shift }] },
        highlight && pressed && !lifted && { backgroundColor: 'rgba(255,255,255,0.08)' },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lifted: {
    zIndex: 10,
    backgroundColor: C.card2,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
