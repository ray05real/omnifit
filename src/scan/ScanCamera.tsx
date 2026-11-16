// The live camera for scanning a pack, like an ID check: a box to line the thing up in, which turns green
// when it can be read, and a line underneath saying what's happening ("Move closer", "Hold steady…").
//
// Nutrition table: every second or so a frame is read on the phone (Apple's text reading); the box goes green
// once two frames agree on the protein, carbs and fat. Tapping the button takes a sharp photo and keeps the
// numbers most readings agree on.
// Barcode (the owner's version only): the camera spots the barcode by itself; it is then looked up.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

import { Glass } from '../components/Glass';
import { PrimaryButton, buzz } from '../components/ui';
import { scanPhoto } from '../../modules/label-reader';
import { combineReadings, parseLabel, validBarcode, type LabelResult } from '../lib/label';
import { round1, thousands } from '../lib/nutrition';
import { C, T } from '../theme';
import { lookUpBarcode, type PackValues } from './scan';

export type ScanMode = 'label' | 'barcode';

type Status =
  | 'starting'
  | 'looking' // nothing to read yet
  | 'closer' // a table is there but too small
  | 'focusing' // reading it, not sure yet
  | 'ready' // the box is green
  | 'reading' // the sharp photo is being read
  | 'found' // barcode seen, being looked up
  | 'unknown' // barcode not in the database
  | 'failed';

const MESSAGES: Record<Status, string> = {
  starting: 'Starting the camera…',
  looking: 'Point the camera at the nutrition table',
  closer: 'Move closer so the table fills the box',
  focusing: 'Hold steady… focusing',
  ready: 'Ready: tap the button to take it',
  reading: 'Reading…',
  found: 'Barcode found: looking it up…',
  unknown: 'This product isn’t in the food database',
  failed: 'Couldn’t read the numbers',
};

const KEEP_FRAMES = 6;
const FRAME_SIDE = 1600; // live frames are shrunk to this before reading: quicker, still sharp enough

export function ScanCamera({
  mode,
  onDone,
  onClose,
  onUseLabel,
}: {
  mode: ScanMode;
  onDone: (v: PackValues) => void;
  onClose: () => void;
  onUseLabel?: () => void; // from the barcode scanner: "scan the nutrition table instead"
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [status, setStatus] = useState<Status>(mode === 'barcode' ? 'starting' : 'starting');
  const [preview, setPreview] = useState<LabelResult | null>(null);
  const [failNote, setFailNote] = useState('');
  const frames = useRef<LabelResult[]>([]);
  const empty = useRef(0);
  const busy = useRef(false); // the sharp photo or a barcode lookup is under way
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
    return () => {
      alive.current = false;
    };
  }, [permission, requestPermission]);

  // Nutrition table: read a frame, update the box, again, until the sheet closes.
  useEffect(() => {
    if (mode !== 'label' || !cameraReady) return;
    let stopped = false;
    setStatus('looking');
    const loop = async () => {
      while (!stopped && alive.current) {
        if (busy.current) {
          await wait(300);
          continue;
        }
        try {
          const photo = await cam.current?.takePictureAsync({ quality: 0.5, shutterSound: false });
          if (!photo || stopped || busy.current) continue;
          const { lines } = await scanPhoto(photo.uri, { maxSide: FRAME_SIDE, deleteAfter: true });
          if (stopped || busy.current) continue;
          const r = parseLabel(lines);
          if (r.seen === 0) {
            if (++empty.current >= 3) frames.current = []; // the camera moved away: start again
          } else {
            empty.current = 0;
            if (r.found > 0) frames.current = [...frames.current, r].slice(-KEEP_FRAMES);
          }
          const all = combineReadings(frames.current);
          setPreview(frames.current.length ? all : null);
          const macros = all.protein !== undefined && all.carbs !== undefined && all.fat !== undefined;
          if (macros && all.agree >= 2) setStatus('ready');
          else if (r.seen === 0 && frames.current.length === 0) setStatus('looking');
          else if (r.seen > 0 && r.textHeight > 0 && r.textHeight < 0.012 && r.found < 3) setStatus('closer');
          else setStatus('focusing');
        } catch {
          await wait(500); // the camera wasn't ready for a photo: try again shortly
        }
        await wait(150);
      }
    };
    loop();
    return () => {
      stopped = true;
    };
  }, [mode, cameraReady]);

  // The button: a sharp photo, read in full, combined with the live readings (it counts double).
  const takeIt = useCallback(async () => {
    if (busy.current || !cam.current) return;
    busy.current = true;
    setStatus('reading');
    buzz();
    try {
      const photo = await cam.current.takePictureAsync({ quality: 0.9, shutterSound: true });
      const { lines } = await scanPhoto(photo.uri, { deleteAfter: true });
      const r = parseLabel(lines);
      const all = combineReadings([...frames.current, ...(r.found > 0 ? [r, r] : [])]);
      if (all.found === 0) {
        setFailNote('Hold the phone straight over the table so it fills the box, without glare, and try again.');
        setStatus('failed');
        busy.current = false;
        return;
      }
      buzz('done');
      onDone({
        source: 'label',
        unit: all.unit,
        kcal: all.kcal,
        protein: all.protein,
        carbs: all.carbs,
        fat: all.fat,
        found: all.found,
      });
    } catch (e) {
      setFailNote(e instanceof Error ? e.message : String(e));
      setStatus('failed');
      busy.current = false;
    }
  }, [onDone]);

  // Barcode: the camera spots it by itself.
  const onBarcode = useCallback(
    async (b: BarcodeScanningResult) => {
      const code = b.data?.trim() ?? '';
      if (busy.current || !/^\d{8,14}$/.test(code)) return;
      if (b.type !== 'upc_e' && !validBarcode(code)) return; // a misread: wait for a clean one
      busy.current = true;
      buzz('done');
      setStatus('found');
      const product = await lookUpBarcode(code);
      if (!alive.current) return;
      if (product) onDone(product);
      else setStatus('unknown');
    },
    [onDone],
  );

  // The box to line things up in: tall for a table, wide and short for a barcode.
  const boxW = Math.min(width * 0.84, 420);
  const boxH = mode === 'label' ? Math.min(height * 0.5, boxW * 1.25) : boxW * 0.42;
  const boxTop = insets.top + 76 + (mode === 'label' ? 0 : height * 0.12);
  const boxLeft = (width - boxW) / 2;
  const good = status === 'ready' || status === 'found';
  const boxColor = good ? C.up : status === 'unknown' || status === 'failed' ? C.down : 'rgba(255,255,255,0.85)';
  const spinning = status === 'starting' || status === 'focusing' || status === 'reading' || status === 'found' || status === 'closer' || status === 'looking';
  const message = mode === 'barcode' && status === 'starting' ? 'Point the camera at the barcode' : MESSAGES[status];

  const denied = permission && !permission.granted && !permission.canAskAgain;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.page}>
        {permission?.granted ? (
          <CameraView
            ref={cam}
            style={StyleSheet.absoluteFill}
            facing="back"
            animateShutter={false}
            enableTorch={torch}
            onCameraReady={() => setCameraReady(true)}
            barcodeScannerSettings={mode === 'barcode' ? { barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] } : undefined}
            onBarcodeScanned={mode === 'barcode' ? onBarcode : undefined}
          />
        ) : null}

        {/* Everything outside the box is dimmed. */}
        <View pointerEvents="none" style={[styles.shade, { top: 0, left: 0, right: 0, height: boxTop }]} />
        <View pointerEvents="none" style={[styles.shade, { top: boxTop + boxH, left: 0, right: 0, bottom: 0 }]} />
        <View pointerEvents="none" style={[styles.shade, { top: boxTop, left: 0, width: boxLeft, height: boxH }]} />
        <View pointerEvents="none" style={[styles.shade, { top: boxTop, right: 0, width: boxLeft, height: boxH }]} />
        <View
          pointerEvents="none"
          style={[styles.box, { top: boxTop, left: boxLeft, width: boxW, height: boxH, borderColor: boxColor }]}
        >
          {good ? (
            <View style={styles.tick}>
              <Ionicons name="checkmark" size={26} color={C.ink} />
            </View>
          ) : null}
        </View>

        {/* Top bar. */}
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Glass style={styles.round}>
              <Ionicons name="close" size={22} color={C.text} />
            </Glass>
          </Pressable>
          <Text style={styles.title}>{mode === 'label' ? 'Nutrition table' : 'Barcode'}</Text>
          <Pressable onPress={() => setTorch(!torch)} accessibilityRole="button" accessibilityLabel="Torch">
            <Glass style={styles.round}>
              <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={20} color={torch ? C.same : C.text} />
            </Glass>
          </Pressable>
        </View>

        {/* What's happening, under the box. */}
        <View style={[styles.statusWrap, { top: boxTop + boxH + 18 }]}>
          <View style={[styles.statusPill, good && { backgroundColor: 'rgba(48,209,88,0.22)' }]}>
            {good ? (
              <Ionicons name="checkmark-circle" size={18} color={C.up} />
            ) : spinning ? (
              <ActivityIndicator size="small" color={C.text} />
            ) : (
              <Ionicons name="alert-circle" size={18} color={C.down} />
            )}
            <Text style={styles.statusText}>{denied ? 'Omniload isn’t allowed to use the camera' : message}</Text>
          </View>
          {mode === 'label' && preview && preview.found > 0 && status !== 'failed' ? (
            <Text style={styles.readout}>
              {preview.kcal !== undefined ? `${thousands(preview.kcal)} kcal` : '– kcal'} · P {fmt(preview.protein)} · C {fmt(preview.carbs)} · F{' '}
              {fmt(preview.fat)}
            </Text>
          ) : null}
          {status === 'failed' && failNote ? <Text style={styles.readout}>{failNote}</Text> : null}
          {mode === 'label' && status === 'focusing' ? (
            <Text style={styles.hint}>Keep the table flat, in the box, without glare.</Text>
          ) : null}
        </View>

        {/* Bottom. */}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
          {denied ? (
            <PrimaryButton label="Open Settings" onPress={() => Linking.openSettings()} style={{ alignSelf: 'stretch' }} />
          ) : mode === 'label' ? (
            <>
              <Pressable
                onPress={takeIt}
                disabled={status === 'reading' || !cameraReady}
                accessibilityRole="button"
                accessibilityLabel="Take the photo"
                style={({ pressed }) => [styles.shutter, { borderColor: good ? C.up : 'rgba(255,255,255,0.9)' }, pressed && { opacity: 0.7 }]}
              >
                <View style={[styles.shutterInner, good && { backgroundColor: C.up }]} />
              </Pressable>
              <Text style={styles.under}>{good ? 'Tap to take it' : status === 'failed' ? 'Try again' : 'You can take it now, but green reads best'}</Text>
            </>
          ) : status === 'unknown' ? (
            <View style={{ alignSelf: 'stretch', gap: 10 }}>
              {onUseLabel ? <PrimaryButton label="Scan the nutrition table instead" onPress={onUseLabel} /> : null}
              <PrimaryButton
                label="Try another barcode"
                color={C.card2}
                onPress={() => {
                  busy.current = false;
                  setStatus('starting');
                }}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = (v: number | undefined) => (v === undefined ? '–' : String(round1(v)));

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000' },
  shade: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  box: { position: 'absolute', borderWidth: 3, borderRadius: 22, borderCurve: 'continuous' },
  tick: {
    position: 'absolute',
    top: -16,
    right: -16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.up,
    alignItems: 'center',
    justifyContent: 'center',
  },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { ...T.headline, flex: 1, textAlign: 'center' },
  statusWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 8 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(28,28,30,0.85)',
  },
  statusText: { color: C.text, fontSize: 15, fontWeight: '600' },
  readout: { color: C.text, fontSize: 14, textAlign: 'center', fontVariant: ['tabular-nums'] },
  hint: { color: C.muted, fontSize: 13, textAlign: 'center' },
  bottom: { position: 'absolute', left: 24, right: 24, bottom: 0, alignItems: 'center', gap: 10 },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  under: { color: C.muted, fontSize: 13 },
});
