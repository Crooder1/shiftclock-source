import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TimePart = 'hour' | 'minute' | 'second';

type AlarmTimeSelectProps = {
  disabled?: boolean;
  onChange: (secondsOfDay: number) => void;
  value: number;
};

const HOURS = Array.from({ length: 24 }, (_value, index) => index);
const MINUTES_AND_SECONDS = Array.from({ length: 60 }, (_value, index) => index);

function padTimePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function AlarmTimeSelect({ disabled = false, onChange, value }: AlarmTimeSelectProps) {
  const theme = useTheme();
  const [openPart, setOpenPart] = useState<TimePart | null>(null);
  const hour = Math.floor(value / 3600);
  const minute = Math.floor((value % 3600) / 60);
  const second = value % 60;

  useEffect(() => {
    if (disabled) setOpenPart(null);
  }, [disabled]);

  const parts: readonly {
    key: TimePart;
    label: string;
    options: readonly number[];
    selected: number;
  }[] = [
    { key: 'hour', label: 'Hours', options: HOURS, selected: hour },
    { key: 'minute', label: 'Minutes', options: MINUTES_AND_SECONDS, selected: minute },
    { key: 'second', label: 'Seconds', options: MINUTES_AND_SECONDS, selected: second },
  ];

  function select(part: TimePart, selected: number) {
    const nextHour = part === 'hour' ? selected : hour;
    const nextMinute = part === 'minute' ? selected : minute;
    const nextSecond = part === 'second' ? selected : second;
    onChange(nextHour * 3600 + nextMinute * 60 + nextSecond);
    setOpenPart(null);
  }

  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">Time</ThemedText>
      <View style={styles.row}>
        {parts.map((part) => {
          const open = !disabled && openPart === part.key;
          const selectedLabel = padTimePart(part.selected);

          return (
            <View key={part.key} style={styles.part}>
              <ThemedText type="small" themeColor="textSecondary">{part.label}</ThemedText>
              <Pressable
                accessibilityLabel={`Alarm ${part.key}: ${selectedLabel}`}
                accessibilityRole="button"
                accessibilityState={{ disabled, expanded: open }}
                disabled={disabled}
                onPress={() => setOpenPart((current) => current === part.key ? null : part.key)}
                style={({ pressed }) => [
                  styles.trigger,
                  { backgroundColor: theme.backgroundElement },
                  pressed && !disabled && styles.pressed,
                  disabled && styles.disabled,
                ]}>
                <ThemedText>{selectedLabel}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{open ? '▲' : '▼'}</ThemedText>
              </Pressable>

              {open && !disabled ? (
                <ThemedView type="backgroundElement" style={styles.options}>
                  <ScrollView nestedScrollEnabled style={styles.optionsScroll}>
                    {part.options.map((option) => {
                      const optionLabel = padTimePart(option);
                      return (
                        <Pressable
                          accessibilityLabel={`Set alarm ${part.key} to ${optionLabel}`}
                          accessibilityRole="button"
                          accessibilityState={{ selected: option === part.selected }}
                          key={option}
                          onPress={() => select(part.key, option)}
                          style={({ pressed }) => [
                            styles.option,
                            option === part.selected && {
                              backgroundColor: theme.backgroundSelected,
                            },
                            pressed && styles.pressed,
                          ]}>
                          <ThemedText>{optionLabel}</ThemedText>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </ThemedView>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  part: {
    flex: 1,
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
    gap: Spacing.one,
  },
  options: {
    maxHeight: 220,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  optionsScroll: {
    maxHeight: 220,
  },
  option: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.55,
  },
});
