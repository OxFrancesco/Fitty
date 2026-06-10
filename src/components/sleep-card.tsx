import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SleepSummary } from '@/lib/google-health';

const PAGE_HEIGHT = 36;

export function SleepCard({ sessions }: { sessions: SleepSummary[] }) {
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const pagerRef = useRef<ScrollView>(null);

  const onPageScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.y / PAGE_HEIGHT);
    setPage(Math.min(Math.max(next, 0), sessions.length - 1));
  };

  const goToPage = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), sessions.length - 1);
    setPage(clamped);
    pagerRef.current?.scrollTo({ y: clamped * PAGE_HEIGHT, animated: true });
  };

  const current = sessions[page];

  return (
    <View style={styles.wrapper}>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.headerRow}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Sleep
          </ThemedText>
          {sessions.length > 1 && (
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {page + 1} of {sessions.length}
            </ThemedText>
          )}
        </View>

        {sessions.length === 0 ? (
          <View style={styles.page}>
            <ThemedText type="metric">--</ThemedText>
          </View>
        ) : (
          <View style={styles.body}>
            <ScrollView
              ref={pagerRef}
              style={{ height: PAGE_HEIGHT, flexGrow: 0, flexShrink: 1 }}
              pagingEnabled
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              onMomentumScrollEnd={onPageScroll}
            >
              {sessions.map((session) => (
                <View key={session.id} style={styles.page}>
                  <ThemedText type="metric">{formatSleepDuration(session)}</ThemedText>
                </View>
              ))}
            </ScrollView>

            {sessions.length > 1 && (
              <View style={styles.arrows}>
                <Pressable hitSlop={8} disabled={page === 0} onPress={() => goToPage(page - 1)}>
                  <ThemedText
                    style={[
                      styles.arrow,
                      { color: theme.textSecondary },
                      page === 0 && styles.arrowDisabled,
                    ]}
                  >
                    ▲
                  </ThemedText>
                </Pressable>
                <Pressable
                  hitSlop={8}
                  disabled={page === sessions.length - 1}
                  onPress={() => goToPage(page + 1)}
                >
                  <ThemedText
                    style={[
                      styles.arrow,
                      { color: theme.textSecondary },
                      page === sessions.length - 1 && styles.arrowDisabled,
                    ]}
                  >
                    ▼
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>

      {current && (
        <ThemedText
          type="caption"
          style={[styles.label, { color: theme.textSecondary }]}
          numberOfLines={2}
        >
          {current.kind === 'nap' ? 'Nap' : 'Night'}
          {current.endTime ? ` · ended ${formatDateTime(current.endTime)}` : ''}
        </ThemedText>
      )}
    </View>
  );
}

function formatSleepDuration(session: SleepSummary) {
  const minutes = session.minutesAsleep ?? session.minutesInSleepPeriod;

  if (minutes === null) {
    return '--';
  }

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minWidth: 140,
    gap: Spacing.one + Spacing.half,
  },
  card: {
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.one,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  page: {
    height: PAGE_HEIGHT,
    justifyContent: 'center',
  },
  arrows: {
    gap: Spacing.one,
    alignItems: 'center',
  },
  arrow: {
    fontSize: 9,
    lineHeight: 11,
  },
  arrowDisabled: {
    opacity: 0.25,
  },
  label: {
    paddingHorizontal: Spacing.one,
  },
});
