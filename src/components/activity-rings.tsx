import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MetricIcon } from '@/components/metric-icon';
import { RingsGraphic } from '@/components/rings-graphic';
import { type RingProgress } from '@/components/rings-geometry';
import { ThemedText } from '@/components/themed-text';
import { RingColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getMetricDef, RING_ELIGIBLE_METRICS } from '@/lib/metric-catalog';

/** Slot colors: outer (blue), middle (red), inner (green) */
const SLOT_COLORS = [RingColors.steps, RingColors.calories, RingColors.minutes] as const;

export type RingSlot = {
  metricId: string;
  value: number | null;
  goal: number;
};

function formatAmount(value: number | null, fractionDigits = 0) {
  if (value === null) {
    return '--';
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
}

export function ActivityRings({
  slots,
  editingSlot,
  onEditSlot,
  onSelectMetric,
  onChangeGoal,
}: {
  slots: RingSlot[];
  /** Slot whose editor sheet is open, or null when closed */
  editingSlot: number | null;
  onEditSlot: (slot: number | null) => void;
  /** Put a different metric on a ring slot */
  onSelectMetric: (slot: number, metricId: string) => void;
  /** Adjust the goal for a metric (shared across slots) */
  onChangeGoal: (metricId: string, goal: number) => void;
}) {
  const theme = useTheme();

  const ringProgress: RingProgress[] = slots.map((slot, i) => ({
    // Keyed by metric so switching a slot's metric replays the fill animation.
    key: `${i}-${slot.metricId}`,
    color: SLOT_COLORS[i],
    // Uncapped — past 100% the heart wraps onto a second lap.
    progress: slot.value !== null && slot.goal > 0 ? slot.value / slot.goal : 0,
    delay: i * 150,
  }));

  const editing = editingSlot !== null ? slots[editingSlot] : null;
  const editingDef = editing ? getMetricDef(editing.metricId) : undefined;
  const usedElsewhere = new Set(
    slots.filter((_, i) => i !== editingSlot).map((slot) => slot.metricId)
  );

  return (
    <View style={styles.row}>
      <RingsGraphic rings={ringProgress} />

      {/* Values beside the rings, Apple Fitness style */}
      <View style={styles.legend}>
        {slots.map((slot, i) => {
          const def = getMetricDef(slot.metricId);

          return (
            <Pressable
              key={`${i}-${slot.metricId}`}
              accessibilityRole="button"
              accessibilityLabel={`${def?.label ?? slot.metricId} ring. Change metric or goal`}
              hitSlop={8}
              onPress={() => onEditSlot(i)}
              style={({ pressed }) => [styles.legendItem, pressed && styles.pressed]}
            >
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {def?.shortLabel ?? def?.label ?? slot.metricId}
              </ThemedText>
              <View style={styles.valueRow}>
                <ThemedText style={[styles.value, { color: SLOT_COLORS[i] }]}>
                  {formatAmount(slot.value, def?.fractionDigits)}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  /{formatAmount(slot.goal, def?.fractionDigits)}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Modal
        visible={editingSlot !== null}
        transparent
        animationType="fade"
        onRequestClose={() => onEditSlot(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => onEditSlot(null)}>
          {/* Swallow presses so taps inside the sheet don't close it */}
          <Pressable style={[styles.sheet, { backgroundColor: theme.card }]}>
            {editing && editingDef && editingSlot !== null && (
              <>
                <View style={styles.sheetHeader}>
                  {/* Slot switcher — one dot per ring */}
                  <View style={styles.slotSwitcher}>
                    {slots.map((_, i) => (
                      <Pressable
                        key={i}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ring ${i + 1}`}
                        hitSlop={8}
                        onPress={() => onEditSlot(i)}
                        style={[
                          styles.switchDot,
                          { backgroundColor: SLOT_COLORS[i] },
                          i !== editingSlot && styles.switchDotInactive,
                        ]}
                      />
                    ))}
                  </View>
                  <Pressable hitSlop={8} onPress={() => onEditSlot(null)}>
                    <ThemedText type="smallBold">Done</ThemedText>
                  </Pressable>
                </View>

                <ThemedText type="subtitle">{editingDef.label}</ThemedText>

                {/* Goal stepper */}
                <View style={[styles.goalRow, { backgroundColor: theme.backgroundSelected }]}>
                  <StepperButton
                    label="−"
                    disabled={editing.goal <= (editingDef.ring?.step ?? 1)}
                    onPress={() =>
                      onChangeGoal(
                        editing.metricId,
                        Math.max(
                          editingDef.ring?.step ?? 1,
                          editing.goal - (editingDef.ring?.step ?? 1)
                        )
                      )
                    }
                  />
                  <View style={styles.goalValue}>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      Daily goal
                    </ThemedText>
                    <ThemedText type="smallBold">
                      {formatAmount(editing.goal, editingDef.fractionDigits)} {editingDef.unit}
                    </ThemedText>
                  </View>
                  <StepperButton
                    label="+"
                    onPress={() =>
                      onChangeGoal(editing.metricId, editing.goal + (editingDef.ring?.step ?? 1))
                    }
                  />
                </View>

                <ScrollView style={styles.options} showsVerticalScrollIndicator={false}>
                  {RING_ELIGIBLE_METRICS.filter((def) => !usedElsewhere.has(def.id)).map((def) => {
                    const selected = def.id === editing.metricId;

                    return (
                      <Pressable
                        key={def.id}
                        accessibilityRole="button"
                        onPress={() => onSelectMetric(editingSlot, def.id)}
                        style={({ pressed }) => [
                          styles.option,
                          selected && { backgroundColor: theme.backgroundSelected },
                          pressed && styles.pressed,
                        ]}
                      >
                        <MetricIcon
                          icon={def.icon}
                          glyph={def.glyph}
                          size={18}
                          color={selected ? SLOT_COLORS[editingSlot] : theme.textSecondary}
                        />
                        <View style={styles.optionText}>
                          <ThemedText type="default" style={selected && styles.optionSelected}>
                            {def.label}
                          </ThemedText>
                          <ThemedText type="small" style={{ color: theme.textSecondary }}>
                            {def.unit}
                          </ThemedText>
                        </View>
                        {selected && (
                          <ThemedText type="default" style={{ color: SLOT_COLORS[editingSlot] }}>
                            ✓
                          </ThemedText>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function StepperButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepper,
        { backgroundColor: theme.card },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <ThemedText type="subtitle" style={styles.stepperLabel}>
        {label}
      </ThemedText>
    </Pressable>
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
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingBottom: Spacing.one,
  },
  slotSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  switchDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  switchDotInactive: {
    opacity: 0.3,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: 10,
    borderCurve: 'continuous',
    padding: Spacing.one,
  },
  goalValue: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  stepper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperLabel: {
    lineHeight: 24,
  },
  options: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  optionText: {
    flex: 1,
    gap: Spacing.half,
  },
  optionSelected: {
    fontWeight: 600,
  },
});
