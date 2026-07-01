import { Redirect, useLocalSearchParams } from 'expo-router';

import { pickOAuthParams } from '@/lib/oauth-params';

export default function OAuthRedirectRoute() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();

  return <Redirect href={{ pathname: '/', params: pickOAuthParams(params) }} />;
}
