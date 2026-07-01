import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

const DEFAULT_PRODUCTION_API_BASE_URL = 'https://avg-francesco-fitty.expo.app';

function isLocalApiBaseUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    );
  } catch {
    return false;
  }
}

function hostUriToOrigin(hostUri: string) {
  const normalized = hostUri.replace(/^https?:\/\//, '');
  return `http://${normalized}`;
}

function urlToOrigin(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

export function getApiBaseUrl() {
  const explicitBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (explicitBaseUrl) {
    const normalizedExplicitBaseUrl = trimTrailingSlash(explicitBaseUrl);

    // On native, an explicit localhost/LAN base URL is ignored in favor of the
    // Metro-derived origin below — the URL that works in a desktop browser is
    // usually unreachable from a device, and dev auto-detection does better.
    if (Platform.OS === 'web' || !isLocalApiBaseUrl(normalizedExplicitBaseUrl)) {
      return normalizedExplicitBaseUrl;
    }
  }

  if (!__DEV__) {
    return DEFAULT_PRODUCTION_API_BASE_URL;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }

  const sourceCode = NativeModules.SourceCode as { scriptURL?: string } | undefined;
  const bundleOrigin = urlToOrigin(sourceCode?.scriptURL);

  if (bundleOrigin) {
    return bundleOrigin;
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

  return DEFAULT_PRODUCTION_API_BASE_URL;
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
