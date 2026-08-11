import type { EventSubscription } from 'expo-modules-core';

import ShiftclockBleModule from './ShiftclockBleModule';
import type {
  Alarm,
  ClockSettings,
  ConnectionStateChangedEvent,
  FirmwareMessage,
  ShiftclockDevice,
} from './ShiftclockBle.types';

export function scan(): Promise<void> {
  return ShiftclockBleModule.scan();
}

export function stopScan(): Promise<void> {
  return ShiftclockBleModule.stopScan();
}

export function connect(deviceId: string): Promise<void> {
  return ShiftclockBleModule.connect(deviceId);
}

export function disconnect(): Promise<void> {
  return ShiftclockBleModule.disconnect();
}

export function writeAlarm(alarm: Alarm): Promise<void> {
  return ShiftclockBleModule.writeAlarm(alarm);
}

export function writeSettings(settings: ClockSettings): Promise<void> {
  return ShiftclockBleModule.writeSettings(settings);
}

export function addDeviceDiscoveredListener(
  listener: (device: ShiftclockDevice) => void
): EventSubscription {
  return ShiftclockBleModule.addListener('onDeviceDiscovered', listener);
}

export function addConnectionStateListener(
  listener: (event: ConnectionStateChangedEvent) => void
): EventSubscription {
  return ShiftclockBleModule.addListener('onConnectionStateChanged', listener);
}

export function addMessageListener(
  listener: (message: FirmwareMessage) => void
): EventSubscription {
  return ShiftclockBleModule.addListener('onMessageReceived', listener);
}
