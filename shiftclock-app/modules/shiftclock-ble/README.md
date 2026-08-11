# Shiftclock BLE

`shiftclock-ble` is a local Expo module scaffold for the Shiftclock app. It
defines the cross-platform boundary for a future BLE implementation; it does
not perform BLE operations yet.

## Public API

- `scan()`
- `stopScan()`
- `connect(deviceId)`
- `disconnect()`
- `writeAlarm(alarm)`
- `writeSettings(settings)`
- `addDeviceDiscoveredListener(listener)`
- `addConnectionStateListener(listener)`
- `addMessageListener(listener)`

The TypeScript entry point also exports the public record types and firmware
UUID, packet-size, offset, and range constants.

## Current behavior

Every native operation rejects with `ERR_NOT_IMPLEMENTED`. The native modules
declare events but do not emit simulated data. There are no BLE controllers,
coordinators, operation queues, retries, state machines, packet encoders, or
packet decoders in this scaffold.

Add future Android BLE code under `android/` and iOS CoreBluetooth code under
`ios/` while keeping the TypeScript API stable.

## Native builds

Custom native modules are unavailable in Expo Go. Generate or rebuild the
native development app after adding or changing native code:

```bash
npx expo prebuild
npx expo run:android
npx expo run:ios
```

The module config plugin adds the Android BLE manifest entries and the iOS
Bluetooth usage description during prebuild. Runtime permission requests are
part of the future BLE implementation and are not included here.
