import { StyleSheet, View } from 'react-native';

import { RingsGraphic } from '@/components/rings-graphic';
import { type RingProgress } from '@/components/rings-geometry';
import { ThemedText } from '@/components/themed-text';
import { RingColors, RingGoals, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

  const rings: RingProgress[] = RINGS.map((ring, i) => {
    const value = values[ring.key];

    return {
      key: ring.key,
      color: ring.color,
      progress: value !== null ? Math.min(value / ring.goal, 1) : 0,
      delay: i * 150,
    };
  });

  return (
    <View style={styles.row}>
      <RingsGraphic rings={rings} />

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
