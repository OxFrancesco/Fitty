import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type HealthCardProps = {
  label: string;
  value: string;
  unit: string;
  subtitle?: string;
};

export function HealthCard({ label, value, unit, subtitle }: HealthCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
        {label}
      </ThemedText>

      <View style={styles.valueRow}>
        <ThemedText type="metric">{value}</ThemedText>
        {unit ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {unit}
          </ThemedText>
        ) : null}
      </View>

      {subtitle ? (
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.one,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
});
