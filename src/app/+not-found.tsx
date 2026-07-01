import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { pickOAuthParams } from '@/lib/oauth-params';

export default function NotFoundRoute() {
  const theme = useTheme();
  const params = useLocalSearchParams<Record<string, string | string[]>>();

  // OAuth callbacks can land on unknown paths (e.g. a custom-scheme host that
  // does not match a route) — forward them to the home screen for completion.
  const oauthParams = pickOAuthParams(params);

  if (Object.keys(oauthParams).length > 0) {
    return <Redirect href={{ pathname: '/', params: oauthParams }} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ThemedText type="subtitle">Screen not found</ThemedText>
      <Link href="/">
        <ThemedText type="smallBold" style={{ color: theme.text }}>
          Go to dashboard
        </ThemedText>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
});
