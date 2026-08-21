import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

export type AppTabIcon = {
  ios: SFSymbol;
  android: AndroidSymbol;
  web: AndroidSymbol;
};

export const APP_TAB_ICONS = {
  clock: { ios: 'stopwatch', android: 'timer', web: 'timer' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  alarms: { ios: 'alarm', android: 'alarm', web: 'alarm' },
} as const satisfies Record<string, AppTabIcon>;
