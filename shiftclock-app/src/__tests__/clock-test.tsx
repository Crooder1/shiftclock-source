import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ClockScreen from '../app/index';
import { useAutoConnect } from '@/auto-connect/auto-connect';
import {
  commitSettings,
  connect,
  disconnect,
  reloadSettings,
  scan,
  stopScan,
  writeSettings,
  type ClockSettingsSnapshot,
  type ConnectionStateChangedEvent,
} from '../../modules/shiftclock-ble';

jest.mock('@/auto-connect/auto-connect', () => ({
  useAutoConnect: jest.fn(),
}));

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
  disconnect: jest.fn().mockResolvedValue(undefined),
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
    jest.mocked(disconnect).mockResolvedValue(undefined);
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
    jest.mocked(useAutoConnect).mockReturnValue({
      clearTarget: jest.fn().mockResolvedValue(undefined),
      devices: {},
      enabled: false,
      error: null,
      hydrated: true,
      setEnabled: jest.fn().mockResolvedValue(undefined),
      setTarget: jest.fn().mockResolvedValue(undefined),
      startScan: jest.fn().mockResolvedValue(undefined),
      target: null,
    });
  });

  test('orders connection, devices, and settings from top to bottom', async () => {
    const view = await renderClock();
    const tree = JSON.stringify(view.toJSON());
    const connectionIndex = tree.indexOf('Connection');
    const devicesIndex = tree.indexOf('Devices');
    const settingsIndex = tree.indexOf('Clock settings');

    expect(connectionIndex).toBeGreaterThan(-1);
    expect(devicesIndex).toBeGreaterThan(connectionIndex);
    expect(settingsIndex).toBeGreaterThan(devicesIndex);
  });

  test('shows the latest retained advertisement and connects that device', async () => {
    jest.mocked(useAutoConnect).mockReturnValue({
      ...jest.mocked(useAutoConnect)(),
      devices: {
        'clock-1': { id: 'clock-1', name: 'Bedroom Clock', rssi: -54 },
      },
    });
    await renderClock();

    expect(screen.getAllByText('Bedroom Clock')).toHaveLength(1);
    expect(screen.getByText('RSSI -54 dBm')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Connect to Bedroom Clock' }));

    await waitFor(() => expect(connect).toHaveBeenCalledWith('clock-1'));
  });

  test('shows devices retained from the startup scan before the Clock tab mounted', async () => {
    jest.mocked(useAutoConnect).mockReturnValue({
      ...jest.mocked(useAutoConnect)(),
      devices: {
        'clock-4': { id: 'clock-4', name: 'Hall Clock', rssi: -48 },
      },
    });

    await renderClock();

    expect(screen.getByText('Hall Clock')).toBeTruthy();
    expect(screen.getByText('RSSI -48 dBm')).toBeTruthy();
  });

  test('explicitly disconnects the connected clock from the status card', async () => {
    await renderClock();
    await act(async () => {
      mockSettingsListener?.(SETTINGS);
      mockConnectionListener?.({ state: 'connected', deviceId: 'clock-1' });
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Disconnect from clock' }));

    await waitFor(() => expect(disconnect).toHaveBeenCalledTimes(1));
  });

  test('replaces the Auto-Connect target with the connected clock', async () => {
    const setTarget = jest.fn().mockResolvedValue(undefined);
    jest.mocked(useAutoConnect).mockReturnValue({
      ...jest.mocked(useAutoConnect)(),
      devices: {
        'clock-1': { id: 'clock-1', name: 'Bedroom Clock', rssi: -54 },
      },
      enabled: true,
      setTarget,
      target: { id: 'clock-7', name: 'Kitchen Clock' },
    });
    await renderClock();
    await act(async () => {
      mockConnectionListener?.({ state: 'connected', deviceId: 'clock-1' });
    });

    await fireEvent.press(
      screen.getByRole('button', { name: 'Auto-connect to this clock' })
    );

    await waitFor(() =>
      expect(setTarget).toHaveBeenCalledWith({ id: 'clock-1', name: 'Bedroom Clock' })
    );
  });

  test('removes the connected clock as the Auto-Connect target', async () => {
    const clearTarget = jest.fn().mockResolvedValue(undefined);
    jest.mocked(useAutoConnect).mockReturnValue({
      ...jest.mocked(useAutoConnect)(),
      clearTarget,
      enabled: true,
      target: { id: 'clock-1', name: 'Bedroom Clock' },
    });
    await renderClock();
    await act(async () => {
      mockConnectionListener?.({ state: 'connected', deviceId: 'clock-1' });
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Remove auto-connect' }));

    await waitFor(() => expect(clearTarget).toHaveBeenCalledTimes(1));
  });

  test('hides the Auto-Connect target action when the setting is disabled', async () => {
    await renderClock();
    await act(async () => {
      mockConnectionListener?.({ state: 'connected', deviceId: 'clock-1' });
    });

    expect(
      screen.queryByRole('button', { name: 'Auto-connect to this clock' })
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove auto-connect' })).toBeNull();
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
    expect(screen.getByText('Timezone: -5')).toBeTruthy();
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

  test('does not expose raw packet test buttons', async () => {
    await renderClock();
    expect(screen.queryByRole('button', { name: 'Send settings packet' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send alarm packet' })).toBeNull();
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
    const startScan = jest.fn().mockRejectedValueOnce(new Error('ERR_NOT_IMPLEMENTED'));
    jest.mocked(useAutoConnect).mockReturnValue({
      ...jest.mocked(useAutoConnect)(),
      startScan,
    });
    await renderClock();

    await fireEvent.press(screen.getByRole('button', { name: 'Scan for devices' }));

    expect(await screen.findByText('ERR_NOT_IMPLEMENTED')).toHaveProp(
      'accessibilityLiveRegion',
      'polite'
    );
  });

  test('routes manual scans through Auto-Connect and leaves scan ownership at app scope', async () => {
    const startScan = jest.fn().mockResolvedValue(undefined);
    jest.mocked(useAutoConnect).mockReturnValue({
      ...jest.mocked(useAutoConnect)(),
      startScan,
    });
    const view = await renderClock();

    await fireEvent.press(screen.getByRole('button', { name: 'Scan for devices' }));
    await waitFor(() => expect(startScan).toHaveBeenCalledTimes(1));
    expect(scan).not.toHaveBeenCalled();

    view.unmount();
    expect(stopScan).not.toHaveBeenCalled();
  });
});

const SETTINGS: ClockSettingsSnapshot = {
  timezone: -5,
  brightness: 8,
  seconds: 1,
  movingDp: 2,
  volume: 20,
  clockForm: 1,
  meriIndicator: 0,
};
