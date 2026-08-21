import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { TuneMetadata } from '../../modules/shiftclock-ble';

import { formatTuneLabel } from '@/alarms/alarm-form-utils';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TuneSelectProps = {
  disabled?: boolean;
  label: string;
  onChange: (id: number) => void;
  tunes: readonly TuneMetadata[];
  value: number | null;
};

export function TuneSelect({ disabled, label, onChange, tunes, value }: TuneSelectProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selected = tunes.find((tune) => tune.id === value);
  const selectedLabel = selected === undefined ? 'Select a tune' : formatTuneLabel(selected);

  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Pressable
        accessibilityLabel={`${label}: ${selectedLabel}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled), expanded: open }}
        disabled={disabled}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [
          styles.trigger,
          { backgroundColor: theme.backgroundElement },
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ]}>
        <ThemedText>{selectedLabel}</ThemedText>
        <ThemedText themeColor="textSecondary">{open ? '▲' : '▼'}</ThemedText>
      </Pressable>

      {open && !disabled ? (
        <ThemedView type="backgroundElement" style={styles.options}>
          {tunes.map((tune) => {
            const tuneLabel = formatTuneLabel(tune);
            return (
              <Pressable
                accessibilityLabel={`Select ${tuneLabel}`}
                accessibilityRole="button"
                key={tune.id}
                onPress={() => {
                  onChange(tune.id);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.option,
                  tune.id === value && { backgroundColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="small">{tuneLabel}</ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  trigger: {
    minHeight: 44,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  options: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.55,
  },
});
