import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AutoConnectProvider, useAutoConnect } from '@/auto-connect/auto-connect';
import AppTabs from '@/components/app-tabs';
import { AppThemeProvider, useAppTheme } from '@/theme/app-theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <AutoConnectProvider>
        <ThemedRootLayout />
      </AutoConnectProvider>
    </AppThemeProvider>
  );
}

function ThemedRootLayout() {
  const { hydrated, mode } = useAppTheme();
  const { hydrated: autoConnectHydrated } = useAutoConnect();

  useEffect(() => {
    if (hydrated && autoConnectHydrated) {
      void SplashScreen.hideAsync();
    }
  }, [autoConnectHydrated, hydrated]);

  if (!hydrated || !autoConnectHydrated) {
    return null;
  }

  return (
    <NavigationThemeProvider value={mode === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <AppTabs />
    </NavigationThemeProvider>
  );
}
