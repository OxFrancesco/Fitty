import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { MetricIcon } from '@/components/metric-icon';
import { ThemedText } from '@/components/themed-text';
import { ErrorRed, MetricCardMinHeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMetricValue, type HealthMetric } from '@/lib/google-health';
import { type MetricDef } from '@/lib/metric-catalog';

/**
 * One dashboard metric card. Animates in/out when added or removed and
 * slides smoothly when the grid reflows around it.
 */
export function MetricCard({ def, metric }: { def: MetricDef; metric?: HealthMetric }) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.duration(350)}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.springify().damping(18)}
      style={[styles.card, { backgroundColor: theme.card }]}
    >
      <View style={styles.headerRow}>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {def.label}
        </ThemedText>
        <MetricIcon icon={def.icon} glyph={def.glyph} size={16} color={theme.textSecondary} />
      </View>

      <View style={styles.body}>
        <View style={styles.valueRow}>
          <ThemedText type="metric">{metric ? formatMetricValue(metric) : '--'}</ThemedText>
          {def.unit.toLowerCase() !== def.label.toLowerCase() && (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {def.unit}
            </ThemedText>
          )}
        </View>

        {metric?.status === 'error' && (
          <ThemedText type="caption" style={{ color: ErrorRed }} numberOfLines={1}>
            {metric.error}
          </ThemedText>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: Spacing.three,
    minWidth: 140,
    minHeight: MetricCardMinHeight,
    flexGrow: 1,
    flexBasis: '40%',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  body: {
    gap: Spacing.half,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
});
