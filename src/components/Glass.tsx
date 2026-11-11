// Apple's glass, for the things that float: the tab bar, the round buttons, the sheets.
// On iOS 26 and later it is Apple's own Liquid Glass; elsewhere (older iPhones, the PC preview) a dark blur
// with a faint frost and a bright edge.

import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

const liquid = Platform.OS === 'ios' && isLiquidGlassAvailable();

export function Glass({
  style,
  children,
  interactive,
}: {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  interactive?: boolean; // Liquid Glass reacts to the finger
}) {
  if (liquid) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme="dark" isInteractive={interactive} style={style}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[style, styles.frost]}>
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.tint]} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frost: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)' },
  tint: { backgroundColor: 'rgba(120,120,128,0.16)' },
});
