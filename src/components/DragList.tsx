// A list whose rows you press and hold, then drag up or down to reorder (as on the iPhone's Home Screen).
// A quick tap still opens the row. While a row is being dragged, the page and the tabs stop scrolling.

import React, { useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { usePageLock } from '../store/pageLock';
import { C } from '../theme';
import { buzz } from './ui';

const HOLD_MS = 320; // how long to hold before the row lifts
const SLOP = 8; // moving more than this before the hold ends means "scrolling", not "holding"

export function DragList<T>({
  items,
  rowHeight,
  keyOf,
  renderRow,
  onPress,
  onReorder,
}: {
  items: T[];
  rowHeight: number;
  keyOf: (item: T) => string;
  renderRow: (item: T) => React.ReactNode;
  onPress: (item: T) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const dy = useRef(new Animated.Value(0)).current;
  const setLocked = usePageLock((s) => s.setLocked);

  return (
    <View>
      {items.map((item, i) => {
        // The rows between where the dragged one came from and where it is now step aside.
        let shift = 0;
        if (drag && i !== drag.from) {
          if (drag.from < i && i <= drag.to) shift = -rowHeight;
          else if (drag.to <= i && i < drag.from) shift = rowHeight;
        }
        return (
          <DragRow
            key={keyOf(item)}
            index={i}
            count={items.length}
            rowHeight={rowHeight}
            lifted={drag?.from === i}
            shift={shift}
            dy={dy}
            last={i === items.length - 1}
            onTap={() => onPress(item)}
            onLift={() => {
              buzz('done');
              dy.setValue(0);
              setLocked(true);
              setDrag({ from: i, to: i });
            }}
            onMove={(to) => setDrag((d) => (d && d.to !== to ? { from: d.from, to } : d))}
            onDrop={(to, moved) => {
              setLocked(false);
              setDrag(null);
              dy.setValue(0);
              if (moved && to !== i) onReorder(i, to);
            }}
          >
            {renderRow(item)}
          </DragRow>
        );
      })}
    </View>
  );
}

function DragRow({
  index,
  count,
  rowHeight,
  lifted,
  shift,
  dy,
  last,
  onTap,
  onLift,
  onMove,
  onDrop,
  children,
}: {
  index: number;
  count: number;
  rowHeight: number;
  lifted: boolean;
  shift: number;
  dy: Animated.Value;
  last: boolean;
  onTap: () => void;
  onLift: () => void;
  onMove: (to: number) => void;
  onDrop: (to: number, moved: boolean) => void;
  children: React.ReactNode;
}) {
  // The gesture handlers are made once, so they read the latest values from here.
  const p = useRef({ index, count, rowHeight, onTap, onLift, onMove, onDrop });
  p.current = { index, count, rowHeight, onTap, onLift, onMove, onDrop };
  const g = useRef({ active: false, moved: false, to: 0, timer: null as ReturnType<typeof setTimeout> | null });
  const [pressed, setPressed] = useState(false);

  const clear = () => {
    if (g.current.timer) clearTimeout(g.current.timer);
    g.current.timer = null;
  };
  const targetFor = (move: number) => {
    const { index: i, count: n, rowHeight: h } = p.current;
    return Math.max(0, Math.min(n - 1, i + Math.round(move / h)));
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        g.current = { active: false, moved: false, to: p.current.index, timer: null };
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
        // Keep the lifted row inside the list.
        const { index: i, count: n, rowHeight: h } = p.current;
        const move = Math.max(-i * h, Math.min((n - 1 - i) * h, s.dy));
        dy.setValue(move);
        const to = targetFor(move);
        if (to !== g.current.to) {
          g.current.to = to;
          buzz();
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
          p.current.onDrop(g.current.to, true);
        } else if (!g.current.moved) p.current.onTap();
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
      accessibilityRole="button"
      accessibilityHint="Tap to open. Press and hold, then drag to reorder."
      style={[
        { height: rowHeight },
        lifted
          ? [styles.lifted, { transform: [{ translateY: dy }, { scale: 1.02 }] }]
          : { transform: [{ translateY: shift }] },
        pressed && !lifted && { backgroundColor: 'rgba(255,255,255,0.08)' },
      ]}
    >
      <View style={[styles.inner, !last && !lifted && styles.line]}>
        <View style={{ flex: 1 }}>{children}</View>
        <Ionicons name={lifted ? 'reorder-three' : 'chevron-forward'} size={lifted ? 22 : 17} color={C.faint} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 16, paddingRight: 16, gap: 8 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
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
