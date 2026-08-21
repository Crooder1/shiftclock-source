import {
  formatAlarmTime,
  formatTuneLabel,
  formatWeekdays,
} from '../alarm-form-utils';

describe('alarm form utilities', () => {
  test.each([
    [0, '00:00:00'],
    [25_201, '07:00:01'],
    [86_399, '23:59:59'],
  ])('formats %i seconds with one-second granularity', (value, expected) => {
    expect(formatAlarmTime(value)).toBe(expected);
  });

  test.each([
    { daysActive: 0x01, expected: 'Sun' },
    { daysActive: 0x02, expected: 'Mon' },
    { daysActive: 0x04, expected: 'Tue' },
    { daysActive: 0x08, expected: 'Wed' },
    { daysActive: 0x10, expected: 'Thu' },
    { daysActive: 0x20, expected: 'Fri' },
    { daysActive: 0x40, expected: 'Sat' },
  ])('formats weekday mask $daysActive as $expected', ({ daysActive, expected }) => {
    expect(formatWeekdays(daysActive)).toBe(expected);
  });

  test('formats common and custom weekday masks', () => {
    expect(formatWeekdays(0)).toBe('No days');
    expect(formatWeekdays(0x3e)).toBe('Mon-Fri');
    expect(formatWeekdays(0x7f)).toBe('Every day');
    expect(formatWeekdays(0x45)).toBe('Sun, Tue, Sat');
  });

  test('formats Tune metadata without exposing byte counts', () => {
    expect(formatTuneLabel({ id: 3, name: 'Push', loopDurationSeconds: 1.28575 })).toBe(
      'Push - 1.29 s'
    );
  });
});
