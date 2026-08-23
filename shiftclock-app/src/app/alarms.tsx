import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addAlarmListener,
  addConnectionStateListener,
  addTuneListener,
  cancelTunePreview,
  commitAlarms,
  createAlarm,
  modifyAlarm,
  playTune,
  reloadAlarmData,
  reloadAlarms,
  removeAlarm,
  type Alarm,
  type AlarmRecord,
  type ConnectionStateChangedEvent,
  type TuneMetadata,
} from '../../modules/shiftclock-ble';

import { formatAlarmTime, formatTuneLabel, formatWeekdays } from '@/alarms/alarm-form-utils';
import { ActionButton } from '@/components/action-button';
import { AlarmForm } from '@/components/alarm-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TuneSelect } from '@/components/tune-select';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function messageFromError(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Alarm operation failed';
}

export default function AlarmsScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const [connection, setConnection] = useState<ConnectionStateChangedEvent>({ state: 'disconnected', deviceId: null });
  const [alarms, setAlarms] = useState<readonly AlarmRecord[] | null>(null);
  const [tunes, setTunes] = useState<readonly TuneMetadata[] | null>(null);
  const [editing, setEditing] = useState<AlarmRecord | null>(null);
  const [testTuneId, setTestTuneId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [stoppingPreview, setStoppingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const connectionSubscription = addConnectionStateListener((event) => {
      setConnection(event);
      if (event.state !== 'connected') {
        setEditing(null);
        return;
      }
      setLoading(true);
      setError(null);
      void reloadAlarmData()
        .catch((cause) => { if (mounted) setError(messageFromError(cause)); })
        .finally(() => { if (mounted) setLoading(false); });
    });
    const alarmSubscription = addAlarmListener(setAlarms);
    const tuneSubscription = addTuneListener(setTunes);
    return () => {
      mounted = false;
      connectionSubscription.remove();
      alarmSubscription.remove();
      tuneSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (tunes === null || tunes.length === 0) {
      setTestTuneId(null);
      return;
    }
    setTestTuneId((current) =>
      current !== null && tunes.some((tune) => tune.id === current) ? current : tunes[0].id
    );
  }, [tunes]);

  const connected = connection.state === 'connected';
  const availableTunes = tunes ?? [];
  const ready = connected && alarms !== null && tunes !== null;
  const busy = mutating || previewing;

  async function submitAlarm(alarm: Alarm) {
    setMutating(true);
    setError(null);
    try {
      if (editing === null) await createAlarm(alarm);
      else {
        await modifyAlarm(editing.id, alarm);
        setEditing(null);
      }
    } finally {
      setMutating(false);
    }
  }

  function confirmRemove(alarm: AlarmRecord) {
    Alert.alert('Delete alarm?', `${formatAlarmTime(alarm.secondsOfDay)} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setMutating(true);
          setError(null);
          void removeAlarm(alarm.id)
            .then(() => setEditing(null))
            .catch((cause) => setError(messageFromError(cause)))
            .finally(() => setMutating(false));
        },
      },
    ]);
  }

  function tuneFor(id: number) {
    return availableTunes.find((tune) => tune.id === id);
  }

  async function commitPersistedAlarms() {
    if (!ready || loading || mutating) return;
    setMutating(true);
    setError(null);
    try {
      await commitAlarms();
    } catch (cause) {
      setError(messageFromError(cause));
    } finally {
      setMutating(false);
    }
  }

  async function reloadPersistedAlarms() {
    if (!ready || loading || mutating) return;
    setLoading(true);
    setError(null);
    try {
      await reloadAlarms();
      setEditing(null);
    } catch (cause) {
      setError(messageFromError(cause));
    } finally {
      setLoading(false);
    }
  }

  async function playSelectedTune() {
    if (!ready || testTuneId === null || loading || busy) return;
    setPreviewing(true);
    setError(null);
    try {
      await playTune(testTuneId);
    } catch (cause) {
      setError(messageFromError(cause));
    } finally {
      setPreviewing(false);
      setStoppingPreview(false);
    }
  }

  async function stopTunePreview() {
    if (!previewing || stoppingPreview) return;
    setStoppingPreview(true);
    setError(null);
    try {
      await cancelTunePreview();
    } catch (cause) {
      setError(messageFromError(cause));
      setStoppingPreview(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.scrollContent, { paddingTop: safeAreaInsets.top + Spacing.four, paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four }]}>
      <ThemedView style={styles.container}>
        <View style={styles.heading}>
          <ThemedText type="subtitle">Alarms</ThemedText>
          <ThemedText themeColor="textSecondary">Create and manage alarms on the connected clock.</ThemedText>
        </View>

        {!connected ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText themeColor="textSecondary">Connect to a Shiftclock to manage alarms.</ThemedText>
          </ThemedView>
        ) : loading && (alarms === null || tunes === null) ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText themeColor="textSecondary">Loading alarms and tunes…</ThemedText>
          </ThemedView>
        ) : null}

        {ready ? (
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <ThemedText type="smallBold">Existing alarms</ThemedText>
              <View style={styles.actions}>
                <ActionButton
                  accessibilityLabel="Commit alarms"
                  disabled={loading || busy}
                  label={mutating ? 'Committing…' : 'Commit'}
                  onPress={() => void commitPersistedAlarms()}
                />
                <ActionButton
                  accessibilityLabel="Reload alarms"
                  disabled={loading || busy}
                  label={loading ? 'Reloading…' : 'Reload'}
                  onPress={() => void reloadPersistedAlarms()}
                />
              </View>
            </View>
            {alarms.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.card}><ThemedText themeColor="textSecondary">No alarms configured.</ThemedText></ThemedView>
            ) : alarms.map((alarm) => {
              const tune = tuneFor(alarm.tuneId);
              return (
                <ThemedView key={alarm.id} type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold">{formatAlarmTime(alarm.secondsOfDay)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{formatWeekdays(alarm.daysActive)}</ThemedText>
                  <ThemedText type="small">{tune ? formatTuneLabel(tune) : `Tune ${alarm.tuneId}`}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Volume {alarm.volume} · Ramp {alarm.rampDurationSeconds} s · Auto-disable {alarm.autoDisableSeconds} s</ThemedText>
                  <View style={styles.actions}>
                    <ActionButton accessibilityLabel={`Edit alarm ${alarm.id}`} disabled={busy} label="Edit" onPress={() => setEditing(alarm)} />
                    <ActionButton accessibilityLabel={`Delete alarm ${alarm.id}`} disabled={busy} label="Delete" onPress={() => confirmRemove(alarm)} />
                  </View>
                </ThemedView>
              );
            })}
          </View>
        ) : null}

        <ThemedView type="backgroundElement" style={styles.card}>
          <AlarmForm disabled={!ready || busy} initialAlarm={editing} onCancel={() => setEditing(null)} onSubmit={submitAlarm} tunes={availableTunes} />
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Test a tune</ThemedText>
          <TuneSelect disabled={!ready || busy} label="Test tune" onChange={setTestTuneId} tunes={availableTunes} value={testTuneId} />
          <ActionButton
            accessibilityLabel={previewing ? 'Stop tune preview' : 'Play selected tune'}
            disabled={stoppingPreview || (!previewing && (!ready || testTuneId === null || loading || mutating))}
            label={stoppingPreview ? 'Stopping…' : previewing ? 'Stop tune' : 'Play tune'}
            onPress={() => void (previewing ? stopTunePreview() : playSelectedTune())}
          />
        </ThemedView>

        {error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingHorizontal: Spacing.four },
  container: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.four },
  heading: { gap: Spacing.one },
  section: { gap: Spacing.two },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.four },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  error: { color: '#C33B32' },
});
