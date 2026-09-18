import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import {
  clearWifiCredentials,
  commitWifiCredentials,
  SHIFTCLOCK_BLE_PROTOCOL,
} from '../../modules/shiftclock-ble';

import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type WifiCredentialsCardProps = {
  enabled: boolean;
  onActionMessage: (message: string) => void;
};

function messageFromError(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'BLE operation failed';
}

function validationMessage(ssid: string, password: string): string | null {
  const maximumTextLength = SHIFTCLOCK_BLE_PROTOCOL.wifi.maximumTextLength;
  if (ssid.length === 0) return 'WiFi SSID is required.';
  if (Array.from(ssid).length > maximumTextLength) {
    return `WiFi SSID must be ${maximumTextLength} characters or fewer.`;
  }
  if (Array.from(password).length > maximumTextLength) {
    return `WiFi password must be ${maximumTextLength} characters or fewer.`;
  }
  return null;
}

export function WifiCredentialsCard({ enabled, onActionMessage }: WifiCredentialsCardProps) {
  const theme = useTheme();
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [pendingCommand, setPendingCommand] = useState<'commit' | 'clear' | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const controlsEnabled = enabled && pendingCommand === null;

  async function commit(): Promise<void> {
    if (!controlsEnabled) return;
    const error = validationMessage(ssid, password);
    setValidationError(error);
    if (error !== null) return;

    const credentials = { ssid, password };
    setPassword('');
    setPendingCommand('commit');
    try {
      await commitWifiCredentials(credentials);
      onActionMessage('WiFi credentials committed');
    } catch (cause) {
      onActionMessage(messageFromError(cause));
    } finally {
      setPendingCommand(null);
    }
  }

  async function clear(): Promise<void> {
    if (!controlsEnabled) return;
    setValidationError(null);
    setPendingCommand('clear');
    try {
      await clearWifiCredentials();
      setSsid('');
      setPassword('');
      onActionMessage('WiFi credentials cleared');
    } catch (cause) {
      onActionMessage(messageFromError(cause));
    } finally {
      setPendingCommand(null);
    }
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">WiFi credentials</ThemedText>
      <ThemedView
        testID="wifi-credentials-section"
        type="backgroundElement"
        style={[styles.card, { opacity: enabled ? 1 : 0.45 }]}>
        {!enabled ? (
          <ThemedText type="small" themeColor="textSecondary">
            Connect to a clock to manage its WiFi credentials.
          </ThemedText>
        ) : null}

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            WiFi SSID
          </ThemedText>
          <TextInput
            accessibilityLabel="WiFi SSID"
            autoCapitalize="none"
            autoCorrect={false}
            editable={controlsEnabled}
            onChangeText={(value) => {
              setSsid(value);
              setValidationError(null);
            }}
            placeholder="Network name"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry={false}
            style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
            value={ssid}
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            WiFi password
          </ThemedText>
          <TextInput
            accessibilityLabel="WiFi password"
            autoCapitalize="none"
            autoCorrect={false}
            editable={controlsEnabled}
            onChangeText={(value) => {
              setPassword(value);
              setValidationError(null);
            }}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
            value={password}
          />
        </View>

        {validationError ? (
          <ThemedText type="small" style={styles.error}>
            {validationError}
          </ThemedText>
        ) : null}

        <View style={styles.actions}>
          <ActionButton
            accessibilityLabel="Commit WiFi credentials"
            disabled={!controlsEnabled}
            label={pendingCommand === 'commit' ? 'Committing…' : 'Commit'}
            onPress={() => void commit()}
          />
          <ActionButton
            accessibilityLabel="Clear WiFi credentials"
            disabled={!controlsEnabled}
            label={pendingCommand === 'clear' ? 'Clearing…' : 'Clear'}
            onPress={() => void clear()}
          />
        </View>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 44,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  error: {
    color: '#C33B32',
  },
});
