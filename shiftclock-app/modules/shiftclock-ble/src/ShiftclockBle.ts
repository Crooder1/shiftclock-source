import BleManager from 'react-native-ble-manager';
import {
  PermissionsAndroid,
  Platform,
  type Permission,
} from 'react-native';

import {
  ShiftclockBleController,
  type BleManagerClient,
  type ShiftclockBleSubscription,
  type ShiftclockPlatform,
} from './ShiftclockBleController';
import { requestBlePermissions } from './ShiftclockBle.permissions';
import type {
  Alarm,
  AlarmDataSnapshot,
  AlarmRecord,
  ClockSettings,
  ClockSettingsSnapshot,
  ConnectionStateChangedEvent,
  FirmwareMessage,
  ShiftclockDevice,
  TuneMetadata,
} from './ShiftclockBle.types';

const platform: ShiftclockPlatform =
  Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : 'other';

const controller = new ShiftclockBleController(
  BleManager as unknown as BleManagerClient,
  platform,
  () =>
    requestBlePermissions(platform, platform === 'android' ? Number(Platform.Version) : 0, {
      grantedResult: PermissionsAndroid.RESULTS.GRANTED,
      scanPermission: PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      connectPermission: PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      locationPermission: PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      request: (permission) => PermissionsAndroid.request(permission as Permission),
      requestMultiple: (permissions) =>
        PermissionsAndroid.requestMultiple(permissions as Permission[]),
    })
);

export function scan(): Promise<void> {
  return controller.scan();
}

export function stopScan(): Promise<void> {
  return controller.stopScan();
}

export function connect(deviceId: string): Promise<void> {
  return controller.connect(deviceId);
}

export function disconnect(): Promise<void> {
  return controller.disconnect();
}

export function writeAlarm(alarm: Alarm): Promise<void> {
  return controller.writeAlarm(alarm);
}

export function reloadAlarmData(): Promise<AlarmDataSnapshot> {
  return controller.reloadAlarmData();
}

export function createAlarm(alarm: Alarm): Promise<readonly AlarmRecord[]> {
  return controller.createAlarm(alarm);
}

export function modifyAlarm(id: number, alarm: Alarm): Promise<readonly AlarmRecord[]> {
  return controller.modifyAlarm(id, alarm);
}

export function removeAlarm(id: number): Promise<readonly AlarmRecord[]> {
  return controller.removeAlarm(id);
}

export function commitAlarms(): Promise<void> {
  return controller.commitAlarms();
}

export function reloadAlarms(): Promise<readonly AlarmRecord[]> {
  return controller.reloadAlarms();
}

export function writeSettings(settings: ClockSettings): Promise<void> {
  return controller.writeSettings(settings);
}

export function commitSettings(): Promise<void> {
  return controller.commitSettings();
}

export function reloadSettings(): Promise<ClockSettingsSnapshot> {
  return controller.reloadSettings();
}

export function addDeviceDiscoveredListener(
  listener: (device: ShiftclockDevice) => void
): ShiftclockBleSubscription {
  return controller.addDeviceDiscoveredListener(listener);
}

export function addConnectionStateListener(
  listener: (event: ConnectionStateChangedEvent) => void
): ShiftclockBleSubscription {
  return controller.addConnectionStateListener(listener);
}

export function addMessageListener(
  listener: (message: FirmwareMessage) => void
): ShiftclockBleSubscription {
  return controller.addMessageListener(listener);
}

export function addSettingsListener(
  listener: (settings: ClockSettingsSnapshot | null) => void
): ShiftclockBleSubscription {
  return controller.addSettingsListener(listener);
}

export function addAlarmListener(
  listener: (alarms: readonly AlarmRecord[] | null) => void
): ShiftclockBleSubscription {
  return controller.addAlarmListener(listener);
}

export function addTuneListener(
  listener: (tunes: readonly TuneMetadata[] | null) => void
): ShiftclockBleSubscription {
  return controller.addTuneListener(listener);
}
