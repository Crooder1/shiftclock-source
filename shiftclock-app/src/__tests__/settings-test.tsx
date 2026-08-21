import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SettingsScreen from '../app/settings';
import { useAutoConnect } from '@/auto-connect/auto-connect';
import { useAppTheme } from '@/theme/app-theme';

jest.mock('@/auto-connect/auto-connect', () => ({
  useAutoConnect: jest.fn(),
}));

jest.mock('@/theme/app-theme', () => ({
  useAppTheme: jest.fn(),
}));

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
};

function renderSettings() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <SettingsScreen />
    </SafeAreaProvider>
  );
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAppTheme).mockReturnValue({
      mode: 'light',
      hydrated: true,
      setMode: jest.fn().mockResolvedValue(undefined),
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

  test('selects dark mode from the switch', async () => {
    const setMode = jest.fn().mockResolvedValue(undefined);
    jest.mocked(useAppTheme).mockReturnValue({ mode: 'light', hydrated: true, setMode });

    await renderSettings();
    await fireEvent(screen.getByRole('switch', { name: 'Dark mode' }), 'valueChange', true);

    await waitFor(() => expect(setMode).toHaveBeenCalledWith('dark'));
  });

  test('shows a storage write error and keeps the switch available', async () => {
    const setMode = jest.fn().mockRejectedValue(new Error('Storage unavailable'));
    jest.mocked(useAppTheme).mockReturnValue({ mode: 'light', hydrated: true, setMode });

    await renderSettings();
    await fireEvent(screen.getByRole('switch', { name: 'Dark mode' }), 'valueChange', true);

    expect(await screen.findByText('Storage unavailable')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeTruthy();
  });

  test('enables Auto-Connect from the app settings', async () => {
    const setEnabled = jest.fn().mockResolvedValue(undefined);
    jest.mocked(useAutoConnect).mockReturnValue({
      ...jest.mocked(useAutoConnect)(),
      setEnabled,
    });

    await renderSettings();
    expect(screen.getByRole('switch', { name: 'Auto-Connect' })).toHaveProp(
      'accessibilityHint',
      'Connects to the saved clock when it is discovered during startup or a manual scan.'
    );
    await fireEvent(
      screen.getByRole('switch', { name: 'Auto-Connect' }),
      'valueChange',
      true
    );

    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(true));
  });

  test('shows the saved Auto-Connect clock while the setting is disabled', async () => {
    jest.mocked(useAutoConnect).mockReturnValue({
      ...jest.mocked(useAutoConnect)(),
      enabled: false,
      target: { id: 'clock-7', name: 'Kitchen Clock' },
    });

    await renderSettings();

    expect(screen.getByText('Kitchen Clock')).toBeTruthy();
    expect(screen.getByText('clock-7')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Auto-Connect' })).toHaveProp('value', false);
  });

  test('shows an Auto-Connect persistence error and keeps the saved value', async () => {
    const setEnabled = jest.fn().mockRejectedValue(new Error('Storage unavailable'));
    jest.mocked(useAutoConnect).mockReturnValue({
      ...jest.mocked(useAutoConnect)(),
      enabled: false,
      setEnabled,
    });

    await renderSettings();
    await fireEvent(
      screen.getByRole('switch', { name: 'Auto-Connect' }),
      'valueChange',
      true
    );

    expect(await screen.findByText('Storage unavailable')).toBeTruthy();
    expect(screen.getByRole('alert')).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.getByRole('switch', { name: 'Auto-Connect' })).toHaveProp('value', false);
  });
});
