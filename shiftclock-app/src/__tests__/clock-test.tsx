import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ClockScreen from '../app/index';
import {
  commitSettings,
  connect,
  reloadSettings,
  scan,
  writeAlarm,
  writeSettings,
  type ClockSettingsSnapshot,
  type ConnectionStateChangedEvent,
  type ShiftclockDevice,
} from '../../modules/shiftclock-ble';

let mockDiscoveredListener: ((device: ShiftclockDevice) => void) | undefined;
let mockConnectionListener: ((event: ConnectionStateChangedEvent) => void) | undefined;
let mockSettingsListener: ((settings: ClockSettingsSnapshot | null) => void) | undefined;

jest.mock('../../modules/shiftclock-ble', () => ({
  SHIFTCLOCK_BLE_PROTOCOL: {
    settings: {
      ids: {
        timezone: 0,
        brightness: 1,
        seconds: 2,
        movingDp: 3,
        volume: 4,
        clockForm: 5,
        meriIndicator: 6,
      },
    },
  },
  scan: jest.fn().mockResolvedValue(undefined),
  stopScan: jest.fn().mockResolvedValue(undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  writeAlarm: jest.fn().mockResolvedValue(undefined),
  writeSettings: jest.fn().mockResolvedValue(undefined),
  commitSettings: jest.fn().mockResolvedValue(undefined),
  reloadSettings: jest.fn().mockResolvedValue({
    timezone: 4,
    brightness: 5,
    seconds: 0,
    movingDp: 1,
    volume: 30,
    clockForm: 0,
    meriIndicator: 1,
  }),
  addSettingsListener: jest.fn((listener) => {
    mockSettingsListener = listener;
    listener(null);
    return { remove: jest.fn() };
  }),
  addDeviceDiscoveredListener: jest.fn((listener) => {
    mockDiscoveredListener = listener;
    return { remove: jest.fn() };
  }),
  addConnectionStateListener: jest.fn((listener) => {
    mockConnectionListener = listener;
    return { remove: jest.fn() };
  }),
}));

jest.mock('@react-native-community/slider', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockSlider(props: object) {
    return React.createElement(View, props);
  };
});

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

function renderClock() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ClockScreen />
    </SafeAreaProvider>
  );
}

describe('ClockScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(scan).mockResolvedValue(undefined);
    jest.mocked(connect).mockResolvedValue(undefined);
    jest.mocked(writeAlarm).mockResolvedValue(undefined);
    jest.mocked(writeSettings).mockResolvedValue(undefined);
    jest.mocked(commitSettings).mockResolvedValue(undefined);
    jest.mocked(reloadSettings).mockResolvedValue({
      timezone: 4,
      brightness: 5,
      seconds: 0,
      movingDp: 1,
      volume: 30,
      clockForm: 0,
      meriIndicator: 1,
    });
  });

  test('updates one row for repeated advertisements and connects that device', async () => {
    await renderClock();

    await act(async () => {
      mockDiscoveredListener?.({ id: 'clock-1', name: null, rssi: -70 });
      mockDiscoveredListener?.({ id: 'clock-1', name: 'Bedroom Clock', rssi: -54 });
    });

    expect(screen.getAllByText('Bedroom Clock')).toHaveLength(1);
    expect(screen.getByText('RSSI -54 dBm')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Connect to Bedroom Clock' }));

    await waitFor(() => expect(connect).toHaveBeenCalledWith('clock-1'));
  });

  test('sends the fixed Alarm packet only after a connected event', async () => {
    await renderClock();

    expect(screen.getByRole('button', { name: 'Send alarm packet' })).toBeDisabled();

    await act(async () => {
      mockConnectionListener?.({ state: 'connected', deviceId: 'clock-1' });
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Send alarm packet' }));
    await waitFor(() =>
      expect(writeAlarm).toHaveBeenCalledWith({
        daysActive: 0,
        secondsOfDay: 0,
        flashUntilOff: false,
        rampDurationSeconds: 0,
        volume: 0,
      })
    );
    await screen.findByText('Alarm packet sent');
  });

  test('shows Clock settings visibly disabled until connection and hydration finish', async () => {
    await renderClock();

    expect(screen.getByText('Clock settings')).toBeTruthy();
    expect(screen.getByTestId('clock-settings-section')).toHaveStyle({ opacity: 0.45 });
    expect(screen.getByRole('adjustable', { name: 'Timezone' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Seconds' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Commit clock settings' })).toBeDisabled();
  });

  test('hydrates and enables every Clock setting only when fully connected', async () => {
    await renderClock();
    await act(async () => {
      mockSettingsListener?.(SETTINGS);
      mockConnectionListener?.({ state: 'connected', deviceId: 'clock-1' });
    });

    expect(screen.getByTestId('clock-settings-section')).toHaveStyle({ opacity: 1 });
    expect(screen.getByText('Timezone: 19')).toBeTruthy();
    expect(screen.getByText('Brightness: 8')).toBeTruthy();
    expect(screen.getByText('Moving decimal point: 2')).toBeTruthy();
    expect(screen.getByText('Volume: 20')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Seconds' })).toBeOnTheScreen();
  });

  test('sends toggle values and exact Commit and Reload commands through the facade', async () => {
    await renderClock();
    await act(async () => {
      mockSettingsListener?.(SETTINGS);
      mockConnectionListener?.({ state: 'connected', deviceId: 'clock-1' });
    });

    fireEvent(screen.getByRole('switch', { name: 'Seconds' }), 'valueChange', false);
    await waitFor(() => expect(writeSettings).toHaveBeenCalledWith({ id: 2, value: 0 }));

    await fireEvent.press(screen.getByRole('button', { name: 'Commit clock settings' }));
    await waitFor(() => expect(commitSettings).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByRole('button', { name: 'Reload clock settings' }));
    await waitFor(() => expect(reloadSettings).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Timezone: 4')).toBeTruthy();
  });

  test('removes only the raw Settings test button', async () => {
    await renderClock();
    expect(screen.queryByRole('button', { name: 'Send settings packet' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Send alarm packet' })).toBeTruthy();
  });

  test('samples Brightness and flushes its final release value', async () => {
    await renderClock();
    await act(async () => {
      mockSettingsListener?.(SETTINGS);
      mockConnectionListener?.({ state: 'connected', deviceId: 'clock-1' });
    });
    const brightness = screen.getByRole('adjustable', { name: 'Brightness' });

    await act(async () => {
      brightness.props.onValueChange(10);
      brightness.props.onValueChange(12);
      brightness.props.onSlidingComplete(15);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(writeSettings).toHaveBeenLastCalledWith({ id: 1, value: 15 })
    );
  });

  test('restores the confirmed toggle when its write fails', async () => {
    let rejectWrite: ((cause: Error) => void) | undefined;
    jest.mocked(writeSettings).mockImplementationOnce(
      () => new Promise<void>((_resolve, reject) => { rejectWrite = reject; })
    );
    await renderClock();
    await act(async () => {
      mockSettingsListener?.(SETTINGS);
      mockConnectionListener?.({ state: 'connected', deviceId: 'clock-1' });
    });
    const seconds = screen.getByRole('switch', { name: 'Seconds' });

    await act(async () => {
      seconds.props.onChange({ nativeEvent: { value: false } });
      rejectWrite?.(new Error('Settings acknowledgement timed out'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await screen.findByText('Settings acknowledgement timed out')).toBeTruthy();
    await waitFor(() => expect(seconds).toHaveProp('value', true));
  });

  test('renders BLE rejection feedback', async () => {
    jest.mocked(scan).mockRejectedValueOnce(new Error('ERR_NOT_IMPLEMENTED'));
    await renderClock();

    await fireEvent.press(screen.getByRole('button', { name: 'Scan for devices' }));

    expect(await screen.findByText('ERR_NOT_IMPLEMENTED')).toBeTruthy();
  });
});

const SETTINGS: ClockSettingsSnapshot = {
  timezone: 19,
  brightness: 8,
  seconds: 1,
  movingDp: 2,
  volume: 20,
  clockForm: 1,
  meriIndicator: 0,
};
