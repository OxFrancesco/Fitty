import Constants from 'expo-constants';
import { Platform } from 'react-native';

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function hostUriToOrigin(hostUri: string) {
  const normalized = hostUri.replace(/^https?:\/\//, '');
  return `http://${normalized}`;
}

export function getApiBaseUrl() {
  const explicitBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (explicitBaseUrl) {
    return trimTrailingSlash(explicitBaseUrl);
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }

  const constants = Constants as typeof Constants & {
    manifest?: { debuggerHost?: string };
    manifest2?: { extra?: { expoClient?: { hostUri?: string }; expoGo?: { debuggerHost?: string } } };
  };

  const hostUri =
    Constants.expoConfig?.hostUri ??
    constants.manifest2?.extra?.expoClient?.hostUri ??
    constants.manifest2?.extra?.expoGo?.debuggerHost ??
    constants.manifest?.debuggerHost;

  if (hostUri) {
    return hostUriToOrigin(hostUri);
  }

  return 'http://localhost:8081';
}

export async function fetchApiJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      typeof data?.error === 'string'
        ? data.error
        : typeof data?.message === 'string'
          ? data.message
          : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}
