import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SettingsScreen from '../app/settings';
import { useAppTheme } from '@/theme/app-theme';

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
});
