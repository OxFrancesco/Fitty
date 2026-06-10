import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { RingColors, RingGoals, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Geometry ──────────────────────────────────────────────────────────────────

const SIZE = 168;
const STROKE = 14;
const GAP = 4;
const CENTER = SIZE / 2;
const RADII = [
  (SIZE - STROKE) / 2,
  (SIZE - STROKE) / 2 - (STROKE + GAP),
  (SIZE - STROKE) / 2 - 2 * (STROKE + GAP),
] as const;

type RingDef = {
  key: keyof typeof RingColors;
  label: string;
  goal: number;
  color: string;
};

const RINGS: RingDef[] = [
  { key: 'steps', label: 'Steps', goal: RingGoals.steps, color: RingColors.steps },
  { key: 'calories', label: 'Calories', goal: RingGoals.calories, color: RingColors.calories },
  { key: 'minutes', label: 'Minutes', goal: RingGoals.minutes, color: RingColors.minutes },
];

// ─── Animated SVG ring ─────────────────────────────────────────────────────────

function ProgressRing({
  radius,
  color,
  targetProgress,
  delay,
}: {
  radius: number;
  color: string;
  targetProgress: number;
  delay: number;
}) {
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(targetProgress, { duration: 1100, easing: Easing.out(Easing.cubic) })
    );
  }, [targetProgress, delay, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <>
      {/* Track */}
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={radius}
        stroke={color + '26'}
        strokeWidth={STROKE}
        fill="none"
      />
      {/* Progress arc, starting at 12 o'clock */}
      <AnimatedCircle
        cx={CENTER}
        cy={CENTER}
        r={radius}
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={`${circumference}`}
        animatedProps={animatedProps}
        fill="none"
        transform={`rotate(-90 ${CENTER} ${CENTER})`}
      />
    </>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

type RingData = {
  steps: number | null;
  calories: number | null;
  minutes: number | null;
};

export function ActivityRings({ data }: { data: RingData }) {
  const theme = useTheme();

  const values: Record<string, number | null> = {
    steps: data.steps,
    calories: data.calories,
    minutes: data.minutes,
  };

  return (
    <View style={styles.row}>
      <Svg width={SIZE} height={SIZE}>
        {RINGS.map((ring, i) => {
          const value = values[ring.key];
          const fraction = value !== null ? Math.min(value / ring.goal, 1) : 0;

          return (
            <ProgressRing
              key={ring.key}
              radius={RADII[i]}
              color={ring.color}
              targetProgress={fraction}
              delay={i * 150}
            />
          );
        })}
      </Svg>

      {/* Values beside the rings, Apple Fitness style */}
      <View style={styles.legend}>
        {RINGS.map((ring) => {
          const value = values[ring.key];
          const displayValue = value !== null ? Math.round(value).toLocaleString() : '--';

          return (
            <View key={ring.key} style={styles.legendItem}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {ring.label}
              </ThemedText>
              <View style={styles.valueRow}>
                <ThemedText style={[styles.value, { color: ring.color }]}>
                  {displayValue}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  /{ring.goal.toLocaleString()}
                </ThemedText>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  legend: {
    gap: Spacing.three,
  },
  legendItem: {
    gap: Spacing.half,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  value: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
});
