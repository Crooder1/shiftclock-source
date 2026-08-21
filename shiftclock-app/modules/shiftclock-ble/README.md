# Shiftclock BLE

`shiftclock-ble` is the app-owned TypeScript boundary between the Shiftclock UI,
the firmware wire protocol, and `react-native-ble-manager`.

## Public API

- `scan()`
- `stopScan()`
- `connect(deviceId)`
- `disconnect()`
- `writeAlarm(alarm)`
- `createAlarm(alarm)`
- `modifyAlarm(id, alarm)`
- `removeAlarm(id)`
- `commitAlarms()`
- `reloadAlarms()`
- `reloadAlarmData()`
- `writeSettings(settings)`
- `commitSettings()`
- `reloadSettings()`
- `addDeviceDiscoveredListener(listener)`
- `addConnectionStateListener(listener)`
- `addMessageListener(listener)`
- `addSettingsListener(listener)`
- `addAlarmListener(listener)`
- `addTuneListener(listener)`

The TypeScript entry point also exports the public record types and firmware
UUID, packet-size, offset, and range constants.

## Behavior

- Scans for advertisements containing the Clock service UUID.
- Connects to one clock and discovers the required service and characteristics.
- Requests an ATT MTU of at least 46 bytes on Android.
- Enables notifications for the 43-byte Message characteristic.
- Reads and validates the eight-byte Settings snapshot before reporting a
  connection ready.
- Replays the active connection's confirmed Settings, Alarm, and Tune snapshots
  to newly registered listeners.
- Enumerates Tune metadata (ID, name, and loop duration) and Alarm records on
  demand through `reloadAlarmData`.
- Creates, modifies, and removes Alarms with acknowledged 13-byte commands,
  then refreshes the complete Alarm snapshot. `writeAlarm` remains an Add alias.
- Commits Alarms to firmware persistence and reloads persisted Alarms through
  acknowledged 13-byte commands; Reload republishes the resulting snapshot.
- Rejects Alarm persistence operations immediately when firmware reports a
  persistence failure instead of waiting for the acknowledgement timeout.
- Sends Alarm, Tune-selection, and Settings packets with response in one ordered
  stream and waits up to one second for `INFO_OPERATION_SUCCEEDED` after each
  write.
- Encodes every Settings ID and value as a signed 8-bit two's-complement byte.
  Sends Commit (`-1, -1` / `0xFFFF`) and Reload (`-1, -2` / `0xFFFE`); Reload
  rereads Settings only after acknowledgement.
- Decodes valid firmware Message packets and ignores malformed notifications.
- Reports connection state only after the Clock service is ready.
- Does not expose Tune audio bytes or a Tune playback command.

Android runtime permissions are requested by the TypeScript adapter. Native
manifest and Info.plist configuration is owned by the
`react-native-ble-manager` Expo config plugin.

## Native builds

BLE native modules are unavailable in Expo Go. Regenerate or rebuild the native
app after installing or updating `react-native-ble-manager` or changing its
plugin configuration:

```bash
npx expo prebuild
npx expo run:android
npx expo run:ios
```
