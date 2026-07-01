import { type Characteristic, type Device, type Service } from 'react-native-ble-plx';

import {
  base64ToBytes,
  bytesToHex,
  decodeCharacteristicValue,
  formatError,
  isLikelyFitbitDevice,
  labelForUuid,
  uniqueStrings,
  type DecodedValue,
} from '@/lib/ble-gatt';

export type ScannedDevice = {
  id: string;
  name: string;
  rssi: number | null;
  serviceUUIDs: string[];
  manufacturerData: string | null;
  rawScanRecord: string | null;
  isLikelyFitbit: boolean;
  lastSeenAt: number;
};

export type CharacteristicSummary = {
  uuid: string;
  label: string;
  isReadable: boolean;
  isWritableWithResponse: boolean;
  isWritableWithoutResponse: boolean;
  isNotifiable: boolean;
  isIndicatable: boolean;
  isMonitoring: boolean;
  valueBase64: string | null;
  valueHex: string | null;
  decodedText: string | null;
  readError: string | null;
  monitorError: string | null;
};

export type ServiceSummary = {
  uuid: string;
  label: string;
  characteristics: CharacteristicSummary[];
};

export type DataEvent = {
  id: string;
  receivedAt: number;
  source: 'read' | 'notify';
  serviceUUID: string;
  characteristicUUID: string;
  characteristicLabel: string;
  rawHex: string;
  decodedText: string | null;
  details: string[];
};

export function mergeDevice(current: Record<string, ScannedDevice>, device: Device) {
  const existing = current[device.id];
  const nextServiceUUIDs = uniqueStrings([...(existing?.serviceUUIDs ?? []), ...(device.serviceUUIDs ?? [])]);
  const name = device.name ?? device.localName ?? existing?.name ?? 'Unnamed BLE device';
  const next: ScannedDevice = {
    id: device.id,
    name,
    rssi: device.rssi ?? existing?.rssi ?? null,
    serviceUUIDs: nextServiceUUIDs,
    manufacturerData: device.manufacturerData ?? existing?.manufacturerData ?? null,
    rawScanRecord: device.rawScanRecord ?? existing?.rawScanRecord ?? null,
    isLikelyFitbit: isLikelyFitbitDevice(name, nextServiceUUIDs),
    lastSeenAt: Date.now(),
  };

  return { ...current, [device.id]: next };
}

export async function summarizeService(
  service: Service,
  appendDataEvent: (event: {
    source: DataEvent['source'];
    serviceUUID: string;
    characteristicUUID: string;
    rawHex: string;
    decoded: DecodedValue | null;
  }) => void
): Promise<ServiceSummary> {
  const characteristics = await service.characteristics();
  const summaries: CharacteristicSummary[] = [];

  for (const characteristic of characteristics) {
    summaries.push(await summarizeCharacteristic(service.uuid, characteristic, appendDataEvent));
  }

  return {
    uuid: service.uuid,
    label: labelForUuid(service.uuid),
    characteristics: summaries.sort((a, b) => a.label.localeCompare(b.label)),
  };
}

async function summarizeCharacteristic(
  serviceUUID: string,
  characteristic: Characteristic,
  appendDataEvent: (event: {
    source: DataEvent['source'];
    serviceUUID: string;
    characteristicUUID: string;
    rawHex: string;
    decoded: DecodedValue | null;
  }) => void
): Promise<CharacteristicSummary> {
  let valueBase64 = characteristic.value;
  let valueHex: string | null = valueBase64 ? bytesToHex(base64ToBytes(valueBase64)) : null;
  let decoded = valueBase64 ? decodeCharacteristicValue(characteristic.uuid, valueBase64) : null;
  let readError: string | null = null;

  if (characteristic.isReadable) {
    try {
      const readCharacteristic = await characteristic.read();
      valueBase64 = readCharacteristic.value;
      valueHex = valueBase64 ? bytesToHex(base64ToBytes(valueBase64)) : null;
      decoded = valueBase64 ? decodeCharacteristicValue(characteristic.uuid, valueBase64) : null;

      if (valueHex) {
        appendDataEvent({
          source: 'read',
          serviceUUID,
          characteristicUUID: characteristic.uuid,
          rawHex: valueHex,
          decoded,
        });
      }
    } catch (error) {
      readError = formatError(error);
    }
  }

  return {
    uuid: characteristic.uuid,
    label: labelForUuid(characteristic.uuid),
    isReadable: characteristic.isReadable,
    isWritableWithResponse: characteristic.isWritableWithResponse,
    isWritableWithoutResponse: characteristic.isWritableWithoutResponse,
    isNotifiable: characteristic.isNotifiable,
    isIndicatable: characteristic.isIndicatable,
    isMonitoring: false,
    valueBase64,
    valueHex,
    decodedText: decoded?.text ?? null,
    readError,
    monitorError: null,
  };
}

export function updateCharacteristicMonitoring(
  services: ServiceSummary[],
  serviceUUID: string,
  characteristicUUID: string
) {
  return services.map((service) =>
    service.uuid === serviceUUID
      ? {
          ...service,
          characteristics: service.characteristics.map((characteristic) =>
            characteristic.uuid === characteristicUUID
              ? { ...characteristic, isMonitoring: true, monitorError: null }
              : characteristic
          ),
        }
      : service
  );
}

export function updateCharacteristicMonitorError(
  services: ServiceSummary[],
  serviceUUID: string,
  characteristicUUID: string,
  monitorError: string
) {
  return services.map((service) =>
    service.uuid === serviceUUID
      ? {
          ...service,
          characteristics: service.characteristics.map((characteristic) =>
            characteristic.uuid === characteristicUUID ? { ...characteristic, monitorError } : characteristic
          ),
        }
      : service
  );
}

export function updateCharacteristicValue(
  services: ServiceSummary[],
  serviceUUID: string,
  characteristicUUID: string,
  valueBase64: string,
  valueHex: string,
  decoded: DecodedValue | null
) {
  return services.map((service) =>
    service.uuid === serviceUUID
      ? {
          ...service,
          characteristics: service.characteristics.map((characteristic) =>
            characteristic.uuid === characteristicUUID
              ? {
                  ...characteristic,
                  valueBase64,
                  valueHex,
                  decodedText: decoded?.text ?? null,
                }
              : characteristic
          ),
        }
      : service
  );
}
