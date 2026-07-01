import { type BleError } from 'react-native-ble-plx';

export const WEIGHT_SCALE_SERVICE = '181d';

const WEIGHT_MEASUREMENT_CHARACTERISTIC = '2a9d';
const BATTERY_LEVEL_CHARACTERISTIC = '2a19';

const DEVICE_INFO_STRING_CHARACTERISTICS = new Set([
  '2a24',
  '2a25',
  '2a26',
  '2a27',
  '2a28',
  '2a29',
  '2a2a',
  '2a50',
]);

const UUID_LABELS: Record<string, string> = {
  '180a': 'Device Information',
  '180f': 'Battery',
  '181d': 'Weight Scale',
  '2a19': 'Battery Level',
  '2a24': 'Model Number',
  '2a25': 'Serial Number',
  '2a26': 'Firmware Revision',
  '2a27': 'Hardware Revision',
  '2a28': 'Software Revision',
  '2a29': 'Manufacturer Name',
  '2a2a': 'IEEE Certification',
  '2a50': 'PnP ID',
  '2a9d': 'Weight Measurement',
  '2a9e': 'Weight Scale Feature',
};

export type DecodedValue = {
  text: string;
  details: string[];
};

export function isLikelyFitbitDevice(name: string, serviceUUIDs: string[]) {
  const lowerName = name.toLowerCase();
  return (
    lowerName.includes('fitbit') ||
    lowerName.includes('aria') ||
    serviceUUIDs.some((uuid) => shortUuid(uuid) === WEIGHT_SCALE_SERVICE)
  );
}

export function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.toLowerCase()))];
}

export function labelForUuid(uuid: string) {
  const short = shortUuid(uuid);
  return UUID_LABELS[short] ?? short.toUpperCase();
}

export function shortUuid(uuid: string) {
  const lower = uuid.toLowerCase();
  const match = lower.match(/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/);
  return match?.[1] ?? lower;
}

export function decodeCharacteristicValue(uuid: string, valueBase64: string): DecodedValue | null {
  const short = shortUuid(uuid);
  const bytes = base64ToBytes(valueBase64);

  if (bytes.length === 0) {
    return null;
  }

  if (short === WEIGHT_MEASUREMENT_CHARACTERISTIC) {
    return decodeWeightMeasurement(bytes);
  }

  if (short === BATTERY_LEVEL_CHARACTERISTIC) {
    return {
      text: `${bytes[0]}%`,
      details: ['Battery Level'],
    };
  }

  if (DEVICE_INFO_STRING_CHARACTERISTICS.has(short)) {
    const text = bytesToUtf8(bytes).trim();

    if (text.length > 0) {
      return {
        text,
        details: [labelForUuid(uuid)],
      };
    }
  }

  return null;
}

function decodeWeightMeasurement(bytes: number[]): DecodedValue | null {
  if (bytes.length < 3) {
    return null;
  }

  const flags = bytes[0];
  const isImperial = Boolean(flags & 0x01);
  const rawWeight = readUInt16LE(bytes, 1);
  const weight = rawWeight * (isImperial ? 0.01 : 0.005);
  const unit = isImperial ? 'lb' : 'kg';
  const details = ['Weight Measurement'];
  let offset = 3;

  if (flags & 0x02 && bytes.length >= offset + 7) {
    const year = readUInt16LE(bytes, offset);
    const month = bytes[offset + 2];
    const day = bytes[offset + 3];
    const hour = bytes[offset + 4];
    const minute = bytes[offset + 5];
    const second = bytes[offset + 6];
    offset += 7;

    if (year && month && day) {
      details.push(
        `${year}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}`
      );
    }
  }

  if (flags & 0x04 && bytes.length > offset) {
    details.push(`User ${bytes[offset]}`);
    offset += 1;
  }

  if (flags & 0x08 && bytes.length >= offset + 4) {
    const bmi = readUInt16LE(bytes, offset) * 0.1;
    const height = readUInt16LE(bytes, offset + 2) * (isImperial ? 0.1 : 0.001);
    details.push(`BMI ${formatNumber(bmi, 1)}`);
    details.push(`Height ${formatNumber(height, isImperial ? 1 : 3)} ${isImperial ? 'in' : 'm'}`);
  }

  return {
    text: `${formatNumber(weight, isImperial ? 2 : 2)} ${unit}`,
    details,
  };
}

export function base64ToBytes(value: string): number[] {
  try {
    return Array.from(atob(value.replace(/\s/g, '')), (char) => char.charCodeAt(0));
  } catch {
    return [];
  }
}

export function bytesToHex(bytes: number[]) {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

function bytesToUtf8(bytes: number[]) {
  try {
    return decodeURIComponent(bytes.map((byte) => `%${byte.toString(16).padStart(2, '0')}`).join(''));
  } catch {
    return String.fromCharCode(...bytes).replace(/[^\x20-\x7e]/g, '');
  }
}

function readUInt16LE(bytes: number[], offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function formatNumber(value: number, digits: number) {
  return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

export function formatError(error: unknown) {
  const bleError = error as Partial<BleError> | null;
  return (
    bleError?.reason ??
    bleError?.message ??
    (error instanceof Error ? error.message : String(error || 'Unknown Bluetooth error'))
  );
}
