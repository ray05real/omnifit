// The app's shared building blocks: page frame, buttons, bottom sheet, text field.

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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { C, PAD, T } from '../theme';

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

// One tab's page: big title, optional buttons beside it, scrolling content, optional pinned footer.
export function Screen({
  title,
  subtitle,
  left,
  right,
  footer,
  children,
}: {
  title: React.ReactNode;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top + 6 }}>
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
        contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: color, opacity: disabled ? 0.35 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={20} color={C.ink} /> : null}
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

// A quieter button: outlined, or just coloured text.
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
      style={({ pressed }) => [styles.ghost, outlined && styles.ghostOutline, { opacity: pressed ? 0.6 : 1 }, style]}
    >
      {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
      <Text style={[styles.ghostText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color = C.text,
  size = 22,
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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconBtn,
        filled && { backgroundColor: C.card2 },
        { opacity: disabled ? 0.25 : pressed ? 0.5 : 1 },
      ]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

// A row of choices where one is picked.
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  color = C.text,
}: {
  options: { key: K; label: string; color?: string }[];
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
            style={[styles.segment, on && { backgroundColor: o.color ?? color }]}
          >
            <Text style={[styles.segmentText, on && { color: C.ink }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A panel that comes up from the bottom over a dimmed screen. Tap outside to close.
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
  const y = useRef(new Animated.Value(60)).current;
  useEffect(() => {
    if (!visible) return;
    y.setValue(60);
    Animated.timing(y, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [visible, y]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
          <Animated.View
            style={[styles.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: y }] }]}
          >
            <View style={styles.grab} />
            {title ? (
              <Text style={T.h2} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {subtitle ? <Text style={[T.muted, { marginTop: 2 }]}>{subtitle}</Text> : null}
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
      <Text style={T.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          placeholderTextColor={C.faint}
          selectionColor={C.text}
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
        <Text style={[T.body, { fontWeight: '700' }]}>{label}</Text>
      </Pressable>
      <IconButton icon="chevron-forward" onPress={onNext} label="Next day" filled disabled={nextDisabled} />
    </View>
  );
}

export function Empty({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={30} color={C.faint} />
      <Text style={[T.body, { fontWeight: '700', marginTop: 10 }]}>{title}</Text>
      <Text style={[T.muted, { textAlign: 'center', marginTop: 4, lineHeight: 20 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: PAD,
    paddingBottom: 8,
    minHeight: 52,
  },
  footer: { paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 12 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16 },
  primary: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  primaryText: { color: C.ink, fontSize: 17, fontWeight: '700' },
  ghost: {
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  ghostOutline: { borderWidth: 1, borderColor: C.line },
  ghostText: { fontSize: 16, fontWeight: '600' },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 3 },
  segment: { flex: 1, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segmentText: { color: C.muted, fontSize: 14, fontWeight: '700' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: PAD,
    paddingTop: 10,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  grab: {
    alignSelf: 'center',
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 14,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card2,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginTop: 6,
    height: 50,
    gap: 8,
  },
  input: { flex: 1, minWidth: 0, color: C.text, fontSize: 17, height: 50, padding: 0 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20 },
});
