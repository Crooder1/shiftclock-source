import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { APP_TAB_ICONS } from '@/components/app-tab-icons';
import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/theme/app-theme';

export default function AppTabs() {
  const { mode } = useAppTheme();
  const colors = Colors[mode];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={APP_TAB_ICONS.clock.ios} md={APP_TAB_ICONS.clock.android} />
        <NativeTabs.Trigger.Label>Clock</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={APP_TAB_ICONS.settings.ios} md={APP_TAB_ICONS.settings.android} />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="alarms">
        <NativeTabs.Trigger.Icon sf={APP_TAB_ICONS.alarms.ios} md={APP_TAB_ICONS.alarms.android} />
        <NativeTabs.Trigger.Label>Alarms</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
