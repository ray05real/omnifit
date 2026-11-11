// The scroll wheel of numbers (the iPhone's own picker wheel; a drop-down in the PC's web preview).

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';

import { C, T } from '../theme';

export function range(from: number, to: number, step = 1): number[] {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

const WHEEL_HEIGHT = 190;

export function WheelColumn({
  values,
  value,
  onChange,
  format,
  label,
  flex = 1,
}: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  label?: string;
  flex?: number;
}) {
  return (
    <View style={{ flex }}>
      {label ? <Text style={[T.label, { textAlign: 'center' }]}>{label}</Text> : null}
      <Picker
        selectedValue={value}
        // By position, not by value: the web preview hands values back as text.
        onValueChange={(_, i) => onChange(values[i])}
        style={Platform.OS === 'ios' ? styles.ios : styles.other}
        itemStyle={styles.item}
        dropdownIconColor={C.text}
        accessibilityLabel={label}
      >
        {values.map((v) => (
          <Picker.Item key={v} label={format ? format(v) : String(v)} value={v} />
        ))}
      </Picker>
    </View>
  );
}

// The wheels side by side.
export function WheelRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const HOURS = range(0, 23);
const MINUTES = range(0, 59);
const two = (n: number) => (n < 10 ? '0' + n : String(n));

// A time of day ('HH:MM') as two wheels.
export function TimeWheels({ time, onChange }: { time: string; onChange: (t: string) => void }) {
  const [h, m] = time.split(':').map(Number);
  return (
    <WheelRow>
      <WheelColumn label="Hour" values={HOURS} value={h} onChange={(v) => onChange(two(v) + ':' + two(m))} format={two} />
      <WheelColumn label="Minute" values={MINUTES} value={m} onChange={(v) => onChange(two(h) + ':' + two(v))} format={two} />
    </WheelRow>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 14, marginBottom: 6 },
  ios: { height: WHEEL_HEIGHT },
  other: {
    height: 48,
    marginTop: 8,
    marginBottom: 12,
    color: C.text,
    backgroundColor: C.card2,
    borderRadius: 10,
    borderWidth: 0,
    fontSize: 18,
    paddingHorizontal: 8,
  },
  item: { color: C.text, fontSize: 23, height: WHEEL_HEIGHT, fontVariant: ['tabular-nums'] },
});
