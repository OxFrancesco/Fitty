import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MetricIcon } from '@/components/metric-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  METRIC_CATALOG,
  METRIC_CATEGORIES,
  SLEEP_CARD,
  type MetricCategory,
} from '@/lib/metric-catalog';

type EditorEntry = {
  id: string;
  label: string;
  unit?: string;
  icon: string;
  glyph: string;
  category: MetricCategory;
};

const ENTRIES: EditorEntry[] = [
  ...METRIC_CATALOG.map((def) => ({
    id: def.id,
    label: def.label,
    unit: def.unit,
    icon: def.icon,
    glyph: def.glyph,
    category: def.category,
  })),
  SLEEP_CARD,
];

/** Sheet listing every available metric, grouped by category, with toggles. */
export function CardEditor({
  visible,
  selected,
  onToggle,
  onClose,
}: {
  visible: boolean;
  selected: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const selectedSet = new Set(selected);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallow presses so taps inside the sheet don't close it */}
        <Pressable style={[styles.sheet, { backgroundColor: theme.card }]}>
          <View style={styles.sheetHeader}>
            <View>
              <ThemedText type="subtitle">Cards</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Choose what shows on your dashboard
              </ThemedText>
            </View>
            <Pressable hitSlop={8} onPress={onClose}>
              <ThemedText type="smallBold">Done</ThemedText>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {METRIC_CATEGORIES.map((category) => {
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
                    const isOn = selectedSet.has(entry.id);

                    return (
                      <Pressable
                        key={entry.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isOn }}
                        onPress={() => onToggle(entry.id)}
                        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                      >
                        <MetricIcon
                          icon={entry.icon}
                          glyph={entry.glyph}
                          size={18}
                          color={isOn ? theme.text : theme.textSecondary}
                        />
                        <View style={styles.rowText}>
                          <ThemedText type="default">{entry.label}</ThemedText>
                          {entry.unit ? (
                            <ThemedText type="small" style={{ color: theme.textSecondary }}>
                              {entry.unit}
                            </ThemedText>
                          ) : null}
                        </View>
                        <View
                          style={[
                            styles.check,
                            { borderColor: theme.textSecondary },
                            isOn && { backgroundColor: theme.text, borderColor: theme.text },
                          ]}
                        >
                          {isOn && (
                            <ThemedText type="caption" style={{ color: theme.background }}>
                              ✓
                            </ThemedText>
                          )}
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
    maxWidth: 360,
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
    gap: Spacing.half,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
