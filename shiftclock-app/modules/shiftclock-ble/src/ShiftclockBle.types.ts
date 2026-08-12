export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting';

export type ShiftclockDevice = {
  id: string;
  name: string | null;
  rssi: number | null;
};

export type Alarm = {
  daysActive: number;
  secondsOfDay: number;
  flashUntilOff: boolean;
  rampDurationSeconds: number;
  volume: number;
};

export type ClockSettings = {
  id: number;
  value: number;
};

export type ClockSettingsSnapshot = {
  timezone: number;
  brightness: number;
  seconds: number;
  movingDp: number;
  volume: number;
  clockForm: number;
  meriIndicator: number;
};

export type FirmwareMessage = {
  type: number;
  code: number;
  description: string;
};

export type ConnectionStateChangedEvent = {
  state: ConnectionState;
  deviceId: string | null;
};
