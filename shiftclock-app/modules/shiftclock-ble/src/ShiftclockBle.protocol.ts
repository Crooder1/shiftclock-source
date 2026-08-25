import { SHIFTCLOCK_BLE_PROTOCOL } from './ShiftclockBle.constants';
import type {
  Alarm,
  AlarmReadResponse,
  ClockSettings,
  ClockSettingsSnapshot,
  FirmwareMessage,
  TuneReadResponse,
} from './ShiftclockBle.types';

export type AlarmMutationCommand = 'add' | 'modify' | 'remove';
export type AlarmPersistenceCommand = 'commit' | 'reload';

function isIntegerInRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

export function encodeAlarm(alarm: Alarm): number[] {
  return encodeAlarmMutation('add', 0, alarm);
}

function validateAlarm(alarm: Alarm): void {
  const ranges = SHIFTCLOCK_BLE_PROTOCOL.alarm.ranges;

  if (
    !isIntegerInRange(alarm.daysActive, ranges.daysActive.min, ranges.daysActive.max) ||
    !isIntegerInRange(alarm.secondsOfDay, ranges.secondsOfDay.min, ranges.secondsOfDay.max) ||
    !isIntegerInRange(alarm.tuneId, ranges.tuneId.min, ranges.tuneId.max) ||
    !isIntegerInRange(
      alarm.rampDurationSeconds,
      ranges.rampDurationSeconds.min,
      ranges.rampDurationSeconds.max
    ) ||
    !isIntegerInRange(alarm.volume, ranges.volume.min, ranges.volume.max) ||
    !isIntegerInRange(
      alarm.autoDisableSeconds,
      ranges.autoDisableSeconds.min,
      ranges.autoDisableSeconds.max
    )
  ) {
    throw new Error('Invalid Alarm packet fields');
  }
}

function encodeAlarmPayload(alarm: Alarm): number[] {
  validateAlarm(alarm);

  return [
    alarm.daysActive,
    alarm.secondsOfDay & 0xff,
    (alarm.secondsOfDay >>> 8) & 0xff,
    (alarm.secondsOfDay >>> 16) & 0xff,
    alarm.tuneId,
    alarm.rampDurationSeconds & 0xff,
    (alarm.rampDurationSeconds >>> 8) & 0xff,
    alarm.volume,
    alarm.autoDisableSeconds & 0xff,
    (alarm.autoDisableSeconds >>> 8) & 0xff,
  ];
}

export function encodeAlarmSelection(id: number): number[] {
  const alarm = SHIFTCLOCK_BLE_PROTOCOL.alarm;
  if (
    !Number.isInteger(id) ||
    (id !== alarm.invalidId && (id < 0 || id >= alarm.maximumCount))
  ) {
    throw new Error('Invalid Alarm ID');
  }
  return [
    SHIFTCLOCK_BLE_PROTOCOL.header,
    alarm.commands.read,
    id,
    ...Array(10).fill(0),
  ];
}

export function encodeAlarmMutation(
  command: AlarmMutationCommand,
  id: number,
  alarmValue?: Alarm
): number[] {
  const alarm = SHIFTCLOCK_BLE_PROTOCOL.alarm;
  const commandByte = alarm.commands[command];
  if (!Number.isInteger(id) || id < 0 || id >= alarm.maximumCount) {
    throw new Error('Invalid Alarm ID');
  }
  if (command === 'remove') {
    return [SHIFTCLOCK_BLE_PROTOCOL.header, commandByte, id, ...Array(10).fill(0)];
  }
  if (alarmValue === undefined) throw new Error('Alarm fields are required');
  return [SHIFTCLOCK_BLE_PROTOCOL.header, commandByte, id, ...encodeAlarmPayload(alarmValue)];
}

export function encodeAlarmCommand(command: AlarmPersistenceCommand): number[] {
  return [
    SHIFTCLOCK_BLE_PROTOCOL.header,
    SHIFTCLOCK_BLE_PROTOCOL.alarm.commands[command],
    ...Array(11).fill(0),
  ];
}

function assertPacket(packet: readonly number[], size: number, label: string): void {
  if (packet.length !== size) throw new Error(`Invalid ${label} packet size: ${packet.length}`);
  if (packet.some((byte) => !isIntegerInRange(byte, 0, 0xff))) {
    throw new Error(`Invalid ${label} packet byte`);
  }
  if (packet[0] !== SHIFTCLOCK_BLE_PROTOCOL.header) {
    throw new Error(`Invalid ${label} packet header`);
  }
}

function readLittleEndian(packet: readonly number[], offset: number, length: number): number {
  let value = 0;
  for (let index = 0; index < length; ++index) {
    value += packet[offset + index] * 2 ** (8 * index);
  }
  return value;
}

export function decodeAlarmRead(
  packet: readonly number[],
  expected: 'count' | 'alarm'
): AlarmReadResponse {
  const protocol = SHIFTCLOCK_BLE_PROTOCOL.alarm;
  assertPacket(packet, protocol.readPacketSize, 'Alarm');
  const idOrCount = packet[1];
  const payload = packet.slice(2);
  if (expected === 'count') {
    if (idOrCount > protocol.maximumCount) throw new Error('Invalid Alarm count');
    if (payload.some((byte) => byte !== 0)) throw new Error('Invalid Alarm count payload');
    return { kind: 'count', count: idOrCount };
  }

  const alarm: Alarm = {
    daysActive: packet[2],
    secondsOfDay: readLittleEndian(packet, 3, 3),
    tuneId: packet[6],
    rampDurationSeconds: readLittleEndian(packet, 7, 2),
    volume: packet[9],
    autoDisableSeconds: readLittleEndian(packet, 10, 2),
  };
  validateAlarm(alarm);
  if (idOrCount >= protocol.maximumCount) throw new Error('Invalid Alarm ID');
  return { kind: 'alarm', alarm: { id: idOrCount, ...alarm } };
}

export function encodeTuneSelection(id: number): number[] {
  const tune = SHIFTCLOCK_BLE_PROTOCOL.tune;
  if (!Number.isInteger(id) || (id !== tune.invalidId && (id < 0 || id >= tune.maximumCount))) {
    throw new Error('Invalid Tune ID');
  }
  return [SHIFTCLOCK_BLE_PROTOCOL.header, tune.commands.read, id];
}

export function encodeTunePlay(id: number): number[] {
  const tune = SHIFTCLOCK_BLE_PROTOCOL.tune;
  if (!Number.isInteger(id) || id < 0 || id >= tune.maximumCount) {
    throw new Error('Invalid Tune ID');
  }
  return [SHIFTCLOCK_BLE_PROTOCOL.header, tune.commands.play, id];
}

export function encodeTuneCancel(): number[] {
  const tune = SHIFTCLOCK_BLE_PROTOCOL.tune;
  return [SHIFTCLOCK_BLE_PROTOCOL.header, tune.commands.play, tune.invalidId];
}

export function decodeTuneRead(
  packet: readonly number[],
  expected: 'count' | 'tune'
): TuneReadResponse {
  const tune = SHIFTCLOCK_BLE_PROTOCOL.tune;
  assertPacket(packet, tune.readPacketSize, 'Tune');
  const idOrCount = packet[tune.offsets.id];
  const metadata = packet.slice(tune.offsets.dataLength);
  if (expected === 'count') {
    if (idOrCount > tune.maximumCount) throw new Error('Invalid Tune count');
    if (metadata.some((byte) => byte !== 0)) throw new Error('Invalid Tune count metadata');
    return { kind: 'count', count: idOrCount };
  }
  if (idOrCount >= tune.maximumCount) throw new Error('Invalid Tune ID');
  const nameBytes = packet.slice(tune.offsets.name, tune.offsets.name + tune.nameSize);
  const terminator = nameBytes.indexOf(0);
  if (terminator < 0) throw new Error('Invalid Tune name: missing null terminator');
  const name = String.fromCharCode(...nameBytes.slice(0, terminator));
  const dataLength = readLittleEndian(packet, tune.offsets.dataLength, 4);
  return {
    kind: 'tune',
    tune: { id: idOrCount, name, loopDurationSeconds: dataLength / tune.bytesPerSecond },
  };
}

export function encodeSettings(settings: ClockSettings): number[] {
  if (
    !isIntegerInRange(settings.id, -128, 127) ||
    !isIntegerInRange(settings.value, -128, 127)
  ) {
    throw new Error('Invalid Settings packet fields');
  }

  return [
    SHIFTCLOCK_BLE_PROTOCOL.header,
    settings.id & 0xff,
    settings.value & 0xff,
  ];
}

function decodeSignedByte(value: number): number {
  return value <= 0x7f ? value : value - 0x100;
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
    timezone: decodeSignedByte(packet[1]),
    dayBrightness: decodeSignedByte(packet[2]),
    nightBrightness: decodeSignedByte(packet[3]),
    dayNightCutoff: decodeSignedByte(packet[4]),
    nightDayCutoff: decodeSignedByte(packet[5]),
    seconds: decodeSignedByte(packet[6]),
    movingDp: decodeSignedByte(packet[7]),
    volume: decodeSignedByte(packet[8]),
    clockForm: decodeSignedByte(packet[9]),
    meriIndicator: decodeSignedByte(packet[10]),
  };
  const labels: Record<keyof ClockSettingsSnapshot, string> = {
    timezone: 'Timezone',
    dayBrightness: 'Day brightness',
    nightBrightness: 'Night brightness',
    dayNightCutoff: 'Day-night cutoff',
    nightDayCutoff: 'Night-day cutoff',
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
