import { requireNativeModule } from 'expo';

import type { AppleHealthSyncNativeModule } from './types';

export default requireNativeModule<AppleHealthSyncNativeModule>('AppleHealthSync');
