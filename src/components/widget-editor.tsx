import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MetricIcon } from '@/components/metric-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { METRIC_CATALOG, METRIC_CATEGORIES, getMetricDef, type MetricCategory } from '@/lib/metric-catalog';
import { WIDGET_SLOT_COLORS } from '@/lib/widget-data';

const SLOT_LABELS = ['First', 'Second', 'Third'] as const;

type EditorEntry = {
  id: string;
  label: string;
  unit: string;
  icon: string;
  glyph: string;
  category: MetricCategory;
};

const ENTRIES: EditorEntry[] = METRIC_CATALOG.map((def) => ({
  id: def.id,
  label: def.label,
  unit: def.unit,
  icon: def.icon,
  glyph: def.glyph,
  category: def.category,
}));

export function WidgetEditor({
  visible,
  slots,
  editingSlot,
  onEditSlot,
  onSelect,
  onClose,
}: {
  visible: boolean;
  slots: [string, string, string];
  editingSlot: number;
  onEditSlot: (slot: number) => void;
  onSelect: (slot: number, metricId: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const usedElsewhere = new Set(slots.filter((_, i) => i !== editingSlot));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.card }]}>
          <View style={styles.sheetHeader}>
            <View>
              <ThemedText type="subtitle">Widgets</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Choose the widget slots
              </ThemedText>
            </View>
            <Pressable hitSlop={8} onPress={onClose}>
              <ThemedText type="smallBold">Done</ThemedText>
            </Pressable>
          </View>

          <View style={[styles.slotTabs, { backgroundColor: theme.backgroundSelected }]}>
            {slots.map((id, i) => {
              const active = i === editingSlot;
              const def = getMetricDef(id);

              return (
                <Pressable
                  key={`${i}-${id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => onEditSlot(i)}
                  style={({ pressed }) => [
                    styles.slotTab,
                    active && { backgroundColor: theme.card },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.slotDot, { backgroundColor: WIDGET_SLOT_COLORS[i] }]} />
                  <ThemedText type="caption" numberOfLines={1}>
                    {def?.shortLabel ?? def?.label ?? SLOT_LABELS[i]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {METRIC_CATEGORIES.filter((category) => category !== 'Sleep').map((category) => {
              const entries = ENTRIES.filter((entry) => entry.category === category);

              if (!entries.length) {
                return null;
              }

              return (
                <View key={category} style={styles.group}>
                  <ThemedText
                    type="caption"
                    style={[styles.groupTitle, { color: theme.textSecondary }]}
                  >
                    {category.toUpperCase()}
                  </ThemedText>

                  {entries.map((entry) => {
                    const selected = slots[editingSlot] === entry.id;
                    const disabled = usedElsewhere.has(entry.id);

                    return (
                      <Pressable
                        key={entry.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled }}
                        disabled={disabled}
                        onPress={() => onSelect(editingSlot, entry.id)}
                        style={({ pressed }) => [
                          styles.row,
                          selected && { backgroundColor: theme.backgroundSelected },
                          disabled && styles.disabled,
                          pressed && !disabled && styles.pressed,
                        ]}
                      >
                        <MetricIcon
                          icon={entry.icon}
                          glyph={entry.glyph}
                          size={18}
                          color={selected ? WIDGET_SLOT_COLORS[editingSlot] : theme.textSecondary}
                        />
                        <View style={styles.rowText}>
                          <ThemedText type="default">{entry.label}</ThemedText>
                          <ThemedText type="small" style={{ color: theme.textSecondary }}>
                            {entry.unit}
                          </ThemedText>
                        </View>
                        <View
                          style={[
                            styles.radio,
                            { borderColor: theme.textSecondary },
                            selected && { borderColor: WIDGET_SLOT_COLORS[editingSlot] },
                          ]}
                        >
                          {selected ? (
                            <View
                              style={[
                                styles.radioFill,
                                { backgroundColor: WIDGET_SLOT_COLORS[editingSlot] },
                              ]}
                            />
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingBottom: Spacing.one,
  },
  slotTabs: {
    flexDirection: 'row',
    borderRadius: 9,
    borderCurve: 'continuous',
    padding: 2,
    gap: 2,
  },
  slotTab: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: 7,
    borderCurve: 'continuous',
  },
  slotDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  group: {
    paddingBottom: Spacing.two,
  },
  groupTitle: {
    letterSpacing: 0.5,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
});
