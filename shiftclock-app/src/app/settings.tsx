import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAutoConnect } from '@/auto-connect/auto-connect';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppTheme } from '@/theme/app-theme';

function messageFromError(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export default function SettingsScreen() {
  const { mode, setMode } = useAppTheme();
  const {
    enabled: autoConnectEnabled,
    error: autoConnectError,
    hydrated: autoConnectHydrated,
    setEnabled: setAutoConnectEnabled,
    target: autoConnectTarget,
  } = useAutoConnect();
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingAutoConnect, setSavingAutoConnect] = useState(false);
  const displayedError = error ?? autoConnectError;

  async function changeMode(darkEnabled: boolean) {
    setError(null);
    setSaving(true);

    try {
      await setMode(darkEnabled ? 'dark' : 'light');
    } catch (cause) {
      setError(messageFromError(cause, 'Unable to save theme preference'));
    } finally {
      setSaving(false);
    }
  }

  async function changeAutoConnect(enabled: boolean) {
    setError(null);
    setSavingAutoConnect(true);

    try {
      await setAutoConnectEnabled(enabled);
    } catch (cause) {
      setError(messageFromError(cause, 'Unable to save Auto-Connect preference'));
    } finally {
      setSavingAutoConnect(false);
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
            Choose how Shiftclock looks and connects on this device.
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

        <ThemedView type="backgroundElement" style={styles.settingCard}>
          <View style={styles.settingCopy}>
            <ThemedText>Auto-Connect</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Connect to the saved clock when it appears during startup or a manual scan.
            </ThemedText>
            {autoConnectTarget ? (
              <View style={styles.savedTarget}>
                <ThemedText type="smallBold">
                  {autoConnectTarget.name ?? 'Unnamed Shiftclock'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {autoConnectTarget.id}
                </ThemedText>
              </View>
            ) : null}
          </View>
          <Switch
            accessibilityLabel="Auto-Connect"
            accessibilityHint="Connects to the saved clock when it is discovered during startup or a manual scan."
            disabled={savingAutoConnect || !autoConnectHydrated}
            value={autoConnectEnabled}
            onValueChange={(enabled) => void changeAutoConnect(enabled)}
            trackColor={{ false: theme.backgroundSelected, true: theme.textSecondary }}
            thumbColor={theme.background}
          />
        </ThemedView>

        {displayedError ? (
          <ThemedText
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            type="small"
            style={styles.errorText}>
            {displayedError}
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
  savedTarget: {
    gap: Spacing.half,
    paddingTop: Spacing.one,
  },
  errorText: {
    color: '#C33B32',
  },
});
