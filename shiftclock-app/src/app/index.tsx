import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addConnectionStateListener,
  addDeviceDiscoveredListener,
  connect,
  scan,
  stopScan,
  writeAlarm,
  writeSettings,
  type Alarm,
  type ClockSettings,
  type ConnectionStateChangedEvent,
  type ShiftclockDevice,
} from '../../modules/shiftclock-ble';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const PLACEHOLDER_ALARM: Alarm = {
  daysActive: 0,
  secondsOfDay: 0,
  flashUntilOff: false,
  rampDurationSeconds: 0,
  volume: 0,
};

const PLACEHOLDER_SETTINGS: ClockSettings = { id: 0, value: 0 };

type ActionButtonProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

function ActionButton({ accessibilityLabel, disabled, label, onPress }: ActionButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: disabled ? theme.backgroundSelected : theme.text },
        pressed && !disabled && styles.pressed,
      ]}>
      <ThemedText
        type="smallBold"
        style={{ color: disabled ? theme.textSecondary : theme.background }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function messageFromError(cause: unknown) {
  return cause instanceof Error ? cause.message : 'BLE operation failed';
}

export default function ClockScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const [devices, setDevices] = useState<Record<string, ShiftclockDevice>>({});
  const [connection, setConnection] = useState<ConnectionStateChangedEvent>({
    state: 'disconnected',
    deviceId: null,
  });
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const discoveredDevices = useMemo(() => Object.values(devices), [devices]);
  const connected = connection.state === 'connected';

  useEffect(() => {
    const discoveredSubscription = addDeviceDiscoveredListener((device) => {
      setDevices((currentDevices) => ({ ...currentDevices, [device.id]: device }));
    });
    const connectionSubscription = addConnectionStateListener(setConnection);

    return () => {
      discoveredSubscription.remove();
      connectionSubscription.remove();
      void stopScan().catch(() => undefined);
    };
  }, []);

  async function runAction(label: string, operation: () => Promise<void>, successMessage: string) {
    if (pendingAction) {
      return;
    }

    setPendingAction(label);
    setActionMessage(null);

    try {
      await operation();
      setActionMessage(successMessage);
    } catch (cause) {
      setActionMessage(messageFromError(cause));
    } finally {
      setPendingAction(null);
    }
  }

  const connectionSummary = connection.deviceId
    ? `${connection.state} · ${connection.deviceId}`
    : connection.state;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: safeAreaInsets.top + Spacing.four,
          paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
        },
      ]}>
      <ThemedView style={styles.container}>
        <View style={styles.heading}>
          <ThemedText type="subtitle">Shiftclock</ThemedText>
          <ThemedText themeColor="textSecondary">
            Discover a clock, connect, and send test packets.
          </ThemedText>
        </View>

        <ThemedView type="backgroundElement" style={styles.statusCard}>
          <ThemedText type="small" themeColor="textSecondary">
            Connection
          </ThemedText>
          <ThemedText style={styles.capitalize}>{connectionSummary}</ThemedText>
        </ThemedView>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <ThemedText type="smallBold">Devices</ThemedText>
            <ActionButton
              accessibilityLabel="Scan for devices"
              disabled={pendingAction !== null}
              label={pendingAction === 'scan' ? 'Scanning…' : 'Scan for devices'}
              onPress={() =>
                void runAction('scan', scan, 'Scanning for nearby Shiftclock devices')
              }
            />
          </View>

          {discoveredDevices.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <ThemedText type="small" themeColor="textSecondary">
                No devices discovered yet.
              </ThemedText>
            </ThemedView>
          ) : (
            discoveredDevices.map((device) => {
              const deviceName = device.name ?? 'Unnamed Shiftclock';
              const actionName = `connect:${device.id}`;
              const isActiveDevice = connection.deviceId === device.id;

              return (
                <ThemedView key={device.id} type="backgroundElement" style={styles.deviceCard}>
                  <View style={styles.deviceDetails}>
                    <ThemedText>{deviceName}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {device.id}
                    </ThemedText>
                    {device.rssi === null ? null : (
                      <ThemedText type="small" themeColor="textSecondary">
                        RSSI {device.rssi} dBm
                      </ThemedText>
                    )}
                  </View>
                  <ActionButton
                    accessibilityLabel={`Connect to ${deviceName}`}
                    disabled={pendingAction !== null || (connected && isActiveDevice)}
                    label={
                      connected && isActiveDevice
                        ? 'Connected'
                        : pendingAction === actionName
                          ? 'Connecting…'
                          : 'Connect'
                    }
                    onPress={() =>
                      void runAction(
                        actionName,
                        () => connect(device.id),
                        `Connection requested for ${deviceName}`
                      )
                    }
                  />
                </ThemedView>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold">Test packets</ThemedText>
          <ThemedView type="backgroundElement" style={styles.packetCard}>
            <ActionButton
              accessibilityLabel="Send alarm packet"
              disabled={!connected || pendingAction !== null}
              label={pendingAction === 'alarm' ? 'Sending…' : 'Send alarm packet'}
              onPress={() =>
                void runAction('alarm', () => writeAlarm(PLACEHOLDER_ALARM), 'Alarm packet sent')
              }
            />
            <ActionButton
              accessibilityLabel="Send settings packet"
              disabled={!connected || pendingAction !== null}
              label={pendingAction === 'settings' ? 'Sending…' : 'Send settings packet'}
              onPress={() =>
                void runAction(
                  'settings',
                  () => writeSettings(PLACEHOLDER_SETTINGS),
                  'Settings packet sent'
                )
              }
            />
          </ThemedView>
        </View>

        {actionMessage ? (
          <ThemedView type="backgroundElement" style={styles.messageCard}>
            <ThemedText type="small">{actionMessage}</ThemedText>
          </ThemedView>
        ) : null}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  heading: {
    gap: Spacing.one,
  },
  statusCard: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  capitalize: {
    textTransform: 'capitalize',
  },
  section: {
    gap: Spacing.two,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  emptyCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  deviceDetails: {
    flex: 1,
    gap: Spacing.half,
  },
  packetCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  button: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.75,
  },
  messageCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});
