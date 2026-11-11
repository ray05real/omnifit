// Omnifit: five sections side by side. Swipe left / right between them, or tap the bar at the bottom.

import React, { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { buzz, type IconName } from './src/components/ui';
import { MetricsScreen } from './src/screens/MetricsScreen';
import { NutritionScreen } from './src/screens/NutritionScreen';
import { OverloadScreen } from './src/screens/OverloadScreen';
import { SleepScreen } from './src/screens/SleepScreen';
import { WeightScreen } from './src/screens/WeightScreen';
import { useHydrated } from './src/store/hooks';
import { C } from './src/theme';

// The owner's order: overload, nutrition, weight, sleep, then metrics.
const TABS: { key: string; label: string; icon: IconName; iconOff: IconName; color: string; Screen: React.ComponentType }[] = [
  { key: 'overload', label: 'Overload', icon: 'barbell', iconOff: 'barbell-outline', color: C.overload, Screen: OverloadScreen },
  { key: 'nutrition', label: 'Nutrition', icon: 'restaurant', iconOff: 'restaurant-outline', color: C.nutrition, Screen: NutritionScreen },
  { key: 'weight', label: 'Weight', icon: 'scale', iconOff: 'scale-outline', color: C.weight, Screen: WeightScreen },
  { key: 'sleep', label: 'Sleep', icon: 'moon', iconOff: 'moon-outline', color: C.sleep, Screen: SleepScreen },
  { key: 'metrics', label: 'Metrics', icon: 'stats-chart', iconOff: 'stats-chart-outline', color: C.text, Screen: MetricsScreen },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const hydrated = useHydrated();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pageW = Math.min(width, 500); // a phone-wide column in the PC's web preview
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);

  const tapped = useRef<number | null>(null); // the section a tap on the bar is gliding to

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.max(0, Math.min(TABS.length - 1, Math.round(e.nativeEvent.contentOffset.x / pageW)));
      // After a tap the bar lights up at once; don't flicker through the sections passed on the way.
      if (tapped.current !== null) {
        if (i === tapped.current) tapped.current = null;
        return;
      }
      if (i !== indexRef.current) {
        indexRef.current = i;
        setIndex(i);
      }
    },
    [pageW],
  );

  const go = useCallback(
    (i: number) => {
      if (i === indexRef.current) return;
      buzz();
      tapped.current = i;
      indexRef.current = i;
      setIndex(i);
      pager.current?.scrollTo({ x: i * pageW, animated: true });
    },
    [pageW],
  );

  // Stay on the same section if the window changes size.
  useEffect(() => {
    pager.current?.scrollTo({ x: indexRef.current * pageW, animated: false });
  }, [pageW]);

  if (!hydrated) return <View style={styles.app} />;

  return (
    <View style={styles.app}>
      <View style={[styles.column, { width: pageW }]}>
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          bounces={false}
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollEventThrottle={16}
          onScroll={onScroll}
          onScrollBeginDrag={() => {
            tapped.current = null;
          }}
          style={{ flex: 1 }}
        >
          {TABS.map((t) => (
            <View key={t.key} style={{ width: pageW, flex: 1 }}>
              <t.Screen />
            </View>
          ))}
        </ScrollView>

        <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {TABS.map((t, i) => {
            const on = i === index;
            return (
              <Pressable
                key={t.key}
                onPress={() => go(i)}
                style={styles.tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t.label}
              >
                <Ionicons name={on ? t.icon : t.iconOff} size={24} color={on ? t.color : C.faint} />
                <Text style={[styles.tabLabel, { color: on ? t.color : C.faint }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg, alignItems: 'center' },
  column: { flex: 1, backgroundColor: C.bg },
  tabBar: {
    flexDirection: 'row',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    backgroundColor: C.bg,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { fontSize: 10.5, fontWeight: '600' },
});
