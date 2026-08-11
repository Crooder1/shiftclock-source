import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Button, Text } from 'react-native';

import { AppThemeProvider, useAppTheme } from '../app-theme';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

function ThemeProbe() {
  const { hydrated, mode, setMode } = useAppTheme();

  return (
    <>
      <Text>{hydrated ? mode : 'loading'}</Text>
      <Button title="Use dark" onPress={() => void setMode('dark')} />
    </>
  );
}

describe('AppThemeProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  test('hydrates a stored dark theme', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('dark');

    await render(
      <AppThemeProvider>
        <ThemeProbe />
      </AppThemeProvider>
    );

    expect(await screen.findByText('dark')).toBeTruthy();
  });

  test('persists a selected theme before exposing it', async () => {
    let finishWrite: (() => void) | undefined;
    jest.mocked(AsyncStorage.setItem).mockImplementation(
      () => new Promise<void>((resolve) => {
        finishWrite = resolve;
      })
    );

    await render(
      <AppThemeProvider>
        <ThemeProbe />
      </AppThemeProvider>
    );

    await screen.findByText('light');
    await fireEvent.press(screen.getByRole('button', { name: 'Use dark' }));

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@shiftclock/theme-mode', 'dark');
    expect(screen.getByText('light')).toBeTruthy();

    await act(async () => {
      finishWrite?.();
    });

    await waitFor(() => expect(screen.getByText('dark')).toBeTruthy());
  });
});
