export const SHIFTCLOCK_BLE_UUIDS = {
  clockService: '8984ff44-0000-4291-868b-2a44c36ed7e8',
  alarmCharacteristic: '8984ff44-0001-4291-868b-2a44c36ed7e8',
  settingsCharacteristic: '8984ff44-0002-4291-868b-2a44c36ed7e8',
  messageCharacteristic: '8984ff44-0003-4291-868b-2a44c36ed7e8',
} as const;

export const SHIFTCLOCK_BLE_PROTOCOL = {
  header: 0,
  alarm: {
    packetSize: 9,
    offsets: {
      header: 0,
      daysActive: 1,
      secondsOfDay: 2,
      flashUntilOff: 5,
      rampDurationSeconds: 6,
      volume: 8,
    },
    ranges: {
      daysActive: { min: 0, max: 0x7f },
      secondsOfDay: { min: 0, max: 86_399 },
      rampDurationSeconds: { min: 0, max: 600 },
      volume: { min: 0, max: 100 },
    },
  },
  settings: {
    packetSize: 3,
    offsets: {
      header: 0,
      id: 1,
      value: 2,
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
  },
} as const;
