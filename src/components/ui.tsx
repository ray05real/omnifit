// The app's shared building blocks, in Apple's style: large titles, rounded cards with a faint glass edge,
// grouped lists, capsule buttons, glass round buttons, floating sheets.

import React, { useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { usePageLock } from '../store/pageLock';
import { C, PAD, RADIUS, T, TAB_H, alpha } from '../theme';
import { Glass } from './Glass';

export type IconName = keyof typeof Ionicons.glyphMap;

// A small tap you can feel (iPhone only).
export function buzz(kind: 'tap' | 'done' = 'tap') {
  if (Platform.OS === 'web') return;
  const p =
    kind === 'done'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.selectionAsync();
  p.catch(() => {});
}

// "Are you sure?" before anything is deleted.
export function confirmAction(title: string, message: string, actionLabel: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(title + '\n\n' + message)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: actionLabel, style: 'destructive', onPress: onYes },
  ]);
}

// Where the floating tab bar sits, and how much room the page leaves for it.
export function tabBarBottom(insets: EdgeInsets): number {
  return Math.max(insets.bottom - 6, 12);
}
export function tabBarSpace(insets: EdgeInsets): number {
  return tabBarBottom(insets) + TAB_H + 12;
}

// A soft glow of the section's colour at the top of the page, so the glass has something to show.
function Glow({ color, soft }: { color: string; soft?: boolean }) {
  const id = 'glow' + color.replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg style={styles.glow} width="100%" height={520} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="0%" rx="85%" ry="100%" fx="50%" fy="0%">
          <Stop offset="0" stopColor={color} stopOpacity={soft ? 0.13 : 0.3} />
          <Stop offset="0.6" stopColor={color} stopOpacity={soft ? 0.04 : 0.1} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

// One tab's page: large title, optional buttons beside it, scrolling content, optional floating button.
export function Screen({
  title,
  subtitle,
  left,
  right,
  footer,
  fab,
  glow,
  glowSoft,
  children,
}: {
  title: React.ReactNode;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  footer?: React.ReactNode;
  fab?: { icon: IconName; label: string; onPress: () => void }; // a round button in the bottom-right corner
  glow?: string;
  glowSoft?: boolean;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const space = tabBarSpace(insets);
  const locked = usePageLock((s) => s.locked);
  return (
    <View style={{ flex: 1 }}>
      {glow ? <Glow color={glow} soft={glowSoft} /> : null}
      <View style={{ flex: 1, paddingTop: insets.top + 4 }}>
        <View style={styles.header}>
          {left}
          <View style={{ flex: 1 }}>
            {typeof title === 'string' ? (
              <Text style={T.title} numberOfLines={1}>
                {title}
              </Text>
            ) : (
              title
            )}
            {subtitle ? <Text style={[T.muted, { marginTop: 1 }]}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 6, paddingBottom: space + (footer || fab ? 76 : 20) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
          scrollEnabled={!locked}
        >
          {children}
        </ScrollView>
      </View>
      {footer ? <View style={[styles.footer, { bottom: space }]}>{footer}</View> : null}
      {fab ? (
        <Pressable
          onPress={fab.onPress}
          accessibilityRole="button"
          accessibilityLabel={fab.label}
          style={({ pressed }) => [styles.fab, { bottom: space + 2, opacity: pressed ? 0.75 : 1 }]}
        >
          <Ionicons name={fab.icon} size={28} color={C.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// Apple's grouped list: rows in one rounded card, thin lines between them.
export function Group({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, styles.group, style]}>{children}</View>;
}

export function Row({
  children,
  onPress,
  onLongPress,
  last,
  chevron,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  last?: boolean;
  chevron?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: 'rgba(255,255,255,0.08)' }]}
    >
      <View style={[styles.rowInner, !last && styles.rowLine, style]}>
        {children}
        {chevron ? <Ionicons name="chevron-forward" size={17} color={C.faint} style={{ marginLeft: 6 }} /> : null}
      </View>
    </Pressable>
  );
}

// A small grey heading above a card, as in Settings.
export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: 26, marginBottom: 7, marginLeft: 16 }, style]}>
      <Text style={T.label}>{children}</Text>
    </View>
  );
}

// A filled capsule: the main action.
export function PrimaryButton({
  label,
  onPress,
  color = C.text,
  icon,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const textColor = color === C.text ? C.ink : '#FFFFFF';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: color, opacity: disabled ? 0.35 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={21} color={textColor} /> : null}
      <Text style={[styles.primaryText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

// Apple's tinted capsule (the colour, see-through, behind coloured text), or just coloured text.
export function GhostButton({
  label,
  onPress,
  color = C.text,
  icon,
  outlined = true,
  style,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  icon?: IconName;
  outlined?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.ghost,
        outlined && { backgroundColor: color.startsWith('#') ? alpha(color, 0.16) : C.fill },
        { opacity: pressed ? 0.6 : 1 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={19} color={color} /> : null}
      <Text style={[styles.ghostText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// A round button; `filled` makes it Apple's glass circle, as in the top bars of Notes or Calendar.
export function IconButton({
  icon,
  onPress,
  color = C.text,
  size = 21,
  label,
  filled,
  disabled,
}: {
  icon: IconName;
  onPress: () => void;
  color?: string;
  size?: number;
  label: string; // read out by VoiceOver
  filled?: boolean;
  disabled?: boolean;
}) {
  const inner = <Ionicons name={icon} size={size} color={color} />;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ opacity: disabled ? 0.3 : pressed ? 0.55 : 1 })}
    >
      {filled ? (
        <Glass style={styles.glassBtn} interactive>
          {inner}
        </Glass>
      ) : (
        <View style={styles.iconBtn}>{inner}</View>
      )}
    </Pressable>
  );
}

// Apple's segmented control: a grey capsule, the chosen part a lighter capsule.
export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  color?: string;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => {
              buzz();
              onChange(o.key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.segment, on && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, on && { fontWeight: '600' }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A floating panel that comes up from the bottom (iOS 26 style). Tap outside to close.
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(80)).current;
  useEffect(() => {
    if (!visible) return;
    y.setValue(80);
    Animated.spring(y, { toValue: 0, damping: 22, stiffness: 260, mass: 0.9, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [visible, y]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheetWrap}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
          <Animated.View
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom - 4, 18), transform: [{ translateY: y }] }]}
          >
            <View style={styles.grab} />
            {title ? (
              <View style={styles.sheetHead}>
                <View style={{ flex: 1 }}>
                  <Text style={T.h2} numberOfLines={1}>
                    {title}
                  </Text>
                  {subtitle ? <Text style={[T.small, { marginTop: 2 }]}>{subtitle}</Text> : null}
                </View>
                <IconButton icon="close" size={19} label="Close" filled onPress={onClose} color={C.muted} />
              </View>
            ) : null}
            {children}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// A labelled text box. 17px text, so the iPhone never zooms in on it.
export function Field({
  label,
  suffix,
  containerStyle,
  ...props
}: TextInputProps & { label: string; suffix?: string; containerStyle?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: 14 }, containerStyle]}>
      <Text style={[T.small, { marginLeft: 4 }]}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          placeholderTextColor={C.faint}
          selectionColor={C.weight}
          keyboardAppearance="dark"
          style={styles.input}
          {...props}
        />
        {suffix ? <Text style={T.muted}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

// ‹  Today · Wed 11 Nov  ›
export function DateStepper({
  label,
  onPrev,
  onNext,
  onPressLabel,
  nextDisabled,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onPressLabel?: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <IconButton icon="chevron-back" onPress={onPrev} label="Previous day" filled />
      <Pressable onPress={onPressLabel} disabled={!onPressLabel} style={{ flex: 1, alignItems: 'center' }}>
        <Text style={T.headline}>{label}</Text>
      </Pressable>
      <IconButton icon="chevron-forward" onPress={onNext} label="Next day" filled disabled={nextDisabled} />
    </View>
  );
}

export function Empty({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={44} color={C.faint} />
      <Text style={[T.h2, { marginTop: 12, fontSize: 20 }]}>{title}</Text>
      <Text style={[T.muted, { textAlign: 'center', marginTop: 6, lineHeight: 20 }]}>{text}</Text>
    </View>
  );
}

const continuous = { borderCurve: 'continuous' as const };

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: PAD + 4,
    paddingBottom: 8,
    minHeight: 54,
  },
  footer: { position: 'absolute', left: PAD, right: PAD },
  fab: {
    position: 'absolute',
    right: PAD + 6,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: RADIUS,
    ...continuous,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.rim,
  },
  group: { padding: 0, overflow: 'hidden' },
  row: {},
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingVertical: 11,
    paddingRight: 16,
    marginLeft: 16,
    gap: 8,
  },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  primary: {
    height: 52,
    borderRadius: 26,
    ...continuous,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
  },
  primaryText: { fontSize: 17, fontWeight: '600', letterSpacing: -0.4 },
  ghost: {
    height: 46,
    borderRadius: 23,
    ...continuous,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
  },
  ghostText: { fontSize: 17, fontWeight: '600', letterSpacing: -0.4 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  glassBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', backgroundColor: C.fill, borderRadius: 20, padding: 3, height: 38 },
  segment: { flex: 1, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segmentOn: { backgroundColor: C.thumb },
  segmentText: { color: C.text, fontSize: 14, fontWeight: '500', letterSpacing: -0.2 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: C.cardSolid,
    borderRadius: 38,
    ...continuous,
    paddingHorizontal: 20,
    paddingTop: 8,
    width: '100%',
    maxWidth: 484,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.rim,
  },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', padding: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  grab: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(235,235,245,0.3)',
    marginBottom: 12,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card2,
    borderRadius: 14,
    ...continuous,
    paddingHorizontal: 14,
    marginTop: 6,
    height: 50,
    gap: 8,
  },
  input: { flex: 1, minWidth: 0, color: C.text, fontSize: 17, height: 50, padding: 0 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
});
