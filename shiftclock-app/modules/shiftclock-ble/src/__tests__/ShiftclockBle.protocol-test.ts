import { SHIFTCLOCK_BLE_PROTOCOL } from '../ShiftclockBle.constants';
import {
  decodeAlarmRead,
  decodeMessage,
  decodeSettings,
  decodeTuneRead,
  encodeAlarm,
  encodeAlarmCommand,
  encodeAlarmMutation,
  encodeAlarmSelection,
  encodeSettings,
  encodeTuneSelection,
} from '../ShiftclockBle.protocol';

const SETTINGS_PACKET = [0, 0xfb, 8, 1, 2, 20, 1, 0] as const;

describe('Shiftclock BLE protocol', () => {
  test('encodes the Alarm fields at their exact little-endian offsets', () => {
    expect(
      encodeAlarm({
        daysActive: 0x55,
        secondsOfDay: 0x01_02_03,
        tuneId: 7,
        rampDurationSeconds: 0x01f4,
        volume: 87,
        autoDisableSeconds: 3600,
      })
    ).toEqual([
      0x00,
      0x01,
      0x00,
      0x55,
      0x03,
      0x02,
      0x01,
      0x07,
      0xf4,
      0x01,
      87,
      0x10,
      0x0e,
    ]);
  });

  test.each([
    ['daysActive', { daysActive: 0x80, secondsOfDay: 0, tuneId: 0, rampDurationSeconds: 0, volume: 0, autoDisableSeconds: 0 }],
    ['secondsOfDay', { daysActive: 0, secondsOfDay: 86_400, tuneId: 0, rampDurationSeconds: 0, volume: 0, autoDisableSeconds: 0 }],
    ['tuneId', { daysActive: 0, secondsOfDay: 0, tuneId: 32, rampDurationSeconds: 0, volume: 0, autoDisableSeconds: 0 }],
    ['rampDurationSeconds', { daysActive: 0, secondsOfDay: 0, tuneId: 0, rampDurationSeconds: 601, volume: 0, autoDisableSeconds: 0 }],
    ['volume', { daysActive: 0, secondsOfDay: 0, tuneId: 0, rampDurationSeconds: 0, volume: 101, autoDisableSeconds: 0 }],
    ['autoDisableSeconds', { daysActive: 0, secondsOfDay: 0, tuneId: 0, rampDurationSeconds: 0, volume: 0, autoDisableSeconds: 3601 }],
  ])('rejects an invalid Alarm %s', (_field, alarm) => {
    expect(() => encodeAlarm(alarm)).toThrow('Invalid Alarm');
  });

  test('encodes Alarm selection, modify, and remove packets exactly', () => {
    expect(encodeAlarmSelection(0xff)).toEqual([
      0, 0, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(
      encodeAlarmMutation('modify', 4, {
        daysActive: 0x55,
        secondsOfDay: 0x01_02_03,
        tuneId: 7,
        rampDurationSeconds: 500,
        volume: 87,
        autoDisableSeconds: 3600,
      })
    ).toEqual([0, 2, 4, 0x55, 3, 2, 1, 7, 0xf4, 1, 87, 0x10, 0x0e]);
    expect(encodeAlarmMutation('remove', 4)).toEqual([
      0, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  test('encodes Alarm commit and reload commands with an ignored zero payload', () => {
    expect(encodeAlarmCommand('commit')).toEqual([
      0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(encodeAlarmCommand('reload')).toEqual([
      0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  test('decodes Alarm count and record responses', () => {
    expect(decodeAlarmRead([0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'count')).toEqual({
      kind: 'count',
      count: 2,
    });
    expect(
      decodeAlarmRead([0, 3, 0x55, 3, 2, 1, 7, 0xf4, 1, 87, 0x10, 0x0e], 'alarm')
    ).toEqual({
      kind: 'alarm',
      alarm: {
        id: 3,
        daysActive: 0x55,
        secondsOfDay: 0x01_02_03,
        tuneId: 7,
        rampDurationSeconds: 500,
        volume: 87,
        autoDisableSeconds: 3600,
      },
    });
  });

  test('rejects malformed Alarm read responses', () => {
    expect(() => decodeAlarmRead(Array(11).fill(0), 'count')).toThrow('Alarm packet size');
    expect(() => decodeAlarmRead([1, ...Array(11).fill(0)], 'count')).toThrow(
      'Alarm packet header'
    );
    expect(() => decodeAlarmRead([0, 2, 1, ...Array(9).fill(0)], 'count')).toThrow(
      'Alarm count payload'
    );
  });

  test('encodes Tune selection and decodes count and metadata', () => {
    expect(encodeTuneSelection(0xff)).toEqual([0, 0xff]);
    expect(decodeTuneRead([0, 1, ...Array(24).fill(0)], 'count')).toEqual({
      kind: 'count',
      count: 1,
    });

    const packet = [0, 3, 0xb8, 0xa0, 0, 0, 80, 117, 115, 104, 0];
    packet.push(...Array(26 - packet.length).fill(0));
    expect(decodeTuneRead(packet, 'tune')).toEqual({
      kind: 'tune',
      tune: { id: 3, name: 'Push', loopDurationSeconds: 1.28575 },
    });
  });

  test('rejects malformed Tune responses', () => {
    expect(() => decodeTuneRead(Array(25).fill(0), 'count')).toThrow('Tune packet size');
    expect(() => decodeTuneRead([1, ...Array(25).fill(0)], 'count')).toThrow(
      'Tune packet header'
    );
    expect(() => decodeTuneRead([0, 1, 1, ...Array(23).fill(0)], 'count')).toThrow(
      'Tune count metadata'
    );
    expect(() =>
      decodeTuneRead([0, 0, 1, 0, 0, 0, ...Array(20).fill(65)], 'tune')
    ).toThrow(
      'Tune name'
    );
  });

  test('encodes signed Settings fields as two-complement bytes', () => {
    expect(encodeSettings({ id: -1, value: -2 })).toEqual([0x00, 0xff, 0xfe]);
    expect(encodeSettings({ id: 6, value: 100 })).toEqual([0x00, 0x06, 0x64]);
  });

  test('rejects values outside the signed Settings byte range', () => {
    expect(() => encodeSettings({ id: 128, value: 0 })).toThrow('Invalid Settings');
    expect(() => encodeSettings({ id: 0, value: -129 })).toThrow('Invalid Settings');
    expect(() => encodeSettings({ id: 0, value: 1.5 })).toThrow('Invalid Settings');
  });

  test('decodes the exact Settings read packet in firmware ID order', () => {
    expect(decodeSettings(SETTINGS_PACKET)).toEqual({
      timezone: -5,
      brightness: 8,
      seconds: 1,
      movingDp: 2,
      volume: 20,
      clockForm: 1,
      meriIndicator: 0,
    });
  });

  test.each([
    ['size', SETTINGS_PACKET.slice(0, 7), 'size'],
    ['header', [1, ...SETTINGS_PACKET.slice(1)], 'header'],
    ['timezone low', [0, 0xf3, 8, 1, 2, 20, 1, 0], 'Timezone'],
    ['timezone high', [0, 12, 8, 1, 2, 20, 1, 0], 'Timezone'],
    ['brightness', [0, 0xfb, 16, 1, 2, 20, 1, 0], 'Brightness'],
    ['seconds', [0, 0xfb, 8, 2, 2, 20, 1, 0], 'Seconds'],
    ['moving DP', [0, 0xfb, 8, 1, 3, 20, 1, 0], 'Moving DP'],
    ['volume', [0, 0xfb, 8, 1, 2, 101, 1, 0], 'Volume'],
    ['clock form', [0, 0xfb, 8, 1, 2, 20, 2, 0], 'Clock form'],
    ['meri indicator', [0, 0xfb, 8, 1, 2, 20, 1, 2], 'Meri indicator'],
  ])('rejects an invalid Settings %s', (_label, packet, message) => {
    expect(() => decodeSettings(packet)).toThrow(message);
  });

  test('defines exact Settings commands and success notification', () => {
    expect(SHIFTCLOCK_BLE_PROTOCOL.settings.commands).toEqual({
      commit: { id: -1, value: -1 },
      reload: { id: -1, value: -2 },
    });
    expect(SHIFTCLOCK_BLE_PROTOCOL.message.infoOperationSucceeded).toEqual({
      type: 0,
      code: 0,
    });
    expect(SHIFTCLOCK_BLE_PROTOCOL.message.errorOperationFailed).toEqual({
      type: 1,
      code: 7,
    });
  });

  test('decodes a null-padded Message packet', () => {
    const packet = [0, 1, 6, ...Array.from('Invalid size', (character) => character.charCodeAt(0))];
    packet.push(0, ...Array(43 - packet.length - 1).fill(0));

    expect(decodeMessage(packet)).toEqual({
      type: 1,
      code: 6,
      description: 'Invalid size',
    });
  });

  test('rejects a Message with the wrong size or protocol header', () => {
    expect(() => decodeMessage(Array(42).fill(0))).toThrow('Invalid Message packet size');
    expect(() => decodeMessage([1, ...Array(42).fill(0)])).toThrow('Invalid Message packet header');
  });

  test('rejects a Message description without a null terminator', () => {
    expect(() => decodeMessage([0, 1, 1, ...Array(40).fill(65)])).toThrow(
      'Invalid Message description'
    );
  });

  test('requires the final Message description byte to be null', () => {
    expect(() => decodeMessage([0, 1, 1, 65, 0, ...Array(37).fill(0), 65])).toThrow(
      'Invalid Message description'
    );
  });
});
