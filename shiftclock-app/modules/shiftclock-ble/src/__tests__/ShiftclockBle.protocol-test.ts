import { SHIFTCLOCK_BLE_PROTOCOL } from '../ShiftclockBle.constants';
import {
  decodeMessage,
  decodeSettings,
  encodeAlarm,
  encodeSettings,
} from '../ShiftclockBle.protocol';

const SETTINGS_PACKET = [0, 19, 8, 1, 2, 20, 1, 0] as const;

describe('Shiftclock BLE protocol', () => {
  test('encodes the Alarm fields at their exact little-endian offsets', () => {
    expect(
      encodeAlarm({
        daysActive: 0x55,
        secondsOfDay: 0x01_02_03,
        flashUntilOff: true,
        rampDurationSeconds: 0x01f4,
        volume: 87,
      })
    ).toEqual([0x00, 0x55, 0x03, 0x02, 0x01, 0x01, 0xf4, 0x01, 87]);
  });

  test.each([
    ['daysActive', { daysActive: 0x80, secondsOfDay: 0, flashUntilOff: false, rampDurationSeconds: 0, volume: 0 }],
    ['secondsOfDay', { daysActive: 0, secondsOfDay: 86_400, flashUntilOff: false, rampDurationSeconds: 0, volume: 0 }],
    ['rampDurationSeconds', { daysActive: 0, secondsOfDay: 0, flashUntilOff: false, rampDurationSeconds: 601, volume: 0 }],
    ['volume', { daysActive: 0, secondsOfDay: 0, flashUntilOff: false, rampDurationSeconds: 0, volume: 101 }],
  ])('rejects an invalid Alarm %s', (_field, alarm) => {
    expect(() => encodeAlarm(alarm)).toThrow('Invalid Alarm');
  });

  test('encodes the Settings packet as three bytes', () => {
    expect(encodeSettings({ id: 0xa5, value: 0xfe })).toEqual([0x00, 0xa5, 0xfe]);
  });

  test('rejects non-byte Settings fields', () => {
    expect(() => encodeSettings({ id: 256, value: 0 })).toThrow('Invalid Settings');
    expect(() => encodeSettings({ id: 0, value: 1.5 })).toThrow('Invalid Settings');
  });

  test('decodes the exact Settings read packet in firmware ID order', () => {
    expect(decodeSettings(SETTINGS_PACKET)).toEqual({
      timezone: 19,
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
    ['timezone', [0, 24, 8, 1, 2, 20, 1, 0], 'Timezone'],
    ['brightness', [0, 19, 16, 1, 2, 20, 1, 0], 'Brightness'],
    ['seconds', [0, 19, 8, 2, 2, 20, 1, 0], 'Seconds'],
    ['moving DP', [0, 19, 8, 1, 3, 20, 1, 0], 'Moving DP'],
    ['volume', [0, 19, 8, 1, 2, 101, 1, 0], 'Volume'],
    ['clock form', [0, 19, 8, 1, 2, 20, 2, 0], 'Clock form'],
    ['meri indicator', [0, 19, 8, 1, 2, 20, 1, 2], 'Meri indicator'],
  ])('rejects an invalid Settings %s', (_label, packet, message) => {
    expect(() => decodeSettings(packet)).toThrow(message);
  });

  test('defines exact Settings commands and success notification', () => {
    expect(SHIFTCLOCK_BLE_PROTOCOL.settings.commands).toEqual({
      commit: { id: 0xff, value: 0xff },
      reload: { id: 0xff, value: 0xfe },
    });
    expect(SHIFTCLOCK_BLE_PROTOCOL.message.infoOperationSucceeded).toEqual({
      type: 0,
      code: 0,
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
