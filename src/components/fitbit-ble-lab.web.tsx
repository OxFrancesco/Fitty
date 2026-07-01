import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function FitbitBleLab() {
  const theme = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.container}>
        <ThemedText type="title">Fitbit BLE Lab</ThemedText>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <ThemedText type="smallBold">Native build required</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Bluetooth scanning is available only in the iOS or Android development build.
          </ThemedText>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    paddingTop: Spacing.four,
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  card: {
    gap: Spacing.two,
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
});
