import { Stack } from 'expo-router';
import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type LegalPageProps = {
  title: string;
  updated: string;
  children: ReactNode;
};

type LegalSectionProps = {
  title: string;
  children: ReactNode;
};

export const OPENFIT_CONTACT_EMAIL = 'oddofrancesco000@gmail.com';
export const OPENFIT_PROVIDER = 'Francesco Oddo';

export function LegalPage({ title, updated, children }: LegalPageProps) {
  const theme = useTheme();

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView
        style={[styles.screen, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <ThemedText type="title">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Effective date: {updated}
          </ThemedText>
        </View>

        <View style={styles.body}>{children}</View>
      </ScrollView>
    </>
  );
}

export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">{title}</ThemedText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  return <ThemedText style={styles.paragraph}>{children}</ThemedText>;
}

export function LegalBullet({ children }: { children: ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <ThemedText style={styles.bulletMarker}>-</ThemedText>
      <ThemedText style={styles.bulletText}>{children}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
  },
  header: {
    marginBottom: Spacing.four,
  },
  body: {
    width: '100%',
  },
  section: {
    marginBottom: Spacing.four,
  },
  sectionBody: {
    marginTop: Spacing.two,
  },
  paragraph: {
    marginBottom: Spacing.three,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.two,
  },
  bulletMarker: {
    width: 16,
    lineHeight: 21,
  },
  bulletText: {
    flex: 1,
    lineHeight: 21,
  },
});
