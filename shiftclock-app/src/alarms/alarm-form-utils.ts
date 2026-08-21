import type { TuneMetadata } from '../../modules/shiftclock-ble';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function formatAlarmTime(secondsOfDay: number): string {
  if (!Number.isInteger(secondsOfDay) || secondsOfDay < 0 || secondsOfDay > 86_399) {
    throw new Error('Invalid seconds of day');
  }
  const hours = Math.floor(secondsOfDay / 3600);
  const minutes = Math.floor((secondsOfDay % 3600) / 60);
  const seconds = secondsOfDay % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export function formatWeekdays(daysActive: number): string {
  if (daysActive === 0) return 'No days';
  if (daysActive === 0x3e) return 'Mon-Fri';
  if (daysActive === 0x7f) return 'Every day';
  return WEEKDAYS.filter((_day, index) => (daysActive & (1 << index)) !== 0).join(', ');
}

export function formatTuneLabel(tune: TuneMetadata): string {
  return `${tune.name} - ${tune.loopDurationSeconds.toFixed(2)} s`;
}
