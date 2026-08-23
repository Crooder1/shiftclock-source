import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AlarmsScreen from '../app/alarms';
import {
  cancelTunePreview,
  commitAlarms,
  createAlarm,
  modifyAlarm,
  playTune,
  reloadAlarmData,
  reloadAlarms,
  removeAlarm,
  type AlarmRecord,
  type ConnectionStateChangedEvent,
  type TuneMetadata,
} from '../../modules/shiftclock-ble';

let connectionListener: ((event: ConnectionStateChangedEvent) => void) | undefined;
let alarmListener: ((alarms: readonly AlarmRecord[] | null) => void) | undefined;
let tuneListener: ((tunes: readonly TuneMetadata[] | null) => void) | undefined;

jest.mock('../../modules/shiftclock-ble', () => ({
  addConnectionStateListener: jest.fn((listener) => {
    connectionListener = listener;
    listener({ state: 'disconnected', deviceId: null });
    return { remove: jest.fn() };
  }),
  addAlarmListener: jest.fn((listener) => {
    alarmListener = listener;
    listener(null);
    return { remove: jest.fn() };
  }),
  addTuneListener: jest.fn((listener) => {
    tuneListener = listener;
    listener(null);
    return { remove: jest.fn() };
  }),
  reloadAlarmData: jest.fn().mockResolvedValue({ alarms: [], tunes: [] }),
  commitAlarms: jest.fn().mockResolvedValue(undefined),
  reloadAlarms: jest.fn().mockResolvedValue([]),
  createAlarm: jest.fn().mockResolvedValue([]),
  modifyAlarm: jest.fn().mockResolvedValue([]),
  removeAlarm: jest.fn().mockResolvedValue([]),
  playTune: jest.fn().mockResolvedValue(undefined),
  cancelTunePreview: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#f0f0f3',
    backgroundSelected: '#e0e1e6',
    textSecondary: '#60646c',
  }),
}));

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
};

const TUNES: readonly TuneMetadata[] = [
  { id: 0, name: 'Push', loopDurationSeconds: 1.28575 },
  { id: 1, name: 'Rise', loopDurationSeconds: 2 },
];

const ALARM: AlarmRecord = {
  id: 0,
  daysActive: 0x3e,
  secondsOfDay: 25_201,
  tuneId: 0,
  rampDurationSeconds: 3,
  volume: 40,
  autoDisableSeconds: 300,
};

async function renderAlarms() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <AlarmsScreen />
    </SafeAreaProvider>
  );
}

async function connectAndPublish(alarms: readonly AlarmRecord[] = [ALARM]) {
  await act(async () => {
    connectionListener?.({ state: 'connected', deviceId: 'clock-1' });
    tuneListener?.(TUNES);
    alarmListener?.(alarms);
  });
}

describe('AlarmsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(reloadAlarmData).mockResolvedValue({ alarms: [], tunes: [] });
    jest.mocked(commitAlarms).mockResolvedValue(undefined);
    jest.mocked(reloadAlarms).mockResolvedValue([]);
    jest.mocked(createAlarm).mockResolvedValue([]);
    jest.mocked(modifyAlarm).mockResolvedValue([]);
    jest.mocked(removeAlarm).mockResolvedValue([]);
    jest.mocked(playTune).mockResolvedValue(undefined);
    jest.mocked(cancelTunePreview).mockResolvedValue(undefined);
  });

  test('shows disconnected guidance and keeps Tune playback disabled', async () => {
    await renderAlarms();

    expect(screen.getByText('Connect to a Shiftclock to manage alarms.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play selected tune' })).toBeDisabled();
  });

  test('reloads on connection and displays Alarm time, days, and Tune duration', async () => {
    await renderAlarms();
    await connectAndPublish();

    await waitFor(() => expect(reloadAlarmData).toHaveBeenCalledTimes(1));
    expect(screen.getByText('07:00:01')).toBeTruthy();
    expect(screen.getByText('Mon-Fri')).toBeTruthy();
    expect(screen.getAllByText('Push - 1.29 s').length).toBeGreaterThan(0);
  });

  test('plays the selected Tune and offers Stop until preview completion', async () => {
    let finishPreview: (() => void) | undefined;
    jest.mocked(playTune).mockImplementation(
      () => new Promise<void>((resolve) => { finishPreview = resolve; })
    );
    await renderAlarms();
    await connectAndPublish();

    await fireEvent.press(screen.getByRole('button', { name: 'Play selected tune' }));
    await waitFor(() => expect(playTune).toHaveBeenCalledWith(0));
    expect(screen.getByRole('button', { name: 'Stop tune preview' })).toBeEnabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Stop tune preview' }));
    await waitFor(() => expect(cancelTunePreview).toHaveBeenCalledTimes(1));

    await act(async () => { finishPreview?.(); });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Play selected tune' })).toBeEnabled()
    );
  });

  test('commits and reloads Alarm persistence through explicit controls', async () => {
    await renderAlarms();
    await connectAndPublish();

    await fireEvent.press(screen.getByRole('button', { name: 'Commit alarms' }));
    await waitFor(() => expect(commitAlarms).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByRole('button', { name: 'Reload alarms' }));
    await waitFor(() => expect(reloadAlarms).toHaveBeenCalledTimes(1));
    expect(reloadAlarmData).toHaveBeenCalledTimes(1);
  });

  test('creates an Alarm with HH:MM:SS granularity and independent Tune selection', async () => {
    await renderAlarms();
    await connectAndPublish([]);

    await fireEvent.press(screen.getByRole('button', { name: 'Alarm hour: 07' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Set alarm hour to 08' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Alarm minute: 00' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Set alarm minute to 15' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Alarm second: 00' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Set alarm second to 42' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Test tune: Push - 1.29 s' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Select Rise - 2.00 s' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create alarm' }));

    await waitFor(() =>
      expect(createAlarm).toHaveBeenCalledWith({
        daysActive: 0x3e,
        secondsOfDay: 29_742,
        tuneId: 0,
        rampDurationSeconds: 0,
        volume: 100,
        autoDisableSeconds: 300,
      })
    );
    expect(screen.getByRole('button', { name: 'Alarm tune: Push - 1.29 s' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Test tune: Rise - 2.00 s' })).toBeTruthy();
  });

  test('maps the Sunday control to weekday bit zero', async () => {
    await renderAlarms();
    await connectAndPublish([]);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Sun' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create alarm' }));

    await waitFor(() =>
      expect(createAlarm).toHaveBeenCalledWith(
        expect.objectContaining({ daysActive: 0x3f })
      )
    );
  });

  test('prefills and modifies an existing Alarm', async () => {
    await renderAlarms();
    await connectAndPublish();

    await fireEvent.press(screen.getByRole('button', { name: 'Edit alarm 0' }));
    expect(screen.getByRole('button', { name: 'Alarm hour: 07' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Alarm minute: 00' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Alarm second: 01' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Set alarm second to 02' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save alarm' }));

    await waitFor(() =>
      expect(modifyAlarm).toHaveBeenCalledWith(0, {
        daysActive: 0x3e,
        secondsOfDay: 25_202,
        tuneId: 0,
        rampDurationSeconds: 3,
        volume: 40,
        autoDisableSeconds: 300,
      })
    );
  });

  test('removes an Alarm only after confirmation', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    await renderAlarms();
    await connectAndPublish();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete alarm 0' }));

    await waitFor(() => expect(removeAlarm).toHaveBeenCalledWith(0));
  });

  test('keeps only one alarm time menu expanded', async () => {
    await renderAlarms();
    await connectAndPublish([]);

    const hour = screen.getByRole('button', { name: 'Alarm hour: 07' });
    const minute = screen.getByRole('button', { name: 'Alarm minute: 00' });
    await fireEvent.press(hour);
    expect(hour).toHaveProp('accessibilityState', expect.objectContaining({ expanded: true }));

    await fireEvent.press(minute);
    expect(hour).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));
    expect(minute).toHaveProp('accessibilityState', expect.objectContaining({ expanded: true }));
  });
});
