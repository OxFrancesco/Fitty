import AppleHealthSyncModule from './AppleHealthSyncModule';

export type {
  AppleHealthAuthorizationStatus,
  AppleHealthRecordKind,
  AppleHealthSyncNativeModule,
  AppleHealthSyncRecord,
  AppleHealthWriteResult,
} from './types';

export function isAppleHealthAvailable() {
  return AppleHealthSyncModule.isAvailable();
}

export function getAppleHealthAuthorizationStatus() {
  return AppleHealthSyncModule.authorizationStatus();
}

export function requestAppleHealthAuthorization() {
  return AppleHealthSyncModule.requestAuthorization();
}

export function writeAppleHealthRecords(
  records: import('./types').AppleHealthSyncRecord[]
) {
  return AppleHealthSyncModule.writeRecords(records);
}
