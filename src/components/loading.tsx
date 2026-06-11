import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { MetricCardMinHeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Loading primitives — a soft breathing skeleton for first loads and a
 * staggered dot wave for in-place refreshes. Monochrome, like the rest
 * of the app; motion is the only embellishment.
 */

// ─── Skeleton ──────────────────────────────────────────────────────────────────

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** A single shimmer block that breathes between 45% and 85% opacity. */
export function Skeleton({ width = '100%', height = 16, radius = 6, style }: SkeletonProps) {
  const theme = useTheme();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 850, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + pulse.value * 0.4,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          borderCurve: 'continuous',
          backgroundColor: theme.backgroundSelected,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Card-shaped skeleton matching the dashboard metric cards. */
export function SkeletonCard() {
  const theme = useTheme();

  return (
    <View style={[styles.skeletonCard, { backgroundColor: theme.card }]}>
      <Skeleton width="55%" height={12} />
      <Skeleton width="70%" height={26} radius={8} />
    </View>
  );
}

// ─── Loading dots ──────────────────────────────────────────────────────────────

function Dot({ index, color, size }: { index: number; color: string; size: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      index * 160,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 360, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 320 })
        ),
        -1
      )
    );
  }, [index, t]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + t.value * 0.65,
    transform: [{ translateY: -0.5 * size * t.value }],
  }));

  return (
    <Animated.View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
}

/** Three dots rising in a gentle wave — replaces ActivityIndicator. */
export function LoadingDots({ color, size = 6 }: { color: string; size?: number }) {
  return (
    <View style={styles.dotsRow}>
      {[0, 1, 2].map((index) => (
        <Dot key={index} index={index} color={color} size={size} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonCard: {
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: Spacing.three,
    minWidth: 140,
    minHeight: MetricCardMinHeight,
    flexGrow: 1,
    flexBasis: '40%',
    gap: Spacing.two,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
});
