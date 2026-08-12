import type { ClockSettings } from '../../modules/shiftclock-ble';

type WriteSettings = (settings: ClockSettings) => Promise<void>;
type WriteFailure = (id: number, cause: unknown) => void;

type SettingState = {
  latestValue: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: Promise<void> | null;
  lastStartedAt: number | null;
};

export class ClockSettingWriteSampler {
  private readonly states = new Map<number, SettingState>();
  private disposed = false;

  constructor(
    private readonly write: WriteSettings,
    private readonly onError: WriteFailure,
    private readonly sampleIntervalMs = 100
  ) {}

  sample(id: number, value: number): void {
    if (this.disposed) return;
    const state = this.getState(id);
    state.latestValue = value;
    this.schedule(id, state);
  }

  async flush(id: number, value?: number): Promise<void> {
    if (this.disposed) return;
    const state = this.getState(id);
    if (value !== undefined) state.latestValue = value;

    while (state.inFlight !== null || state.latestValue !== null) {
      if (state.inFlight !== null) {
        await state.inFlight;
      }
      this.clearTimer(state);
      if (state.latestValue !== null) {
        await this.start(id, state);
      }
    }
  }

  async flushAll(): Promise<void> {
    await Promise.all([...this.states.keys()].map((id) => this.flush(id)));
  }

  cancelPending(): void {
    for (const state of this.states.values()) {
      this.clearTimer(state);
      state.latestValue = null;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.cancelPending();
  }

  private getState(id: number): SettingState {
    const current = this.states.get(id);
    if (current !== undefined) return current;

    const created: SettingState = {
      latestValue: null,
      timer: null,
      inFlight: null,
      lastStartedAt: null,
    };
    this.states.set(id, created);
    return created;
  }

  private schedule(id: number, state: SettingState): void {
    if (
      this.disposed ||
      state.latestValue === null ||
      state.inFlight !== null ||
      state.timer !== null
    ) {
      return;
    }

    const delay =
      state.lastStartedAt === null
        ? 0
        : Math.max(0, state.lastStartedAt + this.sampleIntervalMs - Date.now());
    if (delay === 0) {
      void this.start(id, state);
      return;
    }

    state.timer = setTimeout(() => {
      state.timer = null;
      void this.start(id, state);
    }, delay);
  }

  private start(id: number, state: SettingState): Promise<void> {
    const value = state.latestValue;
    if (value === null) return Promise.resolve();

    state.latestValue = null;
    state.lastStartedAt = Date.now();
    const operation = this.write({ id, value });
    state.inFlight = operation;
    operation.then(
      () => this.finish(id, state),
      (cause) => {
        state.latestValue = null;
        this.onError(id, cause);
        this.finish(id, state);
      }
    );
    return operation;
  }

  private finish(id: number, state: SettingState): void {
    state.inFlight = null;
    this.schedule(id, state);
  }

  private clearTimer(state: SettingState): void {
    if (state.timer !== null) clearTimeout(state.timer);
    state.timer = null;
  }
}
