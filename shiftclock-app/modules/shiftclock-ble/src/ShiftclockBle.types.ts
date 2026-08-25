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
  tuneId: number;
  rampDurationSeconds: number;
  volume: number;
  autoDisableSeconds: number;
};

export type AlarmRecord = Alarm & {
  id: number;
};

export type TuneMetadata = {
  id: number;
  name: string;
  loopDurationSeconds: number;
};

export type AlarmReadResponse =
  | { kind: 'count'; count: number }
  | { kind: 'alarm'; alarm: AlarmRecord };

export type TuneReadResponse =
  | { kind: 'count'; count: number }
  | { kind: 'tune'; tune: TuneMetadata };

export type AlarmDataSnapshot = {
  alarms: readonly AlarmRecord[];
  tunes: readonly TuneMetadata[];
};

export type ClockSettings = {
  id: number;
  value: number;
};

export type ClockSettingsSnapshot = {
  timezone: number;
  dayBrightness: number;
  nightBrightness: number;
  dayNightCutoff: number;
  nightDayCutoff: number;
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
