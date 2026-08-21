import Slider from '@react-native-community/slider';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import {
  commitSettings,
  reloadSettings,
  SHIFTCLOCK_BLE_PROTOCOL,
  writeSettings,
  type ClockSettingsSnapshot,
} from '../../modules/shiftclock-ble';

import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ClockSettingWriteSampler } from '@/clock-settings/ClockSettingWriteSampler';

type ClockSettingsCardProps = {
  confirmedSettings: ClockSettingsSnapshot | null;
  enabled: boolean;
  onActionMessage: (message: string) => void;
};

const settingKeys: (keyof ClockSettingsSnapshot)[] = [
  'timezone',
  'brightness',
  'seconds',
  'movingDp',
  'volume',
  'clockForm',
  'meriIndicator',
];

const ids = SHIFTCLOCK_BLE_PROTOCOL.settings.ids;

const sliders = [
  { key: 'timezone', label: 'Timezone', id: ids.timezone, minimum: -12, maximum: 11 },
  { key: 'brightness', label: 'Brightness', id: ids.brightness, minimum: 0, maximum: 15 },
  {
    key: 'movingDp',
    label: 'Moving decimal point',
    id: ids.movingDp,
    minimum: 0,
    maximum: 2,
  },
  { key: 'volume', label: 'Volume', id: ids.volume, minimum: 0, maximum: 100 },
] as const;

const toggles = [
  { key: 'seconds', label: 'Seconds', id: ids.seconds },
  { key: 'clockForm', label: '12-hour clock', id: ids.clockForm },
  { key: 'meriIndicator', label: 'AM/PM indicator', id: ids.meriIndicator },
] as const;

function settingKey(id: number): keyof ClockSettingsSnapshot {
  if (id === ids.timezone) return 'timezone';
  if (id === ids.brightness) return 'brightness';
  if (id === ids.seconds) return 'seconds';
  if (id === ids.movingDp) return 'movingDp';
  if (id === ids.volume) return 'volume';
  if (id === ids.clockForm) return 'clockForm';
  if (id === ids.meriIndicator) return 'meriIndicator';
  throw new Error(`Invalid clock setting ID: ${id}`);
}

function readSetting(settings: ClockSettingsSnapshot, id: number): number {
  return settings[settingKey(id)];
}

function replaceSetting(
  settings: ClockSettingsSnapshot,
  id: number,
  value: number
): ClockSettingsSnapshot {
  return { ...settings, [settingKey(id)]: value };
}

function mergeConfirmed(
  current: ClockSettingsSnapshot | null,
  previous: ClockSettingsSnapshot | null,
  next: ClockSettingsSnapshot
): ClockSettingsSnapshot {
  if (current === null || previous === null) return next;

  const merged = { ...current };
  for (const key of settingKeys) {
    if (current[key] === previous[key]) merged[key] = next[key];
  }
  return merged;
}

function messageFromError(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'BLE operation failed';
}

export function ClockSettingsCard({
  confirmedSettings,
  enabled,
  onActionMessage,
}: ClockSettingsCardProps) {
  const theme = useTheme();
  const [localSettings, setLocalSettings] = useState<ClockSettingsSnapshot | null>(null);
  const [pendingCommand, setPendingCommand] = useState<'commit' | 'reload' | null>(null);
  const confirmedRef = useRef<ClockSettingsSnapshot | null>(null);
  const samplerRef = useRef<ClockSettingWriteSampler | null>(null);

  if (samplerRef.current === null) {
    samplerRef.current = new ClockSettingWriteSampler(writeSettings, (id, cause) => {
      const confirmed = confirmedRef.current;
      if (confirmed !== null) {
        setLocalSettings((current) =>
          current === null
            ? confirmed
            : replaceSetting(current, id, readSetting(confirmed, id))
        );
      }
      onActionMessage(messageFromError(cause));
    });
  }

  useEffect(() => {
    const previous = confirmedRef.current;
    confirmedRef.current = confirmedSettings;
    if (confirmedSettings === null) {
      samplerRef.current?.cancelPending();
      setLocalSettings(null);
      return;
    }
    setLocalSettings((current) => mergeConfirmed(current, previous, confirmedSettings));
  }, [confirmedSettings]);

  useEffect(() => () => samplerRef.current?.dispose(), []);

  function changeSetting(id: number, value: number, flush: boolean): void {
    if (!enabled || localSettings === null) return;
    setLocalSettings((current) =>
      current === null ? null : replaceSetting(current, id, value)
    );
    if (flush) {
      void samplerRef.current?.flush(id, value).catch(() => undefined);
    } else {
      samplerRef.current?.sample(id, value);
    }
  }

  async function commit(): Promise<void> {
    if (!enabled || pendingCommand !== null) return;
    setPendingCommand('commit');
    try {
      await samplerRef.current?.flushAll();
      await commitSettings();
      onActionMessage('Clock settings committed');
    } catch (cause) {
      onActionMessage(messageFromError(cause));
    } finally {
      setPendingCommand(null);
    }
  }

  async function reload(): Promise<void> {
    if (!enabled || pendingCommand !== null) return;
    setPendingCommand('reload');
    samplerRef.current?.cancelPending();
    try {
      const settings = await reloadSettings();
      confirmedRef.current = settings;
      setLocalSettings(settings);
      onActionMessage('Clock settings reloaded');
    } catch (cause) {
      onActionMessage(messageFromError(cause));
    } finally {
      setPendingCommand(null);
    }
  }

  const controlsEnabled = enabled && pendingCommand === null;

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Clock settings</ThemedText>
      <ThemedView
        testID="clock-settings-section"
        type="backgroundElement"
        style={[styles.card, { opacity: enabled ? 1 : 0.45 }]}>
        {!enabled ? (
          <ThemedText type="small" themeColor="textSecondary">
            Connect to a clock to edit its settings.
          </ThemedText>
        ) : null}

        {sliders.map((control) => (
          <View key={control.key} style={styles.control}>
            <ThemedText type="small">
              {control.label}: {localSettings?.[control.key] ?? 0}
            </ThemedText>
            <Slider
              accessible
              accessibilityLabel={control.label}
              accessibilityRole="adjustable"
              accessibilityState={{ disabled: !controlsEnabled }}
              disabled={!controlsEnabled}
              maximumTrackTintColor={theme.backgroundSelected}
              maximumValue={control.maximum}
              minimumTrackTintColor={theme.text}
              minimumValue={control.minimum}
              onSlidingComplete={(value) => changeSetting(control.id, value, true)}
              onValueChange={(value) => changeSetting(control.id, value, false)}
              step={1}
              thumbTintColor={theme.text}
              value={localSettings?.[control.key] ?? 0}
            />
          </View>
        ))}

        {toggles.map((control) => (
          <View key={control.key} style={styles.toggleRow}>
            <ThemedText type="small">{control.label}</ThemedText>
            <Switch
              accessibilityLabel={control.label}
              accessibilityState={{ disabled: !controlsEnabled }}
              disabled={!controlsEnabled}
              onValueChange={(value) => changeSetting(control.id, value ? 1 : 0, true)}
              value={(localSettings?.[control.key] ?? 0) === 1}
            />
          </View>
        ))}

        <View style={styles.actions}>
          <ActionButton
            accessibilityLabel="Commit clock settings"
            disabled={!controlsEnabled}
            label={pendingCommand === 'commit' ? 'Committing…' : 'Commit'}
            onPress={() => void commit()}
          />
          <ActionButton
            accessibilityLabel="Reload clock settings"
            disabled={!controlsEnabled}
            label={pendingCommand === 'reload' ? 'Reloading…' : 'Reload'}
            onPress={() => void reload()}
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
  control: {
    gap: Spacing.one,
  },
  toggleRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
