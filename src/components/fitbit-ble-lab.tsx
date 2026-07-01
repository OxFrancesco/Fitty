import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BleManager, State, fullUUID, type Subscription } from 'react-native-ble-plx';

import {
  mergeDevice,
  summarizeService,
  updateCharacteristicMonitorError,
  updateCharacteristicMonitoring,
  updateCharacteristicValue,
  type CharacteristicSummary,
  type DataEvent,
  type ScannedDevice,
  type ServiceSummary,
} from '@/components/fitbit-ble-lab-model';
import { Section, SectionHeader } from '@/components/section';
import { ThemedText } from '@/components/themed-text';
import { ErrorRed, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  WEIGHT_SCALE_SERVICE,
  base64ToBytes,
  bytesToHex,
  decodeCharacteristicValue,
  formatError,
  labelForUuid,
  shortUuid,
  type DecodedValue,
} from '@/lib/ble-gatt';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';
type PermissionState = 'idle' | 'granted' | 'denied';
type BleState = State | 'Unavailable';

const BLE_STATE_SETTLE_TIMEOUT_MS = 5_000;

const CONNECTED_LOOKUP_SERVICES = ['1800', '1801', '180a', '180f', '181b', '181d'].map(fullUUID);

const RADIUS = 12;

export function FitbitBleLab() {
  const theme = useTheme();
  const managerRef = useRef<BleManager | null>(null);
  const monitorsRef = useRef<Subscription[]>([]);
  const connectedDeviceIdRef = useRef<string | null>(null);
  const eventCounterRef = useRef(0);
  const [bleState, setBleState] = useState<BleState>(State.Unknown);
  const [permissionState, setPermissionState] = useState<PermissionState>('idle');
  const [listState, setListState] = useState<LoadState>('idle');
  const [connectionState, setConnectionState] = useState<LoadState>('idle');
  const [devices, setDevices] = useState<Record<string, ScannedDevice>>({});
  const [connectedDevice, setConnectedDevice] = useState<ScannedDevice | null>(null);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [dataEvents, setDataEvents] = useState<DataEvent[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const clearMonitors = useCallback(() => {
    for (const subscription of monitorsRef.current) {
      subscription.remove();
    }

    monitorsRef.current = [];
  }, []);

  const appendDataEvent = useCallback(
    ({
      source,
      serviceUUID,
      characteristicUUID,
      rawHex,
      decoded,
    }: {
      source: DataEvent['source'];
      serviceUUID: string;
      characteristicUUID: string;
      rawHex: string;
      decoded: DecodedValue | null;
    }) => {
      eventCounterRef.current += 1;
      const id = `${Date.now()}-${eventCounterRef.current}`;
      const characteristicLabel = labelForUuid(characteristicUUID);

      setDataEvents((current) =>
        [
          {
            id,
            receivedAt: Date.now(),
            source,
            serviceUUID,
            characteristicUUID,
            characteristicLabel,
            rawHex,
            decodedText: decoded?.text ?? null,
            details: decoded?.details ?? [],
          },
          ...current,
        ].slice(0, 30)
      );
    },
    []
  );

  useEffect(() => {
    let manager: BleManager;

    try {
      manager = new BleManager();
      managerRef.current = manager;
    } catch (error) {
      setBleState('Unavailable');
      setMessage(formatError(error));
      return;
    }

    manager
      .state()
      .then((nextState) => {
        setBleState(nextState);
      })
      .catch((error) => {
        setBleState(State.Unknown);
        setMessage(formatError(error));
      });

    const stateSubscription = manager.onStateChange((nextState) => {
      setBleState(nextState);
    });

    return () => {
      stateSubscription.remove();
      clearMonitors();

      if (connectedDeviceIdRef.current) {
        manager.cancelDeviceConnection(connectedDeviceIdRef.current).catch(() => undefined);
      }

      manager.destroy().catch(() => undefined);
      managerRef.current = null;
    };
  }, [clearMonitors]);

  const sortedDevices = useMemo(
    () =>
      Object.values(devices).sort((a, b) => {
        if (a.isLikelyFitbit !== b.isLikelyFitbit) {
          return a.isLikelyFitbit ? -1 : 1;
        }

        return a.name.localeCompare(b.name);
      }),
    [devices]
  );

  const loadConnectedDevices = useCallback(async () => {
    const manager = managerRef.current;

    if (!manager) {
      setMessage('Bluetooth module is not available in this build.');
      setListState('error');
      return;
    }

    setListState('loading');
    setMessage('Checking Bluetooth state.');

    const hasPermission = await requestBlePermissions();
    setPermissionState(hasPermission ? 'granted' : 'denied');

    if (!hasPermission) {
      setMessage('Bluetooth permission was denied.');
      setListState('error');
      return;
    }

    const currentState = await waitForReadyBleState(manager, bleState, setBleState);

    if (currentState !== State.PoweredOn) {
      setMessage(messageForBleState(currentState));
      setListState('error');
      return;
    }

    setMessage(null);
    setDevices({});

    try {
      const connected = await manager.connectedDevices(CONNECTED_LOOKUP_SERVICES);

      setDevices(
        connected.reduce<Record<string, ScannedDevice>>((current, device) => mergeDevice(current, device), {})
      );
      setListState('loaded');

      if (connected.length === 0) {
        setMessage('No connected BLE devices found. Connect the device in system Bluetooth settings first.');
      }
    } catch (error) {
      setMessage(formatError(error));
      setListState('error');
    }
  }, [bleState]);

  const disconnect = useCallback(async () => {
    const manager = managerRef.current;
    const deviceId = connectedDeviceIdRef.current;

    clearMonitors();

    if (manager && deviceId) {
      await manager.cancelDeviceConnection(deviceId).catch(() => undefined);
    }

    connectedDeviceIdRef.current = null;
    setConnectedDevice(null);
    setServices([]);
    setConnectionState('idle');
  }, [clearMonitors]);

  const connectDevice = useCallback(
    async (device: ScannedDevice) => {
      const manager = managerRef.current;

      if (!manager) {
        setMessage('Bluetooth module is not available in this build.');
        setConnectionState('error');
        return;
      }

      clearMonitors();
      setConnectionState('loading');
      setConnectedDevice(device);
      setServices([]);
      setDataEvents([]);
      setMessage(null);

      if (connectedDeviceIdRef.current && connectedDeviceIdRef.current !== device.id) {
        await manager.cancelDeviceConnection(connectedDeviceIdRef.current).catch(() => undefined);
      }

      try {
        const connectionOptions =
          Platform.OS === 'android' ? { requestMTU: 247, timeout: 15_000 } : { timeout: 15_000 };
        const connected = await manager.connectToDevice(device.id, connectionOptions);
        connectedDeviceIdRef.current = connected.id;

        const discovered = await connected.discoverAllServicesAndCharacteristics();
        const discoveredServices = await discovered.services();
        const summaries: ServiceSummary[] = [];

        for (const service of discoveredServices) {
          summaries.push(await summarizeService(service, appendDataEvent));
        }

        setServices(
          summaries.sort((a, b) => {
            if (shortUuid(a.uuid) === WEIGHT_SCALE_SERVICE) {
              return -1;
            }
            if (shortUuid(b.uuid) === WEIGHT_SCALE_SERVICE) {
              return 1;
            }
            return a.label.localeCompare(b.label);
          })
        );
        setConnectionState('loaded');
        setMessage(null);

        for (const summary of summaries) {
          const service = discoveredServices.find((item) => item.uuid === summary.uuid);
          if (!service) {
            continue;
          }

          const characteristics = await service.characteristics();

          for (const characteristic of characteristics) {
            if (!characteristic.isNotifiable && !characteristic.isIndicatable) {
              continue;
            }

            try {
              const subscription = characteristic.monitor((error, nextCharacteristic) => {
                if (error) {
                  setMessage(formatError(error));
                  return;
                }

                if (!nextCharacteristic?.value) {
                  return;
                }

                const nextValue = nextCharacteristic.value;
                const decoded = decodeCharacteristicValue(nextCharacteristic.uuid, nextValue);
                const rawHex = bytesToHex(base64ToBytes(nextValue));

                appendDataEvent({
                  source: 'notify',
                  serviceUUID: characteristic.serviceUUID,
                  characteristicUUID: nextCharacteristic.uuid,
                  rawHex,
                  decoded,
                });

                setServices((current) =>
                  updateCharacteristicValue(
                    current,
                    characteristic.serviceUUID,
                    nextCharacteristic.uuid,
                    nextValue,
                    rawHex,
                    decoded
                  )
                );
              });

              monitorsRef.current.push(subscription);
              setServices((current) =>
                updateCharacteristicMonitoring(current, characteristic.serviceUUID, characteristic.uuid)
              );
            } catch (error) {
              setServices((current) =>
                updateCharacteristicMonitorError(
                  current,
                  characteristic.serviceUUID,
                  characteristic.uuid,
                  formatError(error)
                )
              );
            }
          }
        }
      } catch (error) {
        connectedDeviceIdRef.current = null;
        setConnectionState('error');
        setMessage(formatError(error));
      }
    },
    [appendDataEvent, clearMonitors]
  );

  const statusColor =
    listState === 'error' || connectionState === 'error' || permissionState === 'denied'
      ? ErrorRed
      : theme.textSecondary;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.container}>
        <Section index={0}>
          <ThemedText type="title">Fitbit BLE Lab</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Lists only BLE devices already connected to this phone. Direct BLE access depends on what
            the scale exposes over GATT.
          </ThemedText>
        </Section>

        <Section index={1}>
          <View style={styles.statusGrid}>
            <StatusTile title="Bluetooth" value={formatBleState(bleState)} />
            <StatusTile title="Permission" value={formatPermissionState(permissionState)} />
            <StatusTile title="Connection" value={formatLoadState(connectionState)} />
          </View>
          {message ? (
            <ThemedText type="small" style={{ color: statusColor }}>
              {message}
            </ThemedText>
          ) : null}
        </Section>

        <Section index={2}>
          <View style={styles.actionRow}>
            <ActionButton
              label={listState === 'loading' ? 'Loading' : 'Show connected'}
              disabled={listState === 'loading' || connectionState === 'loading'}
              primary
              onPress={loadConnectedDevices}
            />
            <ActionButton
              label="Disconnect"
              disabled={!connectedDevice}
              onPress={() => {
                disconnect().catch(() => undefined);
              }}
            />
          </View>
        </Section>

        <Section index={3}>
          <SectionHeader
            title="Connected Devices"
            trailing={
              listState === 'loading' ? (
                <ThemedText type="small" numberOfLines={1} style={{ color: theme.textSecondary }}>
                  Loading
                </ThemedText>
              ) : null
            }
          />
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            {sortedDevices.length > 0 ? (
              sortedDevices.map((device) => (
                <Pressable
                  key={device.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Connect to ${device.name}`}
                  disabled={connectionState === 'loading'}
                  onPress={() => {
                    connectDevice(device).catch(() => undefined);
                  }}
                  style={({ pressed }) => [
                    styles.deviceRow,
                    { borderColor: theme.separator },
                    pressed && styles.pressed,
                    connectedDevice?.id === device.id && {
                      backgroundColor: theme.backgroundSelected,
                    },
                  ]}
                >
                  <View style={styles.deviceMain}>
                    <View style={styles.deviceTitleRow}>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {device.name}
                      </ThemedText>
                      {device.isLikelyFitbit ? (
                        <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
                          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                            Fitbit
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                    <ThemedText type="code" numberOfLines={1} style={{ color: theme.textSecondary }}>
                      {device.id}
                    </ThemedText>
                    {device.serviceUUIDs.length > 0 ? (
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {device.serviceUUIDs.map(labelForUuid).join(', ')}
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              ))
            ) : (
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {listState === 'loading'
                  ? 'Checking devices connected to this phone.'
                  : 'No connected devices listed yet.'}
              </ThemedText>
            )}
          </View>
        </Section>

        {connectedDevice ? (
          <Section index={4}>
            <SectionHeader
              title="GATT Profile"
              trailing={
                <ThemedText type="small" numberOfLines={1} style={{ color: theme.textSecondary }}>
                  {connectedDevice.name}
                </ThemedText>
              }
            />
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              {connectionState === 'loading' ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Connecting and discovering services.
                </ThemedText>
              ) : null}
              {services.map((service) => (
                <View key={service.uuid} style={[styles.serviceBlock, { borderColor: theme.separator }]}>
                  <ThemedText type="smallBold">{service.label}</ThemedText>
                  <ThemedText type="code" style={{ color: theme.textSecondary }}>
                    {service.uuid}
                  </ThemedText>
                  <View style={styles.characteristics}>
                    {service.characteristics.map((characteristic) => (
                      <View
                        key={`${service.uuid}-${characteristic.uuid}`}
                        style={[styles.characteristicRow, { borderColor: theme.separator }]}
                      >
                        <View style={styles.characteristicMain}>
                          <ThemedText type="smallBold">{characteristic.label}</ThemedText>
                          <ThemedText type="code" style={{ color: theme.textSecondary }}>
                            {characteristic.uuid}
                          </ThemedText>
                          {characteristic.decodedText ? (
                            <ThemedText type="small">{characteristic.decodedText}</ThemedText>
                          ) : null}
                          {characteristic.valueHex ? (
                            <ThemedText
                              type="code"
                              numberOfLines={2}
                              style={{ color: theme.textSecondary }}
                            >
                              {characteristic.valueHex}
                            </ThemedText>
                          ) : null}
                          {characteristic.readError || characteristic.monitorError ? (
                            <ThemedText type="caption" style={{ color: ErrorRed }}>
                              {characteristic.readError ?? characteristic.monitorError}
                            </ThemedText>
                          ) : null}
                        </View>
                        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                          {formatProperties(characteristic)}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        <Section index={5}>
          <SectionHeader
            title="Data Events"
            trailing={
              dataEvents.length ? (
                <ThemedText type="small" numberOfLines={1} style={{ color: theme.textSecondary }}>
                  {String(dataEvents.length)}
                </ThemedText>
              ) : null
            }
          />
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            {dataEvents.length > 0 ? (
              dataEvents.map((event) => (
                <View key={event.id} style={[styles.eventRow, { borderColor: theme.separator }]}>
                  <View style={styles.eventTitleRow}>
                    <ThemedText type="smallBold">{event.decodedText ?? event.characteristicLabel}</ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {event.source}
                    </ThemedText>
                  </View>
                  {event.details.map((detail) => (
                    <ThemedText key={detail} type="caption" style={{ color: theme.textSecondary }}>
                      {detail}
                    </ThemedText>
                  ))}
                  <ThemedText type="code" numberOfLines={2} style={{ color: theme.textSecondary }}>
                    {event.rawHex}
                  </ThemedText>
                </View>
              ))
            ) : (
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Readable values and notifications will appear here.
              </ThemedText>
            )}
          </View>
        </Section>
      </View>
    </ScrollView>
  );
}

function StatusTile({ title, value }: { title: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.statusTile, { backgroundColor: theme.card }]}>
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
        {title}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  primary,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: primary ? theme.text : theme.card,
          borderColor: primary ? theme.text : theme.separator,
        },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <ThemedText type="smallBold" style={{ color: primary ? theme.background : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

async function requestBlePermissions() {
  if (Platform.OS !== 'android') {
    return true;
  }

  const apiLevel =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : Number.parseInt(String(Platform.Version), 10);

  if (apiLevel < 31) {
    return true;
  }

  const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);

  return status === PermissionsAndroid.RESULTS.GRANTED;
}

async function waitForReadyBleState(
  manager: BleManager,
  fallbackState: BleState,
  onStateChange: (state: State) => void
) {
  const currentState = await manager.state().catch(() => fallbackState);

  if (currentState !== 'Unavailable') {
    onStateChange(currentState);
  }

  if (!isTransientBleState(currentState)) {
    return currentState;
  }

  return new Promise<BleState>((resolve) => {
    let latestState: BleState = currentState;
    const timeout = setTimeout(() => {
      subscription.remove();
      resolve(latestState);
    }, BLE_STATE_SETTLE_TIMEOUT_MS);
    const subscription = manager.onStateChange((nextState) => {
      latestState = nextState;
      onStateChange(nextState);

      if (!isTransientBleState(nextState)) {
        clearTimeout(timeout);
        subscription.remove();
        resolve(nextState);
      }
    });
  });
}

function isTransientBleState(state: BleState) {
  return state === State.Unknown || state === State.Resetting;
}

function messageForBleState(state: BleState) {
  if (state === State.PoweredOff) {
    return 'Turn on Bluetooth first.';
  }
  if (state === State.Unauthorized) {
    return 'Bluetooth permission is off for OpenFit. Enable it in iOS Settings, then try again.';
  }
  if (state === State.Unsupported) {
    return 'This device does not support Bluetooth LE.';
  }
  if (state === State.Resetting || state === State.Unknown) {
    return 'Bluetooth is still initializing. Wait a moment, then try again.';
  }

  return 'Bluetooth is not available in this build.';
}

function formatProperties(characteristic: CharacteristicSummary) {
  const properties = [
    characteristic.isReadable ? 'read' : null,
    characteristic.isNotifiable ? 'notify' : null,
    characteristic.isIndicatable ? 'indicate' : null,
    characteristic.isWritableWithResponse || characteristic.isWritableWithoutResponse ? 'write' : null,
    characteristic.isMonitoring ? 'live' : null,
  ].filter(Boolean);

  return properties.length > 0 ? properties.join(', ') : 'locked';
}

function formatBleState(state: BleState) {
  if (state === State.PoweredOn) {
    return 'On';
  }
  if (state === State.PoweredOff) {
    return 'Off';
  }
  if (state === State.Unknown || state === State.Resetting) {
    return 'Initializing';
  }
  if (state === State.Unauthorized) {
    return 'No Access';
  }
  if (state === State.Unsupported) {
    return 'Unsupported';
  }
  if (state === 'Unavailable') {
    return 'Unavailable';
  }

  return String(state);
}

function formatPermissionState(state: PermissionState) {
  if (state === 'granted') {
    return 'Granted';
  }
  if (state === 'denied') {
    return 'Denied';
  }
  return Platform.OS === 'android' ? 'Needed' : 'System';
}

function formatLoadState(state: LoadState) {
  if (state === 'loading') {
    return 'Working';
  }
  if (state === 'loaded') {
    return 'Connected';
  }
  if (state === 'error') {
    return 'Error';
  }
  return 'Idle';
}

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    paddingTop: Spacing.four,
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  statusGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statusTile: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
  },
  card: {
    gap: Spacing.two,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
  },
  deviceMain: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  deviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  badge: {
    borderRadius: 6,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  serviceBlock: {
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: Spacing.three,
  },
  characteristics: {
    gap: Spacing.two,
  },
  characteristicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  characteristicMain: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  eventRow: {
    gap: Spacing.half,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: Spacing.two,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
