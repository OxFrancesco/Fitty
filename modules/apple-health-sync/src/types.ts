export type AppleHealthRecordKind = 'weight' | 'sleep' | 'workout';

export type AppleHealthSyncRecord = {
  kind: AppleHealthRecordKind;
  sourceId: string;
  sourceDataType: string;
  syncIdentifier: string;
  syncVersion: number;
  payloadHash: string;
  startTime: string;
  endTime?: string;
  name?: string;
  valueKg?: number;
  googleExerciseType?: string;
  caloriesKcal?: number;
  distanceMeters?: number;
};

export type AppleHealthAuthorizationStatus = {
  available: boolean;
  requestSucceeded: boolean;
  allAuthorized: boolean;
  statuses: Record<string, string>;
};

export type AppleHealthWriteResult = {
  requested: number;
  saved: number;
};

export type AppleHealthSyncNativeModule = {
  isAvailable(): Promise<boolean>;
  authorizationStatus(): Promise<AppleHealthAuthorizationStatus>;
  requestAuthorization(): Promise<AppleHealthAuthorizationStatus>;
  writeRecords(records: AppleHealthSyncRecord[]): Promise<AppleHealthWriteResult>;
};
