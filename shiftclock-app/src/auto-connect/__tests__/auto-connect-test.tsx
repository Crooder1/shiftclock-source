import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Button, Text } from 'react-native';

import {
  AUTO_CONNECT_STORAGE_KEY,
  AutoConnectProvider,
  useAutoConnect,
} from '../auto-connect';
import {
  connect,
  scan,
  type ConnectionStateChangedEvent,
  type ShiftclockDevice,
} from '../../../modules/shiftclock-ble';

let mockDiscoveredListener: ((device: ShiftclockDevice) => void) | undefined;
let mockConnectionListener: ((event: ConnectionStateChangedEvent) => void) | undefined;

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../../../modules/shiftclock-ble', () => ({
  scan: jest.fn().mockResolvedValue(undefined),
  stopScan: jest.fn().mockResolvedValue(undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  addDeviceDiscoveredListener: jest.fn((listener) => {
    mockDiscoveredListener = listener;
    return { remove: jest.fn() };
  }),
  addConnectionStateListener: jest.fn((listener) => {
    mockConnectionListener = listener;
    return { remove: jest.fn() };
  }),
}));

function AutoConnectProbe() {
  const {
    clearTarget,
    enabled,
    error,
    hydrated,
    setEnabled,
    setTarget,
    startScan,
    target,
  } = useAutoConnect();

  return (
    <>
      <Text>
        {hydrated ? 'ready' : 'loading'}:{enabled ? 'enabled' : 'disabled'}:
        {target?.id ?? 'none'}
      </Text>
      <Button title="Start scan" onPress={() => void startScan().catch(() => undefined)} />
      <Button title="Disable" onPress={() => void setEnabled(false).catch(() => undefined)} />
      <Button
        title="Choose bedroom"
        onPress={() =>
          void setTarget({ id: 'clock-9', name: 'Bedroom Clock' }).catch(() => undefined)
        }
      />
      <Button title="Clear target" onPress={() => void clearTarget().catch(() => undefined)} />
      {error ? <Text>{error}</Text> : null}
    </>
  );
}

function DiscoveredDevicesProbe() {
  const { devices } = useAutoConnect();
  const discovered = Object.values(devices)[0];

  return <Text>{discovered ? `${discovered.name}:${discovered.id}` : 'no devices'}</Text>;
}

function LateDeviceConsumerHarness() {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Button title="Show devices" onPress={() => setVisible(true)} />
      {visible ? <DiscoveredDevicesProbe /> : null}
    </>
  );
}

describe('AutoConnectProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
    jest.mocked(scan).mockResolvedValue(undefined);
    jest.mocked(connect).mockResolvedValue(undefined);
    mockDiscoveredListener = undefined;
    mockConnectionListener = undefined;
  });

  test('defaults Auto-Connect off and starts one scan after hydration', async () => {
    await render(
      <AutoConnectProvider>
        <AutoConnectProbe />
      </AutoConnectProvider>
    );

    expect(await screen.findByText('ready:disabled:none')).toBeTruthy();
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(AUTO_CONNECT_STORAGE_KEY);
    await waitFor(() => expect(scan).toHaveBeenCalledTimes(1));
  });

  test('hydrates a valid saved target before the startup scan', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({
        enabled: true,
        target: { id: 'clock-7', name: 'Kitchen Clock' },
      })
    );

    await render(
      <AutoConnectProvider>
        <AutoConnectProbe />
      </AutoConnectProvider>
    );

    expect(await screen.findByText('ready:enabled:clock-7')).toBeTruthy();
    await waitFor(() => expect(scan).toHaveBeenCalledTimes(1));
  });

  test('ignores malformed saved settings and still starts the startup scan', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({ enabled: 'yes', target: { id: 7, name: false } })
    );

    await render(
      <AutoConnectProvider>
        <AutoConnectProbe />
      </AutoConnectProvider>
    );

    expect(await screen.findByText('ready:disabled:none')).toBeTruthy();
    await waitFor(() => expect(scan).toHaveBeenCalledTimes(1));
  });

  test('starts scanning and reports an unreadable saved preference', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValue(new Error('Storage unavailable'));

    await render(
      <AutoConnectProvider>
        <AutoConnectProbe />
      </AutoConnectProvider>
    );

    expect(await screen.findByText('ready:disabled:none')).toBeTruthy();
    await waitFor(() => expect(scan).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Storage unavailable')).toBeTruthy();
  });

  test('reports a rejected startup scan without blocking hydration', async () => {
    jest.mocked(scan).mockRejectedValue(new Error('Bluetooth is unavailable'));

    await render(
      <AutoConnectProvider>
        <AutoConnectProbe />
      </AutoConnectProvider>
    );

    expect(await screen.findByText('ready:disabled:none')).toBeTruthy();
    expect(await screen.findByText('Bluetooth is unavailable')).toBeTruthy();
  });

  test('retains startup discoveries for consumers that mount after scanning begins', async () => {
    await render(
      <AutoConnectProvider>
        <LateDeviceConsumerHarness />
      </AutoConnectProvider>
    );
    await waitFor(() => expect(scan).toHaveBeenCalledTimes(1));

    await act(async () => {
      mockDiscoveredListener?.({ id: 'clock-4', name: null, rssi: -70 });
      mockDiscoveredListener?.({ id: 'clock-4', name: 'Hall Clock', rssi: -48 });
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Show devices' }));

    expect(await screen.findByText('Hall Clock:clock-4')).toBeTruthy();
  });

  test('connects to the saved target only once for duplicate scan results', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({
        enabled: true,
        target: { id: 'clock-7', name: 'Kitchen Clock' },
      })
    );
    await render(
      <AutoConnectProvider>
        <AutoConnectProbe />
      </AutoConnectProvider>
    );
    await screen.findByText('ready:enabled:clock-7');

    await act(async () => {
      mockDiscoveredListener?.({ id: 'clock-2', name: 'Other Clock', rssi: -40 });
      mockDiscoveredListener?.({ id: 'clock-7', name: 'Kitchen Clock', rssi: -50 });
      mockDiscoveredListener?.({ id: 'clock-7', name: 'Kitchen Clock', rssi: -49 });
    });

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    expect(connect).toHaveBeenCalledWith('clock-7');
  });

  test('does not scan or reconnect when a connected clock disconnects', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({
        enabled: true,
        target: { id: 'clock-7', name: 'Kitchen Clock' },
      })
    );
    await render(
      <AutoConnectProvider>
        <AutoConnectProbe />
      </AutoConnectProvider>
    );
    await screen.findByText('ready:enabled:clock-7');
    await waitFor(() => expect(scan).toHaveBeenCalledTimes(1));

    await act(async () => {
      mockDiscoveredListener?.({ id: 'clock-7', name: 'Kitchen Clock', rssi: -55 });
    });
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));

    await act(async () => {
      mockConnectionListener?.({ state: 'connected', deviceId: 'clock-7' });
      mockConnectionListener?.({ state: 'disconnected', deviceId: 'clock-7' });
      mockDiscoveredListener?.({ id: 'clock-7', name: 'Kitchen Clock', rssi: -55 });
    });

    expect(scan).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  test('disarms a manual scan when the current connection drops', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({
        enabled: true,
        target: { id: 'clock-7', name: 'Kitchen Clock' },
      })
    );
    await render(
      <AutoConnectProvider>
        <AutoConnectProbe />
      </AutoConnectProvider>
    );
    await screen.findByText('ready:enabled:clock-7');
    await waitFor(() => expect(scan).toHaveBeenCalledTimes(1));

    await act(async () => {
      mockConnectionListener?.({ state: 'connected', deviceId: 'clock-7' });
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Start scan' }));
    await waitFor(() => expect(scan).toHaveBeenCalledTimes(2));

    await act(async () => {
      mockConnectionListener?.({ state: 'disconnected', deviceId: 'clock-7' });
      mockDiscoveredListener?.({ id: 'clock-7', name: 'Kitchen Clock', rssi: -55 });
    });

    expect(connect).not.toHaveBeenCalled();
  });

  test('does not connect when Auto-Connect is disabled', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({
        enabled: false,
        target: { id: 'clock-7', name: 'Kitchen Clock' },
      })
    );
    await render(
      <AutoConnectProvider>
        <AutoConnectProbe />
      </AutoConnectProvider>
    );
    await screen.findByText('ready:disabled:clock-7');

    await act(async () => {
      mockDiscoveredListener?.({ id: 'clock-7', name: 'Kitchen Clock', rssi: -55 });
    });

    expect(connect).not.toHaveBeenCalled();
  });

  test('allows one new attempt when the user starts another scan', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({
        enabled: true,
        target: { id: 'clock-7', name: 'Kitchen Clock' },
      })
    );
    jest.mocked(connect).mockRejectedValue(new Error('Connection failed'));
    await render(
      <AutoConnectProvider>
        <AutoConnectProbe />
      </AutoConnectProvider>
    );
    await screen.findByText('ready:enabled:clock-7');

    await act(async () => {
      mockDiscoveredListener?.({ id: 'clock-7', name: 'Kitchen Clock', rssi: -55 });
    });
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));

    await act(async () => {
      mockDiscoveredListener?.({ id: 'clock-7', name: 'Kitchen Clock', rssi: -54 });
    });
    expect(connect).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Start scan' }));
    await waitFor(() => expect(scan).toHaveBeenCalledTimes(2));
    await act(async () => {
      mockDiscoveredListener?.({ id: 'clock-7', name: 'Kitchen Clock', rssi: -53 });
    });

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(2));
  });

  test('persists changes before publishing them and retains the target when disabled', async () => {
    let finishWrite: (() => void) | undefined;
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({
        enabled: true,
        target: { id: 'clock-7', name: 'Kitchen Clock' },
      })
    );
    jest.mocked(AsyncStorage.setItem).mockImplementation(
      () => new Promise<void>((resolve) => { finishWrite = resolve; })
    );
    await render(
      <AutoConnectProvider>
        <AutoConnectProbe />
      </AutoConnectProvider>
    );
    await screen.findByText('ready:enabled:clock-7');

    await fireEvent.press(screen.getByRole('button', { name: 'Disable' }));

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      AUTO_CONNECT_STORAGE_KEY,
      '{"enabled":false,"target":{"id":"clock-7","name":"Kitchen Clock"}}'
    );
    expect(screen.getByText('ready:enabled:clock-7')).toBeTruthy();

    await act(async () => {
      finishWrite?.();
    });
    expect(await screen.findByText('ready:disabled:clock-7')).toBeTruthy();
  });

  test('serializes preference changes against the latest persisted record', async () => {
    const finishWrites: Array<() => void> = [];
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({
        enabled: true,
        target: { id: 'clock-7', name: 'Kitchen Clock' },
      })
    );
    jest.mocked(AsyncStorage.setItem).mockImplementation(
      () => new Promise<void>((resolve) => { finishWrites.push(resolve); })
    );
    await render(
      <AutoConnectProvider>
        <AutoConnectProbe />
      </AutoConnectProvider>
    );
    await screen.findByText('ready:enabled:clock-7');

    await fireEvent.press(screen.getByRole('button', { name: 'Choose bedroom' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Disable' }));

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(
      1,
      AUTO_CONNECT_STORAGE_KEY,
      '{"enabled":true,"target":{"id":"clock-9","name":"Bedroom Clock"}}'
    );

    await act(async () => {
      finishWrites[0]?.();
    });
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2));
    expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(
      2,
      AUTO_CONNECT_STORAGE_KEY,
      '{"enabled":false,"target":{"id":"clock-9","name":"Bedroom Clock"}}'
    );

    await act(async () => {
      finishWrites[1]?.();
    });
    expect(await screen.findByText('ready:disabled:clock-9')).toBeTruthy();
  });

  test('saves a replacement target and clears it without changing the enabled setting', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({
        enabled: true,
        target: { id: 'clock-7', name: 'Kitchen Clock' },
      })
    );
    await render(
      <AutoConnectProvider>
        <AutoConnectProbe />
      </AutoConnectProvider>
    );
    await screen.findByText('ready:enabled:clock-7');

    await fireEvent.press(screen.getByRole('button', { name: 'Choose bedroom' }));
    await waitFor(() => expect(screen.getByText('ready:enabled:clock-9')).toBeTruthy());
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
      AUTO_CONNECT_STORAGE_KEY,
      '{"enabled":true,"target":{"id":"clock-9","name":"Bedroom Clock"}}'
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Clear target' }));
    await waitFor(() => expect(screen.getByText('ready:enabled:none')).toBeTruthy());
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
      AUTO_CONNECT_STORAGE_KEY,
      '{"enabled":true,"target":null}'
    );
  });

  test('reports persistence failures without changing the selected setting', async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValue(new Error('Storage unavailable'));
    await render(
      <AutoConnectProvider>
        <AutoConnectProbe />
      </AutoConnectProvider>
    );
    await screen.findByText('ready:disabled:none');

    await fireEvent.press(screen.getByRole('button', { name: 'Choose bedroom' }));

    expect(await screen.findByText('Storage unavailable')).toBeTruthy();
    expect(screen.getByText('ready:disabled:none')).toBeTruthy();
  });
});
