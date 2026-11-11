// A ring that fills clockwise from the top; whatever is passed as children sits in the middle.

import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { C, alpha } from '../theme';

export function Ring({
  size,
  stroke,
  progress,
  color,
  track,
  children,
}: {
  size: number;
  stroke: number;
  progress: number; // 0 to 1 (more is drawn as full)
  color: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* As Apple's Activity rings: the empty part is the ring's own colour, dimmed. */}
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? (color.startsWith('#') ? alpha(color, 0.22) : C.track)} strokeWidth={stroke} fill="none" />
        {p > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={[len, len]}
            strokeDashoffset={len * (1 - p)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}
