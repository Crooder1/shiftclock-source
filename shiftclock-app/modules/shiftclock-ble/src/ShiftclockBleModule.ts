import { NativeModule, requireNativeModule } from 'expo-modules-core';

import type {
  Alarm,
  ClockSettings,
  ShiftclockBleEvents,
} from './ShiftclockBle.types';

declare class ShiftclockBleNativeModule extends NativeModule<ShiftclockBleEvents> {
  scan(): Promise<void>;
  stopScan(): Promise<void>;
  connect(deviceId: string): Promise<void>;
  disconnect(): Promise<void>;
  writeAlarm(alarm: Alarm): Promise<void>;
  writeSettings(settings: ClockSettings): Promise<void>;
}

export default requireNativeModule<ShiftclockBleNativeModule>('ShiftclockBle');
