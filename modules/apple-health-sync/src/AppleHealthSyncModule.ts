import type {
  AppleHealthAuthorizationStatus,
  AppleHealthSyncNativeModule,
  AppleHealthWriteResult,
} from './types';

const unavailableStatus: AppleHealthAuthorizationStatus = {
  available: false,
  requestSucceeded: false,
  allAuthorized: false,
  statuses: {},
};

const AppleHealthSyncModule: AppleHealthSyncNativeModule = {
  isAvailable: async () => false,
  authorizationStatus: async () => unavailableStatus,
  requestAuthorization: async () => unavailableStatus,
  writeRecords: async (records): Promise<AppleHealthWriteResult> => ({
    requested: records.length,
    saved: 0,
  }),
};

export default AppleHealthSyncModule;
