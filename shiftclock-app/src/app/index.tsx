import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addConnectionStateListener,
  addSettingsListener,
  connect,
  disconnect,
  type ClockSettingsSnapshot,
  type ConnectionStateChangedEvent,
} from '../../modules/shiftclock-ble';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionButton } from '@/components/action-button';
import { useAutoConnect } from '@/auto-connect/auto-connect';
import { ClockSettingsCard } from '@/components/clock-settings-card';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function messageFromError(cause: unknown) {
  return cause instanceof Error ? cause.message : 'BLE operation failed';
}

export default function ClockScreen() {
  const {
    clearTarget: clearAutoConnectTarget,
    devices,
    enabled: autoConnectEnabled,
    error: autoConnectError,
    setTarget: setAutoConnectTarget,
    startScan,
    target: autoConnectTarget,
  } = useAutoConnect();
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const [connection, setConnection] = useState<ConnectionStateChangedEvent>({
    state: 'disconnected',
    deviceId: null,
  });
  const [clockSettings, setClockSettings] = useState<ClockSettingsSnapshot | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const discoveredDevices = useMemo(() => Object.values(devices), [devices]);
  const connected = connection.state === 'connected';
  const clockSettingsEnabled = connected && clockSettings !== null;

  useEffect(() => {
    const connectionSubscription = addConnectionStateListener(setConnection);
    const settingsSubscription = addSettingsListener(setClockSettings);

    return () => {
      connectionSubscription.remove();
      settingsSubscription.remove();
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
  const connectedDeviceId = connection.deviceId;
  const connectedDevice = connectedDeviceId ? devices[connectedDeviceId] : undefined;
  const connectedTargetSelected =
    connectedDeviceId !== null && autoConnectTarget?.id === connectedDeviceId;
  const displayedMessage = actionMessage ?? autoConnectError;

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
            Discover a clock, connect, and adjust its settings.
          </ThemedText>
        </View>

        <ThemedView type="backgroundElement" style={styles.statusCard}>
          <ThemedText type="small" themeColor="textSecondary">
            Connection
          </ThemedText>
          <View style={styles.connectionRow}>
            <ThemedText style={styles.capitalize}>
              {connectionSummary}
            </ThemedText>
            <View style={styles.connectionActions}>
              {autoConnectEnabled && connected && connectedDeviceId !== null ? (
                <ActionButton
                  accessibilityLabel={
                    connectedTargetSelected
                      ? 'Remove auto-connect'
                      : 'Auto-connect to this clock'
                  }
                  disabled={pendingAction !== null}
                  label={
                    pendingAction === 'auto-connect'
                      ? 'Saving…'
                      : connectedTargetSelected
                        ? 'Remove auto-connect'
                        : 'Auto-connect to this clock'
                  }
                  onPress={() =>
                    void runAction(
                      'auto-connect',
                      connectedTargetSelected
                        ? clearAutoConnectTarget
                        : () =>
                            setAutoConnectTarget({
                              id: connectedDeviceId,
                              name: connectedDevice?.name ?? null,
                            }),
                      connectedTargetSelected
                        ? 'Auto-connect target removed'
                        : 'This clock will auto-connect when discovered'
                    )
                  }
                />
              ) : null}
              {connectedDeviceId !== null && connection.state !== 'disconnected' ? (
                <ActionButton
                  accessibilityLabel="Disconnect from clock"
                  disabled={pendingAction !== null}
                  label={pendingAction === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
                  onPress={() =>
                    void runAction('disconnect', disconnect, 'Disconnected from Shiftclock')
                  }
                />
              ) : null}
            </View>
          </View>
        </ThemedView>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <ThemedText type="smallBold">Devices</ThemedText>
            <ActionButton
              accessibilityLabel="Scan for devices"
              disabled={pendingAction !== null}
              label={pendingAction === 'scan' ? 'Scanning…' : 'Scan for devices'}
              onPress={() =>
                void runAction('scan', startScan, 'Scanning for nearby Shiftclock devices')
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

        <ClockSettingsCard
          confirmedSettings={clockSettings}
          enabled={clockSettingsEnabled}
          onActionMessage={setActionMessage}
        />

        {displayedMessage ? (
          <ThemedView type="backgroundElement" style={styles.messageCard}>
            <ThemedText
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              type="small">
              {displayedMessage}
            </ThemedText>
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
  connectionRow: {
    gap: Spacing.two,
  },
  connectionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
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
  messageCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});
