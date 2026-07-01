import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** Staggered entrance for screen sections — one orchestrated page load. */
export function Section({ index, children }: { index: number; children: ReactNode }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(450).delay(index * 70)}
      style={{ gap: Spacing.three }}
    >
      {children}
    </Animated.View>
  );
}

export function SectionHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="subtitle">{title}</ThemedText>
      {trailing}
    </View>
  );
}

export function TextButton({
  label,
  onPress,
  disabled,
  color,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  color: string;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
