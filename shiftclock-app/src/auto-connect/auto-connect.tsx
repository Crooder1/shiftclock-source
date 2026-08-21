import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  addConnectionStateListener,
  addDeviceDiscoveredListener,
  connect,
  scan,
  stopScan,
  type ConnectionStateChangedEvent,
  type ShiftclockDevice,
} from '../../modules/shiftclock-ble';

export const AUTO_CONNECT_STORAGE_KEY = '@shiftclock/auto-connect';

export type AutoConnectTarget = {
  id: string;
  name: string | null;
};

type AutoConnectSettings = {
  enabled: boolean;
  target: AutoConnectTarget | null;
};

const DEFAULT_SETTINGS: AutoConnectSettings = {
  enabled: false,
  target: null,
};

type AutoConnectContextValue = {
  clearTarget: () => Promise<void>;
  devices: Readonly<Record<string, ShiftclockDevice>>;
  enabled: boolean;
  error: string | null;
  hydrated: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
  setTarget: (target: AutoConnectTarget) => Promise<void>;
  startScan: () => Promise<void>;
  target: AutoConnectTarget | null;
};

const AutoConnectContext = createContext<AutoConnectContextValue | undefined>(undefined);

export function AutoConnectProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<AutoConnectSettings>(DEFAULT_SETTINGS);
  const [devices, setDevices] = useState<Record<string, ShiftclockDevice>>({});
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  const connectionRef = useRef<ConnectionStateChangedEvent>({
    state: 'disconnected',
    deviceId: null,
  });
  const scanArmedRef = useRef(false);
  const attemptedTargetIdRef = useRef<string | null>(null);
  const activeRef = useRef(true);
  const settingsMutationQueueRef = useRef<Promise<void>>(Promise.resolve());

  const beginScan = useCallback(async (clearExistingError: boolean) => {
    attemptedTargetIdRef.current = null;
    scanArmedRef.current = true;
    if (clearExistingError) {
      setError(null);
    }

    try {
      await scan();
    } catch (cause) {
      scanArmedRef.current = false;
      if (activeRef.current) {
        setError(messageFromError(cause, 'Unable to start BLE scan'));
      }
      throw cause;
    }
  }, []);
  const startScan = useCallback(() => beginScan(true), [beginScan]);

  const updateSettings = useCallback(
    (update: (currentSettings: AutoConnectSettings) => AutoConnectSettings) => {
      const operation = settingsMutationQueueRef.current.then(async () => {
        if (activeRef.current) {
          setError(null);
        }

        const nextSettings = update(settingsRef.current);
        try {
          await AsyncStorage.setItem(AUTO_CONNECT_STORAGE_KEY, JSON.stringify(nextSettings));
        } catch (cause) {
          if (activeRef.current) {
            setError(messageFromError(cause, 'Unable to save Auto-Connect preference'));
          }
          throw cause;
        }

        settingsRef.current = nextSettings;
        if (activeRef.current) {
          setSettings(nextSettings);
        }
      });

      settingsMutationQueueRef.current = operation.catch(() => undefined);
      return operation;
    },
    []
  );

  const setEnabled = useCallback(
    (enabled: boolean) =>
      updateSettings((currentSettings) => ({ ...currentSettings, enabled })),
    [updateSettings]
  );
  const setTarget = useCallback(
    (target: AutoConnectTarget) =>
      updateSettings((currentSettings) => ({ ...currentSettings, target })),
    [updateSettings]
  );
  const clearTarget = useCallback(
    () => updateSettings((currentSettings) => ({ ...currentSettings, target: null })),
    [updateSettings]
  );

  useEffect(() => {
    let active = true;
    activeRef.current = true;

    const discoveredSubscription = addDeviceDiscoveredListener((device) => {
      if (activeRef.current) {
        setDevices((currentDevices) => ({ ...currentDevices, [device.id]: device }));
      }

      const currentSettings = settingsRef.current;
      if (
        !scanArmedRef.current ||
        !currentSettings.enabled ||
        currentSettings.target?.id !== device.id ||
        connectionRef.current.state !== 'disconnected' ||
        attemptedTargetIdRef.current === device.id
      ) {
        return;
      }

      attemptedTargetIdRef.current = device.id;
      scanArmedRef.current = false;
      void connect(device.id).catch((cause) => {
        if (activeRef.current) {
          setError(messageFromError(cause, 'Unable to connect to saved clock'));
        }
      });
    });
    const connectionSubscription = addConnectionStateListener((event) => {
      connectionRef.current = event;
      scanArmedRef.current = false;
    });

    void AsyncStorage.getItem(AUTO_CONNECT_STORAGE_KEY)
      .then((storedValue) => {
        if (active) {
          const storedSettings = parseStoredSettings(storedValue);
          settingsRef.current = storedSettings;
          setSettings(storedSettings);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(messageFromError(cause, 'Unable to load Auto-Connect preference'));
        }
      })
      .finally(() => {
        if (!active) {
          return;
        }

        setHydrated(true);
        void beginScan(false).catch(() => undefined);
      });

    return () => {
      active = false;
      activeRef.current = false;
      scanArmedRef.current = false;
      discoveredSubscription.remove();
      connectionSubscription.remove();
      void stopScan().catch(() => undefined);
    };
  }, [beginScan]);

  const value = useMemo(
    () => ({
      clearTarget,
      devices,
      enabled: settings.enabled,
      error,
      hydrated,
      setEnabled,
      setTarget,
      startScan,
      target: settings.target,
    }),
    [clearTarget, devices, error, hydrated, setEnabled, settings, setTarget, startScan]
  );

  return <AutoConnectContext.Provider value={value}>{children}</AutoConnectContext.Provider>;
}

function parseStoredSettings(storedValue: string | null): AutoConnectSettings {
  if (storedValue === null) {
    return DEFAULT_SETTINGS;
  }

  try {
    const value: unknown = JSON.parse(storedValue);
    if (!isRecord(value) || typeof value.enabled !== 'boolean') {
      return DEFAULT_SETTINGS;
    }

    if (value.target === null) {
      return { enabled: value.enabled, target: null };
    }

    if (
      !isRecord(value.target) ||
      typeof value.target.id !== 'string' ||
      value.target.id.length === 0 ||
      (value.target.name !== null && typeof value.target.name !== 'string')
    ) {
      return DEFAULT_SETTINGS;
    }

    return {
      enabled: value.enabled,
      target: { id: value.target.id, name: value.target.name },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function messageFromError(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

export function useAutoConnect() {
  const value = useContext(AutoConnectContext);

  if (!value) {
    throw new Error('useAutoConnect must be used within AutoConnectProvider');
  }

  return value;
}
