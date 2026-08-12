import { SHIFTCLOCK_BLE_PROTOCOL, SHIFTCLOCK_BLE_UUIDS } from './ShiftclockBle.constants';
import {
  decodeMessage,
  decodeSettings,
  encodeAlarm,
  encodeSettings,
} from './ShiftclockBle.protocol';
import type {
  Alarm,
  ClockSettings,
  ClockSettingsSnapshot,
  ConnectionStateChangedEvent,
  FirmwareMessage,
  ShiftclockDevice,
} from './ShiftclockBle.types';

export type BleManagerSubscription = { remove(): void };

type BlePeripheral = {
  id: string;
  name?: string;
  rssi: number;
  advertising: { localName?: string };
};

type BlePeripheralInfo = BlePeripheral & {
  services?: { uuid: string }[];
  characteristics?: { service: string; characteristic: string }[];
};

type BleDisconnectEvent = { peripheral: string };

type BleNotificationEvent = {
  peripheral: string;
  service: string;
  characteristic: string;
  value: number[];
};

type BleStateEvent = { state: string };

export type BleManagerClient = {
  start(options?: { showAlert?: boolean }): Promise<void>;
  checkState(): Promise<string>;
  scan(options: {
    serviceUUIDs: string[];
    seconds: number;
    allowDuplicates: boolean;
  }): Promise<void>;
  stopScan(): Promise<void>;
  isScanning(): Promise<boolean>;
  connect(peripheralId: string): Promise<void>;
  disconnect(peripheralId: string, force?: boolean): Promise<void>;
  retrieveServices(peripheralId: string, serviceUUIDs?: string[]): Promise<BlePeripheralInfo>;
  requestMTU(peripheralId: string, mtu: number): Promise<number>;
  read(
    peripheralId: string,
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<number[]>;
  startNotification(
    peripheralId: string,
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<void>;
  stopNotification(
    peripheralId: string,
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<void>;
  write(
    peripheralId: string,
    serviceUUID: string,
    characteristicUUID: string,
    data: number[],
    maxByteSize?: number
  ): Promise<void>;
  onDiscoverPeripheral(listener: (peripheral: BlePeripheral) => void): BleManagerSubscription;
  onDisconnectPeripheral(listener: (event: BleDisconnectEvent) => void): BleManagerSubscription;
  onDidUpdateValueForCharacteristic(
    listener: (event: BleNotificationEvent) => void
  ): BleManagerSubscription;
  onDidUpdateState(listener: (event: BleStateEvent) => void): BleManagerSubscription;
};

export type ShiftclockPlatform = 'android' | 'ios' | 'other';
export type PermissionRequester = () => Promise<void>;
export type ShiftclockBleSubscription = { remove(): void };

type Listener<T> = (value: T) => void;

const CONNECT_TIMEOUT_MS = 15_000;
const BLE_STATE_TIMEOUT_MS = 5_000;
const SETTINGS_ACKNOWLEDGEMENT_TIMEOUT_MS = 1_000;

type SettingsAcknowledgement = {
  deviceId: string;
  connectionGeneration: number;
  resolve: () => void;
  reject: (cause: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

function isTransientBleState(state: string): boolean {
  return state === 'unknown' || state === 'resetting' || state === 'turning_on';
}

function normalizeUuid(uuid: string): string {
  return uuid.toLowerCase();
}

function addListener<T>(listeners: Set<Listener<T>>, listener: Listener<T>): ShiftclockBleSubscription {
  listeners.add(listener);
  return {
    remove() {
      listeners.delete(listener);
    },
  };
}

export class ShiftclockBleController {
  private readonly deviceListeners = new Set<Listener<ShiftclockDevice>>();
  private readonly connectionListeners = new Set<Listener<ConnectionStateChangedEvent>>();
  private readonly messageListeners = new Set<Listener<FirmwareMessage>>();
  private readonly settingsListeners = new Set<Listener<ClockSettingsSnapshot | null>>();
  private readonly bleStateWaiters = new Set<Listener<string>>();
  private startPromise: Promise<void> | null = null;
  private listenersInstalled = false;
  private bleState: string | null = null;
  private scanGeneration = 0;
  private scanPromise: Promise<void> | null = null;
  private pendingDeviceId: string | null = null;
  private nativeConnectingDeviceId: string | null = null;
  private activeDeviceId: string | null = null;
  private currentConnection: ConnectionStateChangedEvent = {
    state: 'disconnected',
    deviceId: null,
  };
  private currentSettings: ClockSettingsSnapshot | null = null;
  private connectionGeneration = 0;
  private writeQueue: Promise<void> = Promise.resolve();
  private settingsAcknowledgement: SettingsAcknowledgement | null = null;

  constructor(
    private readonly manager: BleManagerClient,
    private readonly platform: ShiftclockPlatform,
    private readonly requestPermissions: PermissionRequester
  ) {}

  addDeviceDiscoveredListener(listener: Listener<ShiftclockDevice>): ShiftclockBleSubscription {
    return addListener(this.deviceListeners, listener);
  }

  addConnectionStateListener(
    listener: Listener<ConnectionStateChangedEvent>
  ): ShiftclockBleSubscription {
    const listenerSubscription = addListener(this.connectionListeners, listener);
    listener(this.currentConnection);
    return listenerSubscription;
  }

  addMessageListener(listener: Listener<FirmwareMessage>): ShiftclockBleSubscription {
    return addListener(this.messageListeners, listener);
  }

  addSettingsListener(
    listener: Listener<ClockSettingsSnapshot | null>
  ): ShiftclockBleSubscription {
    const subscription = addListener(this.settingsListeners, listener);
    listener(this.currentSettings);
    return subscription;
  }

  async scan(): Promise<void> {
    const generation = ++this.scanGeneration;
    const operation = (async () => {
      await this.prepareBle();
      if (generation !== this.scanGeneration) {
        return;
      }

      await this.manager.scan({
        serviceUUIDs: [SHIFTCLOCK_BLE_UUIDS.clockService],
        seconds: 10,
        allowDuplicates: true,
      });
    })();
    this.scanPromise = operation;

    try {
      await operation;
    } finally {
      if (this.scanPromise === operation) {
        this.scanPromise = null;
      }
    }
  }

  async stopScan(): Promise<void> {
    this.scanGeneration += 1;
    await this.scanPromise?.catch(() => undefined);

    if (this.startPromise === null) {
      return;
    }

    await this.startPromise.catch(() => undefined);
    if (await this.manager.isScanning()) {
      await this.manager.stopScan();
    }
  }

  async connect(deviceId: string): Promise<void> {
    if (!deviceId.trim()) {
      throw new Error('A device ID is required');
    }

    if (
      this.activeDeviceId === deviceId &&
      this.currentConnection.state === 'connected'
    ) {
      return;
    }
    if (this.activeDeviceId !== null || this.pendingDeviceId !== null) {
      await this.disconnect();
    }

    const generation = ++this.connectionGeneration;
    this.emitSettings(null);
    this.pendingDeviceId = deviceId;
    this.emitConnection({ state: 'connecting', deviceId });
    let nativeConnectionStarted = false;

    try {
      await this.prepareBle();
      this.assertConnectionOwnership(generation, deviceId);
      await this.stopScan();
      this.assertConnectionOwnership(generation, deviceId);

      nativeConnectionStarted = true;
      this.nativeConnectingDeviceId = deviceId;
      await this.connectWithTimeout(deviceId);
      this.assertConnectionOwnership(generation, deviceId);

      const peripheral = await this.manager.retrieveServices(deviceId, [
        SHIFTCLOCK_BLE_UUIDS.clockService,
      ]);
      this.assertClockService(peripheral);

      if (this.platform === 'android') {
        const mtu = await this.manager.requestMTU(
          deviceId,
          SHIFTCLOCK_BLE_PROTOCOL.message.packetSize + 3
        );
        if (mtu < SHIFTCLOCK_BLE_PROTOCOL.message.packetSize + 3) {
          throw new Error(`Negotiated ATT MTU ${mtu} is too small for Shiftclock messages`);
        }
      }

      await this.manager.startNotification(
        deviceId,
        SHIFTCLOCK_BLE_UUIDS.clockService,
        SHIFTCLOCK_BLE_UUIDS.messageCharacteristic
      );

      this.assertConnectionOwnership(generation, deviceId);
      const settings = await this.readSettings(deviceId);
      this.assertConnectionOwnership(generation, deviceId);
      this.emitSettings(settings);
      this.pendingDeviceId = null;
      this.nativeConnectingDeviceId = null;
      this.activeDeviceId = deviceId;
      this.emitConnection({ state: 'connected', deviceId });
    } catch (cause) {
      if (generation === this.connectionGeneration) {
        this.changeConnectionGeneration();
      }

      const shouldDisconnectNative =
        nativeConnectionStarted &&
        (this.nativeConnectingDeviceId === deviceId || this.activeDeviceId === deviceId);
      const nativeDisconnected = shouldDisconnectNative
        ? await this.manager.disconnect(deviceId).then(
            () => true,
            () => false
          )
        : true;
      if (nativeDisconnected) {
        this.emitSettings(null);
        if (this.pendingDeviceId === deviceId) {
          this.pendingDeviceId = null;
        }
        if (this.activeDeviceId === deviceId) {
          this.activeDeviceId = null;
        }
        if (this.nativeConnectingDeviceId === deviceId) {
          this.nativeConnectingDeviceId = null;
        }
        if (
          this.currentConnection.deviceId === deviceId &&
          this.currentConnection.state !== 'disconnected'
        ) {
          this.emitConnection({ state: 'disconnected', deviceId });
        }
      }
      throw cause;
    }
  }

  async disconnect(): Promise<void> {
    const deviceId = this.activeDeviceId ?? this.pendingDeviceId;
    if (deviceId === null) {
      return;
    }

    const wasReady = this.activeDeviceId === deviceId;
    const needsNativeDisconnect =
      wasReady || this.nativeConnectingDeviceId === deviceId;
    this.changeConnectionGeneration();
    this.emitConnection({ state: 'disconnecting', deviceId });
    if (!needsNativeDisconnect) {
      this.pendingDeviceId = null;
      this.emitSettings(null);
      this.emitConnection({ state: 'disconnected', deviceId });
      return;
    }

    if (wasReady) {
      await this.manager
        .stopNotification(
          deviceId,
          SHIFTCLOCK_BLE_UUIDS.clockService,
          SHIFTCLOCK_BLE_UUIDS.messageCharacteristic
        )
        .catch(() => undefined);
    }

    try {
      await this.manager.disconnect(deviceId);
    } catch (cause) {
      const stillOwned =
        this.activeDeviceId === deviceId || this.pendingDeviceId === deviceId;
      if (stillOwned) {
        let notificationsRestored = true;
        if (wasReady) {
          notificationsRestored = await this.manager
            .startNotification(
              deviceId,
              SHIFTCLOCK_BLE_UUIDS.clockService,
              SHIFTCLOCK_BLE_UUIDS.messageCharacteristic
            )
            .then(
              () => true,
              () => false
            );
        }
        this.emitConnection({
          state: wasReady && notificationsRestored ? 'connected' : 'connecting',
          deviceId,
        });
      }
      throw cause;
    }

    if (this.pendingDeviceId === deviceId) {
      this.pendingDeviceId = null;
    }
    if (this.activeDeviceId === deviceId) {
      this.activeDeviceId = null;
    }
    if (this.nativeConnectingDeviceId === deviceId) {
      this.nativeConnectingDeviceId = null;
    }
    this.emitSettings(null);
    if (this.currentConnection.state !== 'disconnected') {
      this.emitConnection({ state: 'disconnected', deviceId });
    }
  }

  async writeAlarm(alarm: Alarm): Promise<void> {
    const packet = encodeAlarm(alarm);
    await this.enqueueConnectedOperation(async (deviceId) => {
      await this.manager.write(
        deviceId,
        SHIFTCLOCK_BLE_UUIDS.clockService,
        SHIFTCLOCK_BLE_UUIDS.alarmCharacteristic,
        packet,
        SHIFTCLOCK_BLE_PROTOCOL.alarm.packetSize
      );
    });
  }

  async writeSettings(settings: ClockSettings): Promise<void> {
    this.assertValidSetting(settings);
    await this.enqueueAcknowledgedSettingsOperation(
      encodeSettings(settings),
      'Settings write',
      async () => {
        const currentSettings = this.currentSettings;
        if (currentSettings === null) {
          throw new Error('Clock settings are unavailable');
        }
        this.emitSettings(this.withSettingValue(currentSettings, settings));
      }
    );
  }

  async commitSettings(): Promise<void> {
    await this.enqueueAcknowledgedSettingsOperation(
      encodeSettings(SHIFTCLOCK_BLE_PROTOCOL.settings.commands.commit),
      'Settings commit',
      async () => undefined
    );
  }

  async reloadSettings(): Promise<ClockSettingsSnapshot> {
    return this.enqueueAcknowledgedSettingsOperation(
      encodeSettings(SHIFTCLOCK_BLE_PROTOCOL.settings.commands.reload),
      'Settings reload',
      async (deviceId) => {
        const settings = await this.readSettings(deviceId);
        this.emitSettings(settings);
        return settings;
      }
    );
  }

  private async prepareBle(): Promise<void> {
    await this.requestPermissions();
    await this.ensureStarted();

    let state = await this.manager.checkState();
    if (state === 'on') {
      return;
    }
    if (isTransientBleState(state)) {
      state = await this.waitForSettledBleState();
    }
    if (state !== 'on') {
      throw new Error(`Bluetooth is ${state}`);
    }
  }

  private assertConnectionOwnership(generation: number, deviceId: string): void {
    if (generation !== this.connectionGeneration || this.pendingDeviceId !== deviceId) {
      throw new Error('Shiftclock connection was interrupted');
    }
  }

  private async ensureStarted(): Promise<void> {
    if (this.startPromise === null) {
      this.startPromise = this.startManager();
    }

    try {
      await this.startPromise;
    } catch (cause) {
      this.startPromise = null;
      throw cause;
    }
  }

  private async startManager(): Promise<void> {
    this.installNativeListeners();
    await this.manager.start({ showAlert: false });
  }

  private installNativeListeners(): void {
    if (this.listenersInstalled) {
      return;
    }
    this.listenersInstalled = true;

    this.manager.onDiscoverPeripheral((peripheral) => {
      const rssi = Number.isFinite(peripheral.rssi) ? peripheral.rssi : null;
      this.emit(this.deviceListeners, {
        id: peripheral.id,
        name: peripheral.name ?? peripheral.advertising.localName ?? null,
        rssi,
      });
    });
    this.manager.onDisconnectPeripheral((event) => {
      if (
        event.peripheral !== this.activeDeviceId &&
        event.peripheral !== this.pendingDeviceId
      ) {
        return;
      }

      this.changeConnectionGeneration();
      this.pendingDeviceId = null;
      this.nativeConnectingDeviceId = null;
      this.activeDeviceId = null;
      this.emitSettings(null);
      this.emitConnection({ state: 'disconnected', deviceId: event.peripheral });
    });
    this.manager.onDidUpdateValueForCharacteristic((event) => {
      this.handleNotification(event);
    });
    this.manager.onDidUpdateState((event) => {
      this.bleState = event.state;
      this.emit(this.bleStateWaiters, event.state);
    });
  }

  private waitForSettledBleState(): Promise<string> {
    if (this.bleState !== null && !isTransientBleState(this.bleState)) {
      return Promise.resolve(this.bleState);
    }

    return new Promise<string>((resolve, reject) => {
      const finish = (state: string) => {
        if (isTransientBleState(state)) {
          return;
        }
        clearTimeout(timeout);
        this.bleStateWaiters.delete(finish);
        resolve(state);
      };
      const timeout = setTimeout(() => {
        this.bleStateWaiters.delete(finish);
        reject(new Error('Bluetooth state did not settle'));
      }, BLE_STATE_TIMEOUT_MS);

      this.bleStateWaiters.add(finish);
      if (this.bleState !== null) {
        finish(this.bleState);
      }
    });
  }

  private async connectWithTimeout(deviceId: string): Promise<void> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.manager.connect(deviceId),
        new Promise<void>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error(`Connection to ${deviceId} timed out`)),
            CONNECT_TIMEOUT_MS
          );
        }),
      ]);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }

  private assertClockService(peripheral: BlePeripheralInfo): void {
    const serviceUuid = normalizeUuid(SHIFTCLOCK_BLE_UUIDS.clockService);
    const services = peripheral.services ?? [];
    if (!services.some((service) => normalizeUuid(service.uuid) === serviceUuid)) {
      throw new Error('Clock service was not discovered');
    }

    const characteristics = peripheral.characteristics ?? [];
    const required = [
      ['Alarm', SHIFTCLOCK_BLE_UUIDS.alarmCharacteristic],
      ['Settings', SHIFTCLOCK_BLE_UUIDS.settingsCharacteristic],
      ['Message', SHIFTCLOCK_BLE_UUIDS.messageCharacteristic],
    ] as const;

    for (const [label, characteristicUuid] of required) {
      const found = characteristics.some(
        (characteristic) =>
          normalizeUuid(characteristic.service) === serviceUuid &&
          normalizeUuid(characteristic.characteristic) === normalizeUuid(characteristicUuid)
      );
      if (!found) {
        throw new Error(`${label} characteristic was not discovered`);
      }
    }
  }

  private handleNotification(event: BleNotificationEvent): void {
    if (
      event.peripheral !== this.activeDeviceId ||
      normalizeUuid(event.service) !== normalizeUuid(SHIFTCLOCK_BLE_UUIDS.clockService) ||
      normalizeUuid(event.characteristic) !==
        normalizeUuid(SHIFTCLOCK_BLE_UUIDS.messageCharacteristic)
    ) {
      return;
    }

    try {
      const message = decodeMessage(event.value);
      if (
        message.type === SHIFTCLOCK_BLE_PROTOCOL.message.infoOperationSucceeded.type &&
        message.code === SHIFTCLOCK_BLE_PROTOCOL.message.infoOperationSucceeded.code
      ) {
        this.resolveSettingsAcknowledgement(event.peripheral);
      }
      this.emit(this.messageListeners, message);
    } catch {
      // Invalid packets are not exposed as firmware messages.
    }
  }

  private async readSettings(deviceId: string): Promise<ClockSettingsSnapshot> {
    const packet = await this.manager.read(
      deviceId,
      SHIFTCLOCK_BLE_UUIDS.clockService,
      SHIFTCLOCK_BLE_UUIDS.settingsCharacteristic
    );
    return decodeSettings(packet);
  }

  private enqueueConnectedOperation<T>(
    run: (deviceId: string, connectionGeneration: number) => Promise<T>
  ): Promise<T> {
    const deviceId = this.activeDeviceId;
    const connectionGeneration = this.connectionGeneration;
    if (
      deviceId === null ||
      this.currentConnection.state !== 'connected' ||
      this.currentConnection.deviceId !== deviceId
    ) {
      return Promise.reject(new Error('No Shiftclock is connected'));
    }

    const operation = this.writeQueue.then(async () => {
      if (
        this.activeDeviceId !== deviceId ||
        this.connectionGeneration !== connectionGeneration
      ) {
        throw new Error('Shiftclock connection changed before operation');
      }

      const result = await run(deviceId, connectionGeneration);
      if (
        this.activeDeviceId !== deviceId ||
        this.connectionGeneration !== connectionGeneration
      ) {
        throw new Error('Shiftclock connection changed during operation');
      }
      return result;
    });

    this.writeQueue = operation.then(
      () => undefined,
      () => undefined
    );
    return operation;
  }

  private enqueueAcknowledgedSettingsOperation<T>(
    packet: number[],
    operationName: string,
    afterAcknowledgement: (deviceId: string) => Promise<T>
  ): Promise<T> {
    return this.enqueueConnectedOperation(async (deviceId, connectionGeneration) => {
      const acknowledgement = this.waitForSettingsAcknowledgement(
        deviceId,
        connectionGeneration,
        operationName
      );

      try {
        await Promise.all([
          this.manager.write(
            deviceId,
            SHIFTCLOCK_BLE_UUIDS.clockService,
            SHIFTCLOCK_BLE_UUIDS.settingsCharacteristic,
            packet,
            SHIFTCLOCK_BLE_PROTOCOL.settings.packetSize
          ),
          acknowledgement,
        ]);
      } catch (cause) {
        this.rejectSettingsAcknowledgement(
          cause instanceof Error ? cause : new Error(String(cause))
        );
        throw cause;
      }

      return afterAcknowledgement(deviceId);
    });
  }

  private waitForSettingsAcknowledgement(
    deviceId: string,
    connectionGeneration: number,
    operationName: string
  ): Promise<void> {
    if (this.settingsAcknowledgement !== null) {
      return Promise.reject(new Error('Another Settings acknowledgement is pending'));
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (
          this.settingsAcknowledgement?.deviceId !== deviceId ||
          this.settingsAcknowledgement.connectionGeneration !== connectionGeneration
        ) {
          return;
        }
        this.settingsAcknowledgement = null;
        reject(
          new Error(
            `${operationName} timed out after ${SETTINGS_ACKNOWLEDGEMENT_TIMEOUT_MS} ms`
          )
        );
      }, SETTINGS_ACKNOWLEDGEMENT_TIMEOUT_MS);

      this.settingsAcknowledgement = {
        deviceId,
        connectionGeneration,
        resolve,
        reject,
        timeout,
      };
    });
  }

  private resolveSettingsAcknowledgement(deviceId: string): void {
    const acknowledgement = this.settingsAcknowledgement;
    if (
      acknowledgement === null ||
      acknowledgement.deviceId !== deviceId ||
      acknowledgement.connectionGeneration !== this.connectionGeneration
    ) {
      return;
    }

    clearTimeout(acknowledgement.timeout);
    this.settingsAcknowledgement = null;
    acknowledgement.resolve();
  }

  private rejectSettingsAcknowledgement(cause: Error): void {
    const acknowledgement = this.settingsAcknowledgement;
    if (acknowledgement === null) {
      return;
    }

    clearTimeout(acknowledgement.timeout);
    this.settingsAcknowledgement = null;
    acknowledgement.reject(cause);
  }

  private changeConnectionGeneration(): void {
    this.connectionGeneration += 1;
    this.rejectSettingsAcknowledgement(
      new Error('Shiftclock connection changed during Settings operation')
    );
  }

  private assertValidSetting(settings: ClockSettings): void {
    const entries = Object.entries(SHIFTCLOCK_BLE_PROTOCOL.settings.ids) as [
      keyof ClockSettingsSnapshot,
      number,
    ][];
    const entry = entries.find(([, id]) => id === settings.id);
    if (entry === undefined) {
      throw new Error('Invalid clock setting ID');
    }

    const range = SHIFTCLOCK_BLE_PROTOCOL.settings.ranges[entry[0]];
    if (
      !Number.isInteger(settings.value) ||
      settings.value < range.min ||
      settings.value > range.max
    ) {
      throw new Error(`Invalid clock setting value for ${entry[0]}`);
    }
  }

  private withSettingValue(
    settings: ClockSettingsSnapshot,
    update: ClockSettings
  ): ClockSettingsSnapshot {
    const entries = Object.entries(SHIFTCLOCK_BLE_PROTOCOL.settings.ids) as [
      keyof ClockSettingsSnapshot,
      number,
    ][];
    const key = entries.find(([, id]) => id === update.id)?.[0];
    if (key === undefined) {
      throw new Error('Invalid clock setting ID');
    }

    return { ...settings, [key]: update.value };
  }

  private emitConnection(event: ConnectionStateChangedEvent): void {
    this.currentConnection = event;
    this.emit(this.connectionListeners, event);
  }

  private emitSettings(settings: ClockSettingsSnapshot | null): void {
    if (this.currentSettings === settings) return;
    this.currentSettings = settings;
    this.emit(this.settingsListeners, settings);
  }

  private emit<T>(listeners: Set<Listener<T>>, value: T): void {
    for (const listener of listeners) {
      listener(value);
    }
  }
}
