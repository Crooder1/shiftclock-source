import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { Alarm, AlarmRecord, TuneMetadata } from '../../modules/shiftclock-ble';

import { AlarmTimeSelect } from '@/components/alarm-time-select';
import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { TuneSelect } from '@/components/tune-select';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

type AlarmFormProps = {
  disabled?: boolean;
  initialAlarm?: AlarmRecord | null;
  onCancel?: () => void;
  onSubmit: (alarm: Alarm) => Promise<void>;
  tunes: readonly TuneMetadata[];
};

function parseInteger(value: string, label: string, minimum: number, maximum: number): number {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be a whole number`);
  const parsed = Number(value);
  if (parsed < minimum || parsed > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}

export function AlarmForm({ disabled, initialAlarm = null, onCancel, onSubmit, tunes }: AlarmFormProps) {
  const theme = useTheme();
  const [secondsOfDay, setSecondsOfDay] = useState(7 * 3600);
  const [daysActive, setDaysActive] = useState(0x3e);
  const [tuneId, setTuneId] = useState<number | null>(tunes[0]?.id ?? null);
  const [ramp, setRamp] = useState('0');
  const [volume, setVolume] = useState('100');
  const [autoDisable, setAutoDisable] = useState('300');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAlarm !== null) {
      setSecondsOfDay(initialAlarm.secondsOfDay);
      setDaysActive(initialAlarm.daysActive);
      setTuneId(initialAlarm.tuneId);
      setRamp(String(initialAlarm.rampDurationSeconds));
      setVolume(String(initialAlarm.volume));
      setAutoDisable(String(initialAlarm.autoDisableSeconds));
      setError(null);
      return;
    }
    setTuneId((current) =>
      current !== null && tunes.some((tune) => tune.id === current)
        ? current
        : (tunes[0]?.id ?? null)
    );
  }, [initialAlarm, tunes]);

  function resetCreateForm() {
    setSecondsOfDay(7 * 3600);
    setDaysActive(0x3e);
    setTuneId(tunes[0]?.id ?? null);
    setRamp('0');
    setVolume('100');
    setAutoDisable('300');
  }

  async function submit() {
    setError(null);
    try {
      if (daysActive === 0) throw new Error('Select at least one weekday');
      if (tuneId === null || !tunes.some((tune) => tune.id === tuneId)) {
        throw new Error('Select an available tune');
      }
      const alarm: Alarm = {
        daysActive,
        secondsOfDay,
        tuneId,
        rampDurationSeconds: parseInteger(ramp, 'Ramp duration', 0, 600),
        volume: parseInteger(volume, 'Volume', 0, 100),
        autoDisableSeconds: parseInteger(autoDisable, 'Auto-disable', 0, 3600),
      };
      setSubmitting(true);
      await onSubmit(alarm);
      if (initialAlarm === null) resetCreateForm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save alarm');
    } finally {
      setSubmitting(false);
    }
  }

  const formDisabled = Boolean(disabled || submitting);

  return (
    <View style={styles.form}>
      <ThemedText type="smallBold">{initialAlarm === null ? 'Create alarm' : 'Edit alarm'}</ThemedText>
      <AlarmTimeSelect
        disabled={formDisabled}
        onChange={setSecondsOfDay}
        value={secondsOfDay}
      />

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">Active days</ThemedText>
        <View style={styles.days}>
          {DAYS.map((day, index) => {
            const selected = (daysActive & (1 << index)) !== 0;
            return (
              <Pressable
                accessibilityLabel={day}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled: formDisabled }}
                disabled={formDisabled}
                key={day}
                onPress={() => setDaysActive((current) => current ^ (1 << index))}
                style={[
                  styles.day,
                  { backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement },
                ]}>
                <ThemedText type="small">{day}</ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TuneSelect
        disabled={formDisabled || tunes.length === 0}
        label="Alarm tune"
        onChange={setTuneId}
        tunes={tunes}
        value={tuneId}
      />

      <View style={styles.numericFields}>
        <NumericField label="Ramp duration (seconds)" value={ramp} onChange={setRamp} disabled={formDisabled} />
        <NumericField label="Volume" value={volume} onChange={setVolume} disabled={formDisabled} />
        <NumericField label="Auto-disable (seconds)" value={autoDisable} onChange={setAutoDisable} disabled={formDisabled} />
      </View>

      {error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}

      <View style={styles.actions}>
        {initialAlarm !== null && onCancel ? (
          <ActionButton accessibilityLabel="Cancel editing alarm" disabled={formDisabled} label="Cancel" onPress={onCancel} />
        ) : null}
        <ActionButton
          accessibilityLabel={initialAlarm === null ? 'Create alarm' : 'Save alarm'}
          disabled={formDisabled || tunes.length === 0}
          label={submitting ? 'Saving…' : initialAlarm === null ? 'Create' : 'Save'}
          onPress={() => void submit()}
        />
      </View>
    </View>
  );
}

function NumericField({ disabled, label, onChange, value }: { disabled: boolean; label: string; onChange: (value: string) => void; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        editable={!disabled}
        inputMode="numeric"
        onChangeText={onChange}
        style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three },
  field: { gap: Spacing.one },
  input: { minHeight: 44, borderRadius: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  day: { minHeight: 40, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Spacing.two, paddingHorizontal: Spacing.two },
  numericFields: { gap: Spacing.two },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  error: { color: '#C33B32' },
});
