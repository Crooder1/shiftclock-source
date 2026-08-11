const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

const DEFAULT_BLUETOOTH_PERMISSION =
  'Allow Shiftclock to find and connect to your clock.';

function upsertAndroidEntry(entries, name, attributes = {}) {
  const existing = entries.find(
    (entry) => entry.$?.['android:name'] === name
  );

  if (existing) {
    existing.$ = {
      ...existing.$,
      'android:name': name,
      ...attributes,
    };
    return entries;
  }

  return [
    ...entries,
    {
      $: {
        'android:name': name,
        ...attributes,
      },
    },
  ];
}
                                        
function withShiftclockBleAndroidManifest(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const manifest = androidConfig.modResults.manifest;
    let permissions = manifest['uses-permission'] ?? [];

    permissions = upsertAndroidEntry(
      permissions,
      'android.permission.BLUETOOTH',
      { 'android:maxSdkVersion': '30' }
    );
    permissions = upsertAndroidEntry(
      permissions,
      'android.permission.BLUETOOTH_ADMIN',
      { 'android:maxSdkVersion': '30' }
    );
    permissions = upsertAndroidEntry(
      permissions,
      'android.permission.ACCESS_FINE_LOCATION',
      { 'android:maxSdkVersion': '30' }
    );
    permissions = upsertAndroidEntry(
      permissions,
      'android.permission.BLUETOOTH_SCAN',
      { 'android:usesPermissionFlags': 'neverForLocation' }
    );
    permissions = upsertAndroidEntry(
      permissions,
      'android.permission.BLUETOOTH_CONNECT'
    );

    manifest['uses-permission'] = permissions;
    manifest['uses-feature'] = upsertAndroidEntry(
      manifest['uses-feature'] ?? [],
      'android.hardware.bluetooth_le',
      { 'android:required': 'true' }
    );

    return androidConfig;
  });
}

function withShiftclockBleInfoPlist(config, bluetoothPermission) {
  return withInfoPlist(config, (iosConfig) => {
    iosConfig.modResults.NSBluetoothAlwaysUsageDescription ??=
      bluetoothPermission;
    return iosConfig;
  });
}

function withShiftclockBle(config, options = {}) {
  const bluetoothPermission =
    options.bluetoothPermission ?? DEFAULT_BLUETOOTH_PERMISSION;

  config = withShiftclockBleAndroidManifest(config);
  config = withShiftclockBleInfoPlist(config, bluetoothPermission);

  return config;
}

module.exports = withShiftclockBle;
