import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';

export type ThemeMode = 'light' | 'dark';

export const THEME_MODE_STORAGE_KEY = '@shiftclock/theme-mode';

type AppThemeContextValue = {
  mode: ThemeMode;
  hydrated: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
};

const AppThemeContext = createContext<AppThemeContextValue | undefined>(undefined);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemMode: ThemeMode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [selectedMode, setSelectedMode] = useState<ThemeMode | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(THEME_MODE_STORAGE_KEY)
      .then((storedMode) => {
        if (active && (storedMode === 'light' || storedMode === 'dark')) {
          setSelectedMode(storedMode);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback(async (mode: ThemeMode) => {
    await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    setSelectedMode(mode);
  }, []);

  const value = useMemo(
    () => ({ mode: selectedMode ?? systemMode, hydrated, setMode }),
    [hydrated, selectedMode, setMode, systemMode]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(AppThemeContext);

  if (!value) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }

  return value;
}
