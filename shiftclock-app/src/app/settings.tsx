import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppTheme } from '@/theme/app-theme';

function messageFromError(cause: unknown) {
  return cause instanceof Error ? cause.message : 'Unable to save theme preference';
}

export default function SettingsScreen() {
  const { mode, setMode } = useAppTheme();
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function changeMode(darkEnabled: boolean) {
    setError(null);
    setSaving(true);

    try {
      await setMode(darkEnabled ? 'dark' : 'light');
    } catch (cause) {
      setError(messageFromError(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: safeAreaInsets.top + Spacing.four,
          paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
        },
      ]}>
      <ThemedView style={styles.container}>
        <View style={styles.heading}>
          <ThemedText type="subtitle">App settings</ThemedText>
          <ThemedText themeColor="textSecondary">
            Choose how Shiftclock looks on this device.
          </ThemedText>
        </View>

        <ThemedView type="backgroundElement" style={styles.settingCard}>
          <View style={styles.settingCopy}>
            <ThemedText>Dark mode</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Use the dark appearance throughout the app.
            </ThemedText>
          </View>
          <Switch
            accessibilityLabel="Dark mode"
            disabled={saving}
            value={mode === 'dark'}
            onValueChange={(enabled) => void changeMode(enabled)}
            trackColor={{ false: theme.backgroundSelected, true: theme.textSecondary }}
            thumbColor={theme.background}
          />
        </ThemedView>

        {error ? (
          <ThemedText type="small" style={styles.errorText}>
            {error}
          </ThemedText>
        ) : null}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  heading: {
    gap: Spacing.one,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  settingCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  errorText: {
    color: '#C33B32',
  },
});
