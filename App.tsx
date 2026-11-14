// Omniload: five sections side by side. Swipe left / right between them, or tap the floating glass bar.

import React, { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
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

import { Glass } from './src/components/Glass';
import { buzz, tabBarBottom, type IconName } from './src/components/ui';
import { MetricsScreen } from './src/screens/MetricsScreen';
import { NutritionScreen } from './src/screens/NutritionScreen';
import { OverloadScreen } from './src/screens/OverloadScreen';
import { SleepScreen } from './src/screens/SleepScreen';
import { WeightScreen } from './src/screens/WeightScreen';
import { useHydrated } from './src/store/hooks';
import { backSwipe, usePageLock } from './src/store/pageLock';
import { C, TAB_H } from './src/theme';

// The owner's order: overload, nutrition, weight, sleep, then metrics.
const TABS: { key: string; label: string; icon: IconName; iconOff: IconName; color: string; Screen: React.ComponentType }[] = [
  { key: 'overload', label: 'Overload', icon: 'barbell', iconOff: 'barbell-outline', color: C.overload, Screen: OverloadScreen },
  { key: 'nutrition', label: 'Nutrition', icon: 'restaurant', iconOff: 'restaurant-outline', color: C.nutrition, Screen: NutritionScreen },
  { key: 'weight', label: 'Weight', icon: 'scale', iconOff: 'scale-outline', color: C.weight, Screen: WeightScreen },
  { key: 'sleep', label: 'Sleep', icon: 'moon', iconOff: 'moon-outline', color: C.sleep, Screen: SleepScreen },
  { key: 'metrics', label: 'Metrics', icon: 'calendar', iconOff: 'calendar-outline', color: C.text, Screen: MetricsScreen },
];

const BAR_SIDE = 20; // the bar's gap from each side of the screen
const BAR_PAD = 4;

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
  const locked = usePageLock((s) => s.locked);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pageW = Math.min(width, 500); // a phone-wide column in the PC's web preview
  const pager = useRef<ComponentRef<typeof Animated.ScrollView>>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const tapped = useRef<number | null>(null); // the section a tap on the bar is gliding to
  const scrollX = useRef(new Animated.Value(0)).current;

  const tabW = (pageW - BAR_SIDE * 2 - BAR_PAD * 2) / TABS.length;
  // The lighter pill under the current section follows the finger while swiping.
  const pillX = useMemo(
    () =>
      scrollX.interpolate({
        inputRange: [0, pageW * (TABS.length - 1)],
        outputRange: [0, tabW * (TABS.length - 1)],
        extrapolate: 'clamp' as const,
      }),
    [scrollX, pageW, tabW],
  );

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

  const scrollHandler = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: Platform.OS !== 'web',
        listener: onScroll,
      }),
    [scrollX, onScroll],
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
        <Animated.ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          scrollEnabled={!locked}
          // The page may be pulled a little past the first section: that pull is the "swipe back" out of a session.
          bounces
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollEventThrottle={16}
          onScroll={scrollHandler}
          onScrollBeginDrag={() => {
            tapped.current = null;
          }}
          onScrollEndDrag={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (e.nativeEvent.contentOffset.x < -40 && backSwipe.handler) {
              buzz();
              backSwipe.handler();
            }
          }}
          style={{ flex: 1 }}
        >
          {TABS.map((t) => (
            <View key={t.key} style={{ width: pageW, flex: 1 }}>
              <t.Screen />
            </View>
          ))}
        </Animated.ScrollView>

        <View style={[styles.barWrap, { bottom: tabBarBottom(insets) }]} pointerEvents="box-none">
          <Glass style={styles.bar}>
            <Animated.View pointerEvents="none" style={[styles.pill, { width: tabW, transform: [{ translateX: pillX }] }]} />
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
                  <Ionicons name={on ? t.icon : t.iconOff} size={23} color={on ? C.text : C.muted} />
                  <Text style={[styles.tabLabel, { color: on ? C.text : C.muted }]} numberOfLines={1}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </Glass>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg, alignItems: 'center' },
  column: { flex: 1, backgroundColor: C.bg },
  barWrap: { position: 'absolute', left: BAR_SIDE, right: BAR_SIDE },
  bar: {
    height: TAB_H,
    borderRadius: TAB_H / 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BAR_PAD,
  },
  pill: {
    position: 'absolute',
    left: BAR_PAD,
    top: BAR_PAD,
    bottom: BAR_PAD,
    borderRadius: (TAB_H - BAR_PAD * 2) / 2,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  tab: { flex: 1, height: TAB_H - BAR_PAD * 2, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabLabel: { fontSize: 10, fontWeight: '600', letterSpacing: -0.1 },
});
