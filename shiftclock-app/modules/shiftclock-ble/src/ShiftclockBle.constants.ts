export const SHIFTCLOCK_BLE_UUIDS = {
  clockService: '8984ff44-0000-4291-868b-2a44c36ed7e8',
  alarmCharacteristic: '8984ff44-0001-4291-868b-2a44c36ed7e8',
  settingsCharacteristic: '8984ff44-0002-4291-868b-2a44c36ed7e8',
  messageCharacteristic: '8984ff44-0003-4291-868b-2a44c36ed7e8',
} as const;

export const SHIFTCLOCK_BLE_PROTOCOL = {
  header: 0,
  alarm: {
    packetSize: 13,
    readPacketSize: 12,
    offsets: {
      header: 0,
      command: 1,
      id: 2,
      daysActive: 3,
      secondsOfDay: 4,
      tuneId: 7,
      rampDurationSeconds: 8,
      volume: 10,
      autoDisableSeconds: 11,
    },
    ranges: {
      daysActive: { min: 0, max: 0x7f },
      secondsOfDay: { min: 0, max: 86_399 },
      tuneId: { min: 0, max: 31 },
      rampDurationSeconds: { min: 0, max: 600 },
      volume: { min: 0, max: 100 },
      autoDisableSeconds: { min: 0, max: 3600 },
    },
    commands: {
      read: 0,
      add: 1,
      modify: 2,
      remove: 3,
    },
  },
  settings: {
    packetSize: 3,
    readPacketSize: 8,
    offsets: {
      header: 0,
      id: 1,
      value: 2,
    },
    ids: {
      timezone: 0,
      brightness: 1,
      seconds: 2,
      movingDp: 3,
      volume: 4,
      clockForm: 5,
      meriIndicator: 6,
    },
    ranges: {
      timezone: { min: 0, max: 23 },
      brightness: { min: 0, max: 15 },
      seconds: { min: 0, max: 1 },
      movingDp: { min: 0, max: 2 },
      volume: { min: 0, max: 100 },
      clockForm: { min: 0, max: 1 },
      meriIndicator: { min: 0, max: 1 },
    },
    commands: {
      commit: { id: 0xff, value: 0xff },
      reload: { id: 0xff, value: 0xfe },
    },
  },
  message: {
    packetSize: 43,
    descriptionSize: 40,
    offsets: {
      header: 0,
      type: 1,
      code: 2,
      description: 3,
    },
    infoOperationSucceeded: { type: 0, code: 0 },
  },
} as const;
