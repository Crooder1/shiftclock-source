import { SHIFTCLOCK_BLE_PROTOCOL } from './ShiftclockBle.constants';
import type {
  Alarm,
  ClockSettings,
  ClockSettingsSnapshot,
  FirmwareMessage,
} from './ShiftclockBle.types';

function isIntegerInRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

export function encodeAlarm(alarm: Alarm): number[] {
  const ranges = SHIFTCLOCK_BLE_PROTOCOL.alarm.ranges;

  if (
    !isIntegerInRange(alarm.daysActive, ranges.daysActive.min, ranges.daysActive.max) ||
    !isIntegerInRange(alarm.secondsOfDay, ranges.secondsOfDay.min, ranges.secondsOfDay.max) ||
    !isIntegerInRange(
      alarm.rampDurationSeconds,
      ranges.rampDurationSeconds.min,
      ranges.rampDurationSeconds.max
    ) ||
    !isIntegerInRange(alarm.volume, ranges.volume.min, ranges.volume.max)
  ) {
    throw new Error('Invalid Alarm packet fields');
  }

  return [
    SHIFTCLOCK_BLE_PROTOCOL.header,
    alarm.daysActive,
    alarm.secondsOfDay & 0xff,
    (alarm.secondsOfDay >>> 8) & 0xff,
    (alarm.secondsOfDay >>> 16) & 0xff,
    alarm.flashUntilOff ? 1 : 0,
    alarm.rampDurationSeconds & 0xff,
    (alarm.rampDurationSeconds >>> 8) & 0xff,
    alarm.volume,
  ];
}

export function encodeSettings(settings: ClockSettings): number[] {
  if (
    !isIntegerInRange(settings.id, 0, 0xff) ||
    !isIntegerInRange(settings.value, 0, 0xff)
  ) {
    throw new Error('Invalid Settings packet fields');
  }

  return [SHIFTCLOCK_BLE_PROTOCOL.header, settings.id, settings.value];
}

export function decodeSettings(packet: readonly number[]): ClockSettingsSnapshot {
  const protocol = SHIFTCLOCK_BLE_PROTOCOL;
  const settings = protocol.settings;

  if (packet.length !== settings.readPacketSize) {
    throw new Error(`Invalid Settings packet size: ${packet.length}`);
  }
  if (packet.some((byte) => !isIntegerInRange(byte, 0, 0xff))) {
    throw new Error('Invalid Settings packet byte');
  }
  if (packet[settings.offsets.header] !== protocol.header) {
    throw new Error('Invalid Settings packet header');
  }

  const values: ClockSettingsSnapshot = {
    timezone: packet[1],
    brightness: packet[2],
    seconds: packet[3],
    movingDp: packet[4],
    volume: packet[5],
    clockForm: packet[6],
    meriIndicator: packet[7],
  };
  const labels: Record<keyof ClockSettingsSnapshot, string> = {
    timezone: 'Timezone',
    brightness: 'Brightness',
    seconds: 'Seconds',
    movingDp: 'Moving DP',
    volume: 'Volume',
    clockForm: 'Clock form',
    meriIndicator: 'Meri indicator',
  };

  for (const key of Object.keys(values) as (keyof ClockSettingsSnapshot)[]) {
    const range = settings.ranges[key];
    if (!isIntegerInRange(values[key], range.min, range.max)) {
      throw new Error(`Invalid Settings ${labels[key]} value: ${values[key]}`);
    }
  }

  return values;
}

export function decodeMessage(packet: readonly number[]): FirmwareMessage {
  const message = SHIFTCLOCK_BLE_PROTOCOL.message;

  if (packet.length !== message.packetSize) {
    throw new Error(`Invalid Message packet size: ${packet.length}`);
  }
  if (packet.some((byte) => !isIntegerInRange(byte, 0, 0xff))) {
    throw new Error('Invalid Message packet byte');
  }
  if (packet[message.offsets.header] !== SHIFTCLOCK_BLE_PROTOCOL.header) {
    throw new Error('Invalid Message packet header');
  }

  const descriptionBytes = packet.slice(
    message.offsets.description,
    message.offsets.description + message.descriptionSize
  );
  if (descriptionBytes.at(-1) !== 0) {
    throw new Error('Invalid Message description: missing final null byte');
  }
  const terminatorIndex = descriptionBytes.indexOf(0);
  if (terminatorIndex === -1) {
    throw new Error('Invalid Message description: missing null terminator');
  }
  const textBytes = descriptionBytes.slice(0, terminatorIndex);

  return {
    type: packet[message.offsets.type],
    code: packet[message.offsets.code],
    description: String.fromCharCode(...textBytes),
  };
}
