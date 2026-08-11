import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ClockScreen from '../app/index';
import {
  connect,
  scan,
  writeAlarm,
  writeSettings,
  type ConnectionStateChangedEvent,
  type ShiftclockDevice,
} from '../../modules/shiftclock-ble';

let mockDiscoveredListener: ((device: ShiftclockDevice) => void) | undefined;
let mockConnectionListener: ((event: ConnectionStateChangedEvent) => void) | undefined;

jest.mock('../../modules/shiftclock-ble', () => ({
  scan: jest.fn().mockResolvedValue(undefined),
  stopScan: jest.fn().mockResolvedValue(undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  writeAlarm: jest.fn().mockResolvedValue(undefined),
  writeSettings: jest.fn().mockResolvedValue(undefined),
  addDeviceDiscoveredListener: jest.fn((listener) => {
    mockDiscoveredListener = listener;
    return { remove: jest.fn() };
  }),
  addConnectionStateListener: jest.fn((listener) => {
    mockConnectionListener = listener;
    return { remove: jest.fn() };
  }),
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

  test('sends the exact fixed packets only after a connected event', async () => {
    await renderClock();

    expect(screen.getByRole('button', { name: 'Send alarm packet' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send settings packet' })).toBeDisabled();

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

    await fireEvent.press(screen.getByRole('button', { name: 'Send settings packet' }));
    await waitFor(() => expect(writeSettings).toHaveBeenCalledWith({ id: 0, value: 0 }));
  });

  test('renders BLE rejection feedback', async () => {
    jest.mocked(scan).mockRejectedValueOnce(new Error('ERR_NOT_IMPLEMENTED'));
    await renderClock();

    await fireEvent.press(screen.getByRole('button', { name: 'Scan for devices' }));

    expect(await screen.findByText('ERR_NOT_IMPLEMENTED')).toBeTruthy();
  });
});
