// "Weigh with my scale": step on the Bluetooth scale and the weight is saved for today.
// Only shown in the "with scale" version of the app.

import React, { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GhostButton, PrimaryButton, Sheet, buzz } from '../components/ui';
import type { DateKey } from '../lib/dates';
import { startWeighing, type ScaleStatus } from '../scale/scale';
import { useBody } from '../store/body';
import { C, T } from '../theme';
import variant from '../../variant.json';

const MESSAGE: Record<ScaleStatus, { title: string; text: string }> = {
  starting: { title: 'Getting ready', text: 'Turning on Bluetooth…' },
  unavailable: { title: 'Bluetooth isn’t available', text: 'This version of the app can’t use Bluetooth here.' },
  'bluetooth-off': { title: 'Bluetooth is off', text: 'Turn Bluetooth on (Control Centre), then come back.' },
  'not-allowed': { title: 'Bluetooth isn’t allowed', text: 'Open Settings → Omniload and switch Bluetooth on.' },
  looking: { title: 'Step on the scale', text: 'Looking for your scale. Stepping on wakes it up.' },
  connecting: { title: 'Found it', text: 'Connecting… stay on the scale.' },
  weighing: { title: 'Weighing', text: 'Stand still until the number settles.' },
  done: { title: 'Saved', text: 'Logged as today’s weight.' },
  failed: { title: 'That didn’t work', text: '' },
};

export function ScaleSheet({ today, onClose }: { today: DateKey; onClose: () => void }) {
  const setWeight = useBody((s) => s.setWeight);
  const [status, setStatus] = useState<ScaleStatus>('starting');
  const [detail, setDetail] = useState('');
  const [kg, setKg] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const report = useRef<string[]>([]);

  useEffect(() => {
    report.current = [`Omniload scale report, build ${variant.build}, ${new Date().toISOString()}`];
    setStatus('starting');
    setKg(null);
    return startWeighing({
      onStatus: (s, d) => {
        setStatus(s);
        setDetail(d ?? '');
      },
      onLive: setKg,
      onDone: (value) => {
        buzz('done');
        setKg(value);
        setWeight(today, value);
      },
      onLog: (line) => {
        if (report.current.length < 400) report.current.push(line);
      },
    });
  }, [attempt, today, setWeight]);

  const m = MESSAGE[status];
  const ended = status === 'done' || status === 'failed' || status === 'unavailable';

  return (
    <Sheet visible onClose={onClose} title={m.title} subtitle={status === 'failed' ? detail || 'No weight came through.' : m.text}>
      <View style={styles.middle}>
        {kg !== null ? (
          <View style={styles.bigRow}>
            <Text style={[styles.big, status === 'done' && { color: C.up }]}>{kg.toFixed(1)}</Text>
            <Text style={styles.unit}>kg</Text>
          </View>
        ) : (
          <Ionicons name={status === 'failed' ? 'alert-circle-outline' : 'bluetooth'} size={54} color={C.faint} />
        )}
      </View>

      {status === 'done' ? (
        <PrimaryButton label="Done" onPress={onClose} />
      ) : ended || status === 'bluetooth-off' || status === 'not-allowed' ? (
        <PrimaryButton label="Try again" onPress={() => setAttempt((a) => a + 1)} />
      ) : null}

      {/* What the app saw and said, to send when something doesn't work. */}
      <GhostButton
        label="Send a report"
        icon="share-outline"
        color={C.muted}
        outlined={false}
        onPress={() => Share.share({ message: report.current.join('\n') }).catch(() => {})}
        style={{ marginTop: 4 }}
      />
      <Text style={[T.small, { textAlign: 'center', color: C.faint }]}>
        If it doesn’t work, tap “Send a report” and paste it to Claude.
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  middle: { height: 130, alignItems: 'center', justifyContent: 'center' },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  big: { color: C.text, fontSize: 68, fontWeight: '700', letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  unit: { color: C.muted, fontSize: 24, fontWeight: '600' },
});
