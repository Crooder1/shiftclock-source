# Shiftclock BLE

`shiftclock-ble` is the app-owned TypeScript boundary between the Shiftclock UI,
the firmware wire protocol, and `react-native-ble-manager`.

## Public API

- `scan()`
- `stopScan()`
- `connect(deviceId)`
- `disconnect()`
- `writeAlarm(alarm)`
- `writeSettings(settings)`
- `commitSettings()`
- `reloadSettings()`
- `addDeviceDiscoveredListener(listener)`
- `addConnectionStateListener(listener)`
- `addMessageListener(listener)`
- `addSettingsListener(listener)`

The TypeScript entry point also exports the public record types and firmware
UUID, packet-size, offset, and range constants.

## Behavior

- Scans for advertisements containing the Clock service UUID.
- Connects to one clock and discovers the required service and characteristics.
- Requests an ATT MTU of at least 46 bytes on Android.
- Enables notifications for the 43-byte Message characteristic.
- Reads and validates the eight-byte Settings snapshot before reporting a
  connection ready.
- Replays the active connection's confirmed settings through
  `addSettingsListener`.
- Encodes Alarm and Settings packets and sends them with response in one ordered
  write stream.
- Waits up to one second for `INFO_OPERATION_SUCCEEDED` after every Settings
  write.
- Sends Commit (`0xFFFF`) and Reload (`0xFFFE`); Reload rereads Settings only
  after acknowledgement.
- Decodes valid firmware Message packets and ignores malformed notifications.
- Reports connection state only after the Clock service is ready.

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
