import { requestBlePermissions, type AndroidPermissionClient } from '../ShiftclockBle.permissions';

function createPermissionClient() {
  const client: AndroidPermissionClient = {
    grantedResult: 'granted',
    scanPermission: 'android.permission.BLUETOOTH_SCAN',
    connectPermission: 'android.permission.BLUETOOTH_CONNECT',
    locationPermission: 'android.permission.ACCESS_FINE_LOCATION',
    request: jest.fn().mockResolvedValue('granted'),
    requestMultiple: jest.fn().mockResolvedValue({
      'android.permission.BLUETOOTH_SCAN': 'granted',
      'android.permission.BLUETOOTH_CONNECT': 'granted',
    }),
  };
  return client;
}

describe('requestBlePermissions', () => {
  test('does not request Android permissions on iOS', async () => {
    const client = createPermissionClient();

    await requestBlePermissions('ios', 0, client);

    expect(client.request).not.toHaveBeenCalled();
    expect(client.requestMultiple).not.toHaveBeenCalled();
  });

  test('requires Scan and Connect permission on Android 12 and newer', async () => {
    const client = createPermissionClient();

    await requestBlePermissions('android', 31, client);

    expect(client.requestMultiple).toHaveBeenCalledWith([
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
    ]);
  });

  test('requires location permission on older Android versions', async () => {
    const client = createPermissionClient();

    await requestBlePermissions('android', 30, client);

    expect(client.request).toHaveBeenCalledWith('android.permission.ACCESS_FINE_LOCATION');
  });

  test('rejects when any required Android permission is denied', async () => {
    const client = createPermissionClient();
    jest.mocked(client.requestMultiple).mockResolvedValue({
      'android.permission.BLUETOOTH_SCAN': 'denied',
      'android.permission.BLUETOOTH_CONNECT': 'granted',
    });

    await expect(requestBlePermissions('android', 36, client)).rejects.toThrow(
      'Bluetooth permission was not granted'
    );
  });

  test('rejects when legacy Android location permission is denied', async () => {
    const client = createPermissionClient();
    jest.mocked(client.request).mockResolvedValue('never_ask_again');

    await expect(requestBlePermissions('android', 30, client)).rejects.toThrow(
      'Bluetooth permission was not granted'
    );
  });
});
