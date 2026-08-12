import type { ShiftclockPlatform } from './ShiftclockBleController';

export type AndroidPermissionClient = {
  grantedResult: string;
  scanPermission: string;
  connectPermission: string;
  locationPermission: string;
  request(permission: string): Promise<string>;
  requestMultiple(permissions: string[]): Promise<Record<string, string>>;
};

export async function requestBlePermissions(
  platform: ShiftclockPlatform,
  androidApiLevel: number,
  client: AndroidPermissionClient
): Promise<void> {
  if (platform !== 'android') {
    return;
  }

  if (androidApiLevel >= 31) {
    const permissions = [client.scanPermission, client.connectPermission];
    const results = await client.requestMultiple(permissions);
    if (permissions.some((permission) => results[permission] !== client.grantedResult)) {
      throw new Error('Bluetooth permission was not granted');
    }
    return;
  }

  const result = await client.request(client.locationPermission);
  if (result !== client.grantedResult) {
    throw new Error('Bluetooth permission was not granted');
  }
}
