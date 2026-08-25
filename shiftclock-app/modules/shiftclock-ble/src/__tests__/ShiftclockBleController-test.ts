import {
  ShiftclockBleController,
  type BleManagerClient,
  type BleManagerSubscription,
} from '../ShiftclockBleController';

type Listener<T> = (event: T) => void | Promise<void>;

function subscription(): BleManagerSubscription {
  return { remove: jest.fn() };
}

function messagePacket(type: number, code: number, description: string): number[] {
  const text = Array.from(description, (character) => character.charCodeAt(0));
  return [0, type, code, ...text, ...Array(40 - text.length).fill(0)];
}

function readyPeripheral() {
  return {
    id: 'clock-1',
    name: 'Bedroom Clock',
    rssi: -48,
    advertising: { localName: 'Bedroom Clock' },
    services: [{ uuid: '8984ff44-0000-4291-868b-2a44c36ed7e8' }],
    characteristics: [
      {
        service: '8984ff44-0000-4291-868b-2a44c36ed7e8',
        characteristic: '8984ff44-0001-4291-868b-2a44c36ed7e8',
      },
      {
        service: '8984ff44-0000-4291-868b-2a44c36ed7e8',
        characteristic: '8984ff44-0002-4291-868b-2a44c36ed7e8',
      },
      {
        service: '8984ff44-0000-4291-868b-2a44c36ed7e8',
        characteristic: '8984ff44-0003-4291-868b-2a44c36ed7e8',
      },
      {
        service: '8984ff44-0000-4291-868b-2a44c36ed7e8',
        characteristic: '8984ff44-0004-4291-868b-2a44c36ed7e8',
      },
    ],
  };
}

function createManager() {
  let discoveredListener: Listener<any> | undefined;
  let disconnectedListener: Listener<any> | undefined;
  let notificationListener: Listener<any> | undefined;
  let stateListener: Listener<any> | undefined;

  const manager: BleManagerClient = {
    start: jest.fn().mockResolvedValue(undefined),
    checkState: jest.fn().mockResolvedValue('on'),
    scan: jest.fn().mockResolvedValue(undefined),
    stopScan: jest.fn().mockResolvedValue(undefined),
    isScanning: jest.fn().mockResolvedValue(false),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    retrieveServices: jest.fn().mockResolvedValue(readyPeripheral()),
    requestMTU: jest.fn().mockResolvedValue(46),
    read: jest.fn().mockResolvedValue([0, 0xfb, 12, 2, 22, 6, 1, 2, 20, 1, 0]),
    startNotification: jest.fn().mockResolvedValue(undefined),
    stopNotification: jest.fn().mockResolvedValue(undefined),
    write: jest.fn().mockResolvedValue(undefined),
    onDiscoverPeripheral: jest.fn((listener) => {
      discoveredListener = listener;
      return subscription();
    }),
    onDisconnectPeripheral: jest.fn((listener) => {
      disconnectedListener = listener;
      return subscription();
    }),
    onDidUpdateValueForCharacteristic: jest.fn((listener) => {
      notificationListener = listener;
      return subscription();
    }),
    onDidUpdateState: jest.fn((listener) => {
      stateListener = listener;
      return subscription();
    }),
  };

  return {
    manager,
    discover: (event: unknown) => discoveredListener?.(event),
    disconnect: (event: unknown) => disconnectedListener?.(event),
    notify: (event: unknown) => notificationListener?.(event),
    updateState: (event: unknown) => stateListener?.(event),
  };
}

async function acknowledgeSettings(
  fake: ReturnType<typeof createManager>,
  peripheral = 'clock-1'
) {
  await fake.notify({
    peripheral,
    service: '8984ff44-0000-4291-868b-2a44c36ed7e8',
    characteristic: '8984ff44-0003-4291-868b-2a44c36ed7e8',
    value: messagePacket(0, 0, 'Settings Write Succeeded'),
  });
}

function tunePacket(id: number, dataLength: number, name: string): number[] {
  const nameBytes = Array.from(name, (character) => character.charCodeAt(0));
  return [
    0,
    id,
    dataLength & 0xff,
    (dataLength >>> 8) & 0xff,
    (dataLength >>> 16) & 0xff,
    (dataLength >>> 24) & 0xff,
    ...nameBytes,
    ...Array(20 - nameBytes.length).fill(0),
  ];
}

function alarmPacket(
  id: number,
  daysActive: number,
  secondsOfDay: number,
  tuneId: number,
  rampDurationSeconds: number,
  volume: number,
  autoDisableSeconds: number
): number[] {
  return [
    0,
    id,
    daysActive,
    secondsOfDay & 0xff,
    (secondsOfDay >>> 8) & 0xff,
    (secondsOfDay >>> 16) & 0xff,
    tuneId,
    rampDurationSeconds & 0xff,
    (rampDurationSeconds >>> 8) & 0xff,
    volume,
    autoDisableSeconds & 0xff,
    (autoDisableSeconds >>> 8) & 0xff,
  ];
}

function acknowledgeEveryWrite(fake: ReturnType<typeof createManager>): void {
  jest.mocked(fake.manager.write).mockImplementation(async () => {
    await acknowledgeSettings(fake);
  });
}

describe('ShiftclockBleController', () => {
  test('requests permission, scans by Clock service, and maps discoveries', async () => {
    const fake = createManager();
    const requestPermissions = jest.fn().mockResolvedValue(undefined);
    const controller = new ShiftclockBleController(fake.manager, 'android', requestPermissions);
    const devices: unknown[] = [];
    controller.addDeviceDiscoveredListener((device) => devices.push(device));

    await controller.scan();
    await fake.discover({
      id: 'clock-1',
      name: undefined,
      rssi: -61,
      advertising: { localName: 'Kitchen Clock' },
    });

    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(fake.manager.scan).toHaveBeenCalledWith({
      serviceUUIDs: ['8984ff44-0000-4291-868b-2a44c36ed7e8'],
      seconds: 10,
      allowDuplicates: true,
    });
    expect(devices).toEqual([{ id: 'clock-1', name: 'Kitchen Clock', rssi: -61 }]);
  });

  test('reports connected only after services, MTU, and notifications are ready', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'android', async () => undefined);
    const states: unknown[] = [];
    controller.addConnectionStateListener((event) => states.push(event));

    await controller.connect('clock-1');

    expect(fake.manager.requestMTU).toHaveBeenCalledWith('clock-1', 46);
    expect(fake.manager.startNotification).toHaveBeenCalledWith(
      'clock-1',
      '8984ff44-0000-4291-868b-2a44c36ed7e8',
      '8984ff44-0003-4291-868b-2a44c36ed7e8'
    );
    expect(states).toEqual([
      { state: 'disconnected', deviceId: null },
      { state: 'connecting', deviceId: 'clock-1' },
      { state: 'connected', deviceId: 'clock-1' },
    ]);
  });

  test('reads and publishes Settings before reporting connected', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    const settings: unknown[] = [];
    const connectedSnapshots: unknown[] = [];

    controller.addSettingsListener((snapshot) => settings.push(snapshot));
    controller.addConnectionStateListener((event) => {
      if (event.state === 'connected') connectedSnapshots.push(settings.at(-1));
    });

    await controller.connect('clock-1');

    expect(fake.manager.read).toHaveBeenCalledWith(
      'clock-1',
      '8984ff44-0000-4291-868b-2a44c36ed7e8',
      '8984ff44-0002-4291-868b-2a44c36ed7e8'
    );
    expect(settings).toEqual([
      null,
      {
        timezone: -5,
        dayBrightness: 12,
        nightBrightness: 2,
        dayNightCutoff: 22,
        nightDayCutoff: 6,
        seconds: 1,
        movingDp: 2,
        volume: 20,
        clockForm: 1,
        meriIndicator: 0,
      },
    ]);
    expect(connectedSnapshots).toEqual([settings.at(-1)]);
  });

  test('fails connection and leaves Settings empty when the read is malformed', async () => {
    const fake = createManager();
    jest.mocked(fake.manager.read).mockResolvedValue([0, 1]);
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    const settings: unknown[] = [];
    controller.addSettingsListener((snapshot) => settings.push(snapshot));

    await expect(controller.connect('clock-1')).rejects.toThrow('Settings packet size');

    expect(settings.at(-1)).toBeNull();
    expect(fake.manager.disconnect).toHaveBeenCalledWith('clock-1');
  });

  test('replays Settings and clears them when the active clock disconnects', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');
    const settings: unknown[] = [];
    controller.addSettingsListener((snapshot) => settings.push(snapshot));

    await fake.disconnect({ peripheral: 'clock-1' });

    expect(settings[0]).toMatchObject({ timezone: -5 });
    expect(settings.at(-1)).toBeNull();
  });

  test('hydrates a newly mounted listener with the current connection', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');
    const states: unknown[] = [];

    controller.addConnectionStateListener((event) => states.push(event));

    expect(states).toEqual([{ state: 'connected', deviceId: 'clock-1' }]);
  });

  test('returns to disconnected when service discovery is incomplete', async () => {
    const fake = createManager();
    jest.mocked(fake.manager.retrieveServices).mockResolvedValue({
      ...readyPeripheral(),
      characteristics: readyPeripheral().characteristics.slice(0, 2),
    });
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    const states: unknown[] = [];
    controller.addConnectionStateListener((event) => states.push(event));

    await expect(controller.connect('clock-1')).rejects.toThrow('Message characteristic');

    expect(states.at(-1)).toEqual({ state: 'disconnected', deviceId: 'clock-1' });
    expect(fake.manager.startNotification).not.toHaveBeenCalled();
  });

  test('rejects a clock that is missing the Tune characteristic', async () => {
    const fake = createManager();
    jest.mocked(fake.manager.retrieveServices).mockResolvedValue({
      ...readyPeripheral(),
      characteristics: readyPeripheral().characteristics.slice(0, 3),
    });
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);

    await expect(controller.connect('clock-1')).rejects.toThrow(
      'Tune characteristic was not discovered'
    );
  });

  test('enumerates Tunes then Alarms and replays only complete snapshots', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');
    jest.mocked(fake.manager.read)
      .mockReset()
      .mockResolvedValueOnce([0, 1, ...Array(24).fill(0)])
      .mockResolvedValueOnce(tunePacket(0, 41_144, 'Push'))
      .mockResolvedValueOnce([0, 2, ...Array(10).fill(0)])
      .mockResolvedValueOnce(alarmPacket(0, 31, 25_201, 0, 3, 40, 300))
      .mockResolvedValueOnce(alarmPacket(1, 64, 86_399, 0, 0, 100, 0));
    acknowledgeEveryWrite(fake);
    const alarmSnapshots: unknown[] = [];
    const tuneSnapshots: unknown[] = [];
    controller.addAlarmListener((alarms) => alarmSnapshots.push(alarms));
    controller.addTuneListener((tunes) => tuneSnapshots.push(tunes));

    await expect(controller.reloadAlarmData()).resolves.toEqual({
      tunes: [{ id: 0, name: 'Push', loopDurationSeconds: 1.28575 }],
      alarms: [
        {
          id: 0,
          daysActive: 31,
          secondsOfDay: 25_201,
          tuneId: 0,
          rampDurationSeconds: 3,
          volume: 40,
          autoDisableSeconds: 300,
        },
        {
          id: 1,
          daysActive: 64,
          secondsOfDay: 86_399,
          tuneId: 0,
          rampDurationSeconds: 0,
          volume: 100,
          autoDisableSeconds: 0,
        },
      ],
    });

    expect(jest.mocked(fake.manager.write).mock.calls.map((call) => call[3])).toEqual([
      [0, 0, 0xff],
      [0, 0, 0],
      [0, 0, 0xff, ...Array(10).fill(0)],
      [0, 0, 0, ...Array(10).fill(0)],
      [0, 0, 1, ...Array(10).fill(0)],
    ]);
    expect(alarmSnapshots).toHaveLength(2);
    expect(tuneSnapshots).toHaveLength(2);
    expect(alarmSnapshots[0]).toBeNull();
    expect(tuneSnapshots[0]).toBeNull();

    const replayedAlarms: unknown[] = [];
    const replayedTunes: unknown[] = [];
    controller.addAlarmListener((alarms) => replayedAlarms.push(alarms));
    controller.addTuneListener((tunes) => replayedTunes.push(tunes));
    expect(replayedAlarms).toEqual([alarmSnapshots[1]]);
    expect(replayedTunes).toEqual([tuneSnapshots[1]]);
  });

  test('plays a Tune with a duration-aware acknowledgement timeout', async () => {
    jest.useFakeTimers();
    try {
      const fake = createManager();
      const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
      await controller.connect('clock-1');
      jest.mocked(fake.manager.read)
        .mockReset()
        .mockResolvedValueOnce([0, 1, ...Array(24).fill(0)])
        .mockResolvedValueOnce(tunePacket(0, 41_144, 'Push'))
        .mockResolvedValueOnce([0, 0, ...Array(10).fill(0)]);
      acknowledgeEveryWrite(fake);
      await controller.reloadAlarmData();
      jest.mocked(fake.manager.write).mockReset().mockResolvedValue(undefined);

      const play = controller.playTune(0);
      let settled = false;
      void play.finally(() => { settled = true; });
      await Promise.resolve();
      await Promise.resolve();

      expect(fake.manager.write).toHaveBeenCalledWith(
        'clock-1',
        '8984ff44-0000-4291-868b-2a44c36ed7e8',
        '8984ff44-0004-4291-868b-2a44c36ed7e8',
        [0, 1, 0],
        3
      );
      jest.advanceTimersByTime(1_000);
      await Promise.resolve();
      expect(settled).toBe(false);

      await acknowledgeSettings(fake);
      await expect(play).resolves.toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  test.each([
    [3, 'Write Tune: Queue Full'],
    [7, 'Tune Audio Unavailable'],
  ])('rejects Tune Play immediately for firmware error code %i', async (code, description) => {
    jest.useFakeTimers();
    try {
      const fake = createManager();
      const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
      await controller.connect('clock-1');
      jest.mocked(fake.manager.read)
        .mockReset()
        .mockResolvedValueOnce([0, 1, ...Array(24).fill(0)])
        .mockResolvedValueOnce(tunePacket(0, 41_144, 'Push'))
        .mockResolvedValueOnce([0, 0, ...Array(10).fill(0)]);
      acknowledgeEveryWrite(fake);
      await controller.reloadAlarmData();
      jest.mocked(fake.manager.write).mockReset().mockResolvedValue(undefined);

      const play = controller.playTune(0);
      const rejectedPlay = expect(play).rejects.toThrow(description);
      await Promise.resolve();
      await Promise.resolve();
      await fake.notify({
        peripheral: 'clock-1',
        service: '8984ff44-0000-4291-868b-2a44c36ed7e8',
        characteristic: '8984ff44-0003-4291-868b-2a44c36ed7e8',
        value: messagePacket(1, code, description),
      });
      jest.advanceTimersByTime(10_000);

      await rejectedPlay;
    } finally {
      jest.useRealTimers();
    }
  });

  test('sends Tune cancellation immediately while Play is awaiting acknowledgement', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');
    jest.mocked(fake.manager.read)
      .mockReset()
      .mockResolvedValueOnce([0, 1, ...Array(24).fill(0)])
      .mockResolvedValueOnce(tunePacket(0, 41_144, 'Push'))
      .mockResolvedValueOnce([0, 0, ...Array(10).fill(0)]);
    acknowledgeEveryWrite(fake);
    await controller.reloadAlarmData();
    jest.mocked(fake.manager.write).mockReset().mockResolvedValue(undefined);

    const play = controller.playTune(0);
    await Promise.resolve();
    await Promise.resolve();
    const cancel = controller.cancelTunePreview();
    await Promise.resolve();

    expect(jest.mocked(fake.manager.write).mock.calls.map((call) => call[3])).toEqual([
      [0, 1, 0],
      [0, 1, 0xff],
    ]);
    await expect(cancel).resolves.toBeUndefined();
    await acknowledgeSettings(fake);
    await expect(play).resolves.toBeUndefined();
  });

  test('suppresses a Tune Play cancelled before its BLE write is submitted', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');
    jest.mocked(fake.manager.read)
      .mockReset()
      .mockResolvedValueOnce([0, 1, ...Array(24).fill(0)])
      .mockResolvedValueOnce(tunePacket(0, 41_144, 'Push'))
      .mockResolvedValueOnce([0, 0, ...Array(10).fill(0)]);
    acknowledgeEveryWrite(fake);
    await controller.reloadAlarmData();
    jest.mocked(fake.manager.write).mockReset().mockResolvedValue(undefined);

    const play = controller.playTune(0);
    const cancel = controller.cancelTunePreview();

    await expect(cancel).resolves.toBeUndefined();
    await expect(play).resolves.toBeUndefined();
    expect(fake.manager.write).not.toHaveBeenCalled();
  });

  test('acknowledges an Alarm mutation, rereads Alarms, and publishes shifted IDs', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');
    jest.mocked(fake.manager.read)
      .mockReset()
      .mockResolvedValueOnce([0, 1, ...Array(10).fill(0)])
      .mockResolvedValueOnce(alarmPacket(0, 1, 2, 0, 3, 4, 5));
    acknowledgeEveryWrite(fake);
    const snapshots: unknown[] = [];
    controller.addAlarmListener((alarms) => snapshots.push(alarms));

    await controller.removeAlarm(1);

    expect(jest.mocked(fake.manager.write).mock.calls.map((call) => call[3])).toEqual([
      [0, 3, 1, ...Array(10).fill(0)],
      [0, 0, 0xff, ...Array(10).fill(0)],
      [0, 0, 0, ...Array(10).fill(0)],
    ]);
    expect(snapshots.at(-1)).toEqual([
      {
        id: 0,
        daysActive: 1,
        secondsOfDay: 2,
        tuneId: 0,
        rampDurationSeconds: 3,
        volume: 4,
        autoDisableSeconds: 5,
      },
    ]);
  });

  test('commits Alarms with the exact command and waits for acknowledgement', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');
    jest.mocked(fake.manager.write).mockClear();

    const commit = controller.commitAlarms();
    await Promise.resolve();

    expect(fake.manager.write).toHaveBeenCalledWith(
      'clock-1',
      '8984ff44-0000-4291-868b-2a44c36ed7e8',
      '8984ff44-0001-4291-868b-2a44c36ed7e8',
      [0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      13
    );
    await acknowledgeSettings(fake);

    await expect(commit).resolves.toBeUndefined();
  });

  test('reloads persisted Alarms before rereading and publishing them', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');
    jest.mocked(fake.manager.write).mockClear();
    jest.mocked(fake.manager.read).mockReset().mockResolvedValue([0, 0, ...Array(10).fill(0)]);
    acknowledgeEveryWrite(fake);
    const snapshots: unknown[] = [];
    controller.addAlarmListener((alarms) => snapshots.push(alarms));

    await expect(controller.reloadAlarms()).resolves.toEqual([]);

    expect(jest.mocked(fake.manager.write).mock.calls.map((call) => call[3])).toEqual([
      [0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0xff, ...Array(10).fill(0)],
    ]);
    expect(snapshots).toEqual([null, []]);
  });

  test('rejects Alarm Commit immediately when firmware reports persistence failure', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');

    const commit = controller.commitAlarms();
    await Promise.resolve();
    await fake.notify({
      peripheral: 'clock-1',
      service: '8984ff44-0000-4291-868b-2a44c36ed7e8',
      characteristic: '8984ff44-0003-4291-868b-2a44c36ed7e8',
      value: messagePacket(1, 7, 'Alarm Commit Failed'),
    });

    await expect(commit).rejects.toThrow('Alarm Commit Failed');
  });

  test('rejects Alarm Reload without enumeration when firmware reports failure', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');
    jest.mocked(fake.manager.read).mockClear();

    const reload = controller.reloadAlarms();
    await Promise.resolve();
    await fake.notify({
      peripheral: 'clock-1',
      service: '8984ff44-0000-4291-868b-2a44c36ed7e8',
      characteristic: '8984ff44-0003-4291-868b-2a44c36ed7e8',
      value: messagePacket(1, 7, 'Alarm Reload Failed'),
    });

    await expect(reload).rejects.toThrow('Alarm Reload Failed');
    expect(fake.manager.read).not.toHaveBeenCalled();
  });

  test('rejects an enumeration and leaves snapshots empty when the connection changes', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');
    let finishRead: ((packet: number[]) => void) | undefined;
    jest.mocked(fake.manager.read).mockImplementationOnce(
      () => new Promise<number[]>((resolve) => { finishRead = resolve; })
    );
    acknowledgeEveryWrite(fake);
    const alarmSnapshots: unknown[] = [];
    const tuneSnapshots: unknown[] = [];
    controller.addAlarmListener((alarms) => alarmSnapshots.push(alarms));
    controller.addTuneListener((tunes) => tuneSnapshots.push(tunes));

    const reload = controller.reloadAlarmData();
    const rejectedReload = expect(reload).rejects.toThrow('connection changed');
    await Promise.resolve();
    await Promise.resolve();
    await fake.disconnect({ peripheral: 'clock-1' });
    finishRead?.([0, 0, ...Array(24).fill(0)]);

    await rejectedReload;
    expect(alarmSnapshots).toEqual([null]);
    expect(tuneSnapshots).toEqual([null]);
  });

  test('decodes valid Message notifications and ignores unrelated or malformed packets', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    const messages: unknown[] = [];
    controller.addMessageListener((message) => messages.push(message));
    await controller.connect('clock-1');

    const description = Array.from('Queue full', (character) => character.charCodeAt(0));
    await fake.notify({
      peripheral: 'clock-1',
      service: '8984ff44-0000-4291-868b-2a44c36ed7e8',
      characteristic: '8984ff44-0003-4291-868b-2a44c36ed7e8',
      value: [0, 1, 3, ...description, ...Array(40 - description.length).fill(0)],
    });
    await fake.notify({
      peripheral: 'another-clock',
      service: '8984ff44-0000-4291-868b-2a44c36ed7e8',
      characteristic: '8984ff44-0003-4291-868b-2a44c36ed7e8',
      value: Array(43).fill(0),
    });
    await fake.notify({
      peripheral: 'clock-1',
      service: '8984ff44-0000-4291-868b-2a44c36ed7e8',
      characteristic: '8984ff44-0003-4291-868b-2a44c36ed7e8',
      value: [0],
    });

    expect(messages).toEqual([{ type: 1, code: 3, description: 'Queue full' }]);
  });

  test('emits a disconnected state when the active peripheral drops', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    const states: unknown[] = [];
    controller.addConnectionStateListener((event) => states.push(event));
    await controller.connect('clock-1');

    await fake.disconnect({ peripheral: 'clock-1', status: 8 });

    expect(states.at(-1)).toEqual({ state: 'disconnected', deviceId: 'clock-1' });
  });

  test('stops an active scan without calling the native stop for an idle scanner', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.scan();
    jest.mocked(fake.manager.isScanning).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await controller.stopScan();
    await controller.stopScan();

    expect(fake.manager.stopScan).toHaveBeenCalledTimes(1);
  });

  test('cancels a scan that is still waiting for permissions', async () => {
    const fake = createManager();
    let finishPermissions: (() => void) | undefined;
    let permissionsStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      permissionsStarted = resolve;
    });
    const requestPermissions = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishPermissions = resolve;
          permissionsStarted?.();
        })
    );
    const controller = new ShiftclockBleController(fake.manager, 'ios', requestPermissions);

    const scan = controller.scan();
    await started;
    const stop = controller.stopScan();
    finishPermissions?.();
    await scan;
    await stop;

    expect(fake.manager.scan).not.toHaveBeenCalled();
  });

  test('connecting cancels a scan that is still waiting for permissions', async () => {
    const fake = createManager();
    let finishFirstPermissions: (() => void) | undefined;
    let firstPermissionsStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      firstPermissionsStarted = resolve;
    });
    const requestPermissions = jest.fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishFirstPermissions = resolve;
            firstPermissionsStarted?.();
          })
      )
      .mockResolvedValueOnce(undefined);
    const controller = new ShiftclockBleController(fake.manager, 'ios', requestPermissions);

    const scan = controller.scan();
    await started;
    const connect = controller.connect('clock-1');
    finishFirstPermissions?.();
    await scan;
    await connect;

    expect(fake.manager.scan).not.toHaveBeenCalled();
    expect(fake.manager.connect).toHaveBeenCalledWith('clock-1');
  });

  test('waits for a transient iOS adapter state to settle', async () => {
    const fake = createManager();
    let stateChecked: (() => void) | undefined;
    const checked = new Promise<void>((resolve) => {
      stateChecked = resolve;
    });
    jest.mocked(fake.manager.checkState).mockImplementation(async () => {
      stateChecked?.();
      return 'unknown';
    });
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);

    const scan = controller.scan();
    await checked;
    await fake.updateState({ state: 'on' });

    await expect(scan).resolves.toBeUndefined();
    expect(fake.manager.scan).toHaveBeenCalledTimes(1);
  });

  test('disables Message notifications before an explicit disconnect', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    const states: unknown[] = [];
    controller.addConnectionStateListener((event) => states.push(event));
    await controller.connect('clock-1');

    await controller.disconnect();

    expect(fake.manager.stopNotification).toHaveBeenCalledWith(
      'clock-1',
      '8984ff44-0000-4291-868b-2a44c36ed7e8',
      '8984ff44-0003-4291-868b-2a44c36ed7e8'
    );
    expect(states.slice(-2)).toEqual([
      { state: 'disconnecting', deviceId: 'clock-1' },
      { state: 'disconnected', deviceId: 'clock-1' },
    ]);
  });

  test('retains a ready connection when native disconnect fails', async () => {
    const fake = createManager();
    jest.mocked(fake.manager.disconnect)
      .mockRejectedValueOnce(new Error('disconnect failed'))
      .mockResolvedValueOnce(undefined);
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    const states: unknown[] = [];
    controller.addConnectionStateListener((event) => states.push(event));
    await controller.connect('clock-1');

    await expect(controller.disconnect()).rejects.toThrow('disconnect failed');

    expect(states.at(-1)).toEqual({ state: 'connected', deviceId: 'clock-1' });
    await controller.disconnect();
    expect(states.at(-1)).toEqual({ state: 'disconnected', deviceId: 'clock-1' });
    expect(fake.manager.disconnect).toHaveBeenCalledTimes(2);
  });

  test('cancels a connection attempt before the native connection resolves', async () => {
    const fake = createManager();
    let rejectConnection: ((cause: Error) => void) | undefined;
    let connectionStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      connectionStarted = resolve;
    });
    jest.mocked(fake.manager.connect).mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectConnection = reject;
          connectionStarted?.();
        })
    );
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);

    const connect = controller.connect('clock-1');
    await started;
    await controller.disconnect();
    rejectConnection?.(new Error('cancelled'));

    await expect(connect).rejects.toThrow();
    expect(fake.manager.disconnect).toHaveBeenCalledWith('clock-1');
  });

  test('cancels a connection while it is still waiting for permissions', async () => {
    const fake = createManager();
    let finishPermissions: (() => void) | undefined;
    let permissionsStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      permissionsStarted = resolve;
    });
    const requestPermissions = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishPermissions = resolve;
          permissionsStarted?.();
        })
    );
    const controller = new ShiftclockBleController(fake.manager, 'ios', requestPermissions);

    const connect = controller.connect('clock-1');
    await started;
    await controller.disconnect();
    finishPermissions?.();

    await expect(connect).rejects.toThrow('interrupted');
    expect(fake.manager.connect).not.toHaveBeenCalled();
  });

  test('times out a connection attempt and cancels it natively', async () => {
    jest.useFakeTimers();
    try {
      const fake = createManager();
      let connectionStarted: (() => void) | undefined;
      const started = new Promise<void>((resolve) => {
        connectionStarted = resolve;
      });
      jest.mocked(fake.manager.connect).mockImplementation(
        () =>
          new Promise<void>(() => {
            connectionStarted?.();
          })
      );
      const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);

      const connect = controller.connect('clock-1');
      await started;
      jest.advanceTimersByTime(15_000);

      await expect(connect).rejects.toThrow('timed out');
      expect(fake.manager.disconnect).toHaveBeenCalledWith('clock-1');
    } finally {
      jest.useRealTimers();
    }
  });

  test('rejects writes while no clock is connected', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);

    await expect(controller.writeSettings({ id: 1, value: 2 })).rejects.toThrow(
      'No Shiftclock is connected'
    );
    expect(fake.manager.write).not.toHaveBeenCalled();
  });

  test('rejects writes until service discovery and notifications are ready', async () => {
    const fake = createManager();
    let finishNotification: (() => void) | undefined;
    let notificationStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      notificationStarted = resolve;
    });
    jest.mocked(fake.manager.startNotification).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishNotification = resolve;
          notificationStarted?.();
        })
    );
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);

    const connect = controller.connect('clock-1');
    await started;

    await expect(controller.writeSettings({ id: 1, value: 2 })).rejects.toThrow(
      'No Shiftclock is connected'
    );
    finishNotification?.();
    await connect;
    expect(fake.manager.write).not.toHaveBeenCalled();
  });

  test('invalid writes reject through the promised API', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);

    const write = controller.writeSettings({ id: 256, value: 0 });

    await expect(write).rejects.toThrow('Invalid clock setting ID');
  });

  test('waits for Settings success and still publishes the firmware message', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    const messages: unknown[] = [];
    const settings: unknown[] = [];
    controller.addMessageListener((message) => messages.push(message));
    controller.addSettingsListener((snapshot) => settings.push(snapshot));
    await controller.connect('clock-1');

    const write = controller.writeSettings({ id: 1, value: 12 });
    await Promise.resolve();
    expect(fake.manager.write).toHaveBeenCalledTimes(1);
    let resolved = false;
    void write.then(() => { resolved = true; });
    await Promise.resolve();
    expect(resolved).toBe(false);

    await acknowledgeSettings(fake);
    await expect(write).resolves.toBeUndefined();
    expect(messages.at(-1)).toEqual({
      type: 0,
      code: 0,
      description: 'Settings Write Succeeded',
    });
    expect(settings.at(-1)).toMatchObject({ dayBrightness: 12 });
  });

  test('writes a negative Setting value as a two-complement byte', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');

    const write = controller.writeSettings({ id: 0, value: -12 });
    await Promise.resolve();
    expect(fake.manager.write).toHaveBeenLastCalledWith(
      'clock-1',
      '8984ff44-0000-4291-868b-2a44c36ed7e8',
      '8984ff44-0002-4291-868b-2a44c36ed7e8',
      [0, 0, 0xf4],
      3
    );
    await acknowledgeSettings(fake);

    await expect(write).resolves.toBeUndefined();
  });

  test('registers the Settings acknowledgement before the native write', async () => {
    const fake = createManager();
    jest.mocked(fake.manager.write).mockImplementation(async () => {
      await acknowledgeSettings(fake);
    });
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');

    await expect(controller.writeSettings({ id: 1, value: 12 })).resolves.toBeUndefined();
  });

  test('times out a Settings write after one second without success', async () => {
    jest.useFakeTimers();
    try {
      const fake = createManager();
      const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
      await controller.connect('clock-1');

      const write = controller.writeSettings({ id: 1, value: 12 });
      await Promise.resolve();
      jest.advanceTimersByTime(1_000);

      await expect(write).rejects.toThrow('timed out after 1000 ms');
    } finally {
      jest.useRealTimers();
    }
  });

  test('rejects an acknowledgement waiter when the connection changes', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');
    const write = controller.writeSettings({ id: 1, value: 12 });
    await Promise.resolve();
    expect(fake.manager.write).toHaveBeenCalledTimes(1);

    await fake.disconnect({ peripheral: 'clock-1' });

    await expect(write).rejects.toThrow('connection changed');
  });

  test('ignores a Settings success notification from another peripheral', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');
    const write = controller.writeSettings({ id: 1, value: 12 });
    await Promise.resolve();

    await acknowledgeSettings(fake, 'clock-2');
    let resolved = false;
    void write.then(() => { resolved = true; });
    await Promise.resolve();
    expect(resolved).toBe(false);

    await acknowledgeSettings(fake);
    await expect(write).resolves.toBeUndefined();
  });

  test('writes Commit exactly and resolves only after success', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');

    const commit = controller.commitSettings();
    await Promise.resolve();
    expect(fake.manager.write).toHaveBeenLastCalledWith(
      'clock-1',
      '8984ff44-0000-4291-868b-2a44c36ed7e8',
      '8984ff44-0002-4291-868b-2a44c36ed7e8',
      [0, 0xff, 0xff],
      3
    );
    await acknowledgeSettings(fake);

    await expect(commit).resolves.toBeUndefined();
  });

  test('rereads Settings only after Reload success', async () => {
    const fake = createManager();
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');
    jest.mocked(fake.manager.read)
      .mockClear()
      .mockResolvedValue([0, 4, 5, 3, 21, 7, 0, 1, 30, 0, 1]);

    const reload = controller.reloadSettings();
    await Promise.resolve();
    expect(fake.manager.read).not.toHaveBeenCalled();
    await acknowledgeSettings(fake);

    await expect(reload).resolves.toEqual({
      timezone: 4,
      dayBrightness: 5,
      nightBrightness: 3,
      dayNightCutoff: 21,
      nightDayCutoff: 7,
      seconds: 0,
      movingDp: 1,
      volume: 30,
      clockForm: 0,
      meriIndicator: 1,
    });
    expect(fake.manager.read).toHaveBeenCalledTimes(1);
  });

  test('serializes Alarm and Settings writes for the active peripheral', async () => {
    const fake = createManager();
    let finishFirstWrite: (() => void) | undefined;
    jest.mocked(fake.manager.write)
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => {
          finishFirstWrite = resolve;
        })
      )
      .mockImplementationOnce(async () => {
        await acknowledgeSettings(fake);
      })
      .mockResolvedValueOnce(undefined);
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');
    jest.mocked(fake.manager.read).mockResolvedValue([0, 0, ...Array(10).fill(0)]);

    const alarmWrite = controller.writeAlarm({
      daysActive: 1,
      secondsOfDay: 2,
      tuneId: 0,
      rampDurationSeconds: 3,
      volume: 4,
      autoDisableSeconds: 5,
    });
    const settingsWrite = controller.writeSettings({ id: 8, value: 1 });
    await Promise.resolve();

    expect(fake.manager.write).toHaveBeenCalledTimes(1);
    await acknowledgeSettings(fake);
    finishFirstWrite?.();
    await alarmWrite;
    await Promise.resolve();
    await acknowledgeSettings(fake);
    await settingsWrite;

    expect(fake.manager.write).toHaveBeenNthCalledWith(
      1,
      'clock-1',
      '8984ff44-0000-4291-868b-2a44c36ed7e8',
      '8984ff44-0001-4291-868b-2a44c36ed7e8',
      [0, 1, 0, 1, 2, 0, 0, 0, 3, 0, 4, 5, 0],
      13
    );
    expect(fake.manager.write).toHaveBeenNthCalledWith(
      3,
      'clock-1',
      '8984ff44-0000-4291-868b-2a44c36ed7e8',
      '8984ff44-0002-4291-868b-2a44c36ed7e8',
      [0, 8, 1],
      3
    );
  });

  test('does not move a queued write onto a later connection', async () => {
    const fake = createManager();
    let finishFirstWrite: (() => void) | undefined;
    jest.mocked(fake.manager.write).mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        finishFirstWrite = resolve;
      })
    );
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);
    await controller.connect('clock-1');
    const firstWrite = controller.writeSettings({ id: 1, value: 1 });
    const staleWrite = controller.writeSettings({ id: 2, value: 1 });
    const firstExpectation = expect(firstWrite).rejects.toThrow('connection changed');
    const staleExpectation = expect(staleWrite).rejects.toThrow('connection changed');
    await Promise.resolve();

    await controller.disconnect();
    await controller.connect('clock-2');
    finishFirstWrite?.();
    await firstExpectation;
    await staleExpectation;
    expect(fake.manager.write).toHaveBeenCalledTimes(1);
  });

  test('does not duplicate native subscriptions when manager startup is retried', async () => {
    const fake = createManager();
    jest.mocked(fake.manager.start)
      .mockRejectedValueOnce(new Error('startup failed'))
      .mockResolvedValueOnce(undefined);
    const controller = new ShiftclockBleController(fake.manager, 'ios', async () => undefined);

    await expect(controller.scan()).rejects.toThrow('startup failed');
    await controller.scan();

    expect(fake.manager.onDiscoverPeripheral).toHaveBeenCalledTimes(1);
    expect(fake.manager.onDisconnectPeripheral).toHaveBeenCalledTimes(1);
    expect(fake.manager.onDidUpdateValueForCharacteristic).toHaveBeenCalledTimes(1);
    expect(fake.manager.onDidUpdateState).toHaveBeenCalledTimes(1);
  });
});
