import { ClockSettingWriteSampler } from '../ClockSettingWriteSampler';

describe('ClockSettingWriteSampler', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('sends immediately, samples at 100 ms, and keeps only the latest value', async () => {
    const write = jest.fn().mockResolvedValue(undefined);
    const sampler = new ClockSettingWriteSampler(write, jest.fn());

    sampler.sample(1, 2);
    sampler.sample(1, 3);
    sampler.sample(1, 4);
    await Promise.resolve();
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenLastCalledWith({ id: 1, value: 2 });

    jest.advanceTimersByTime(99);
    await Promise.resolve();
    expect(write).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(write).toHaveBeenLastCalledWith({ id: 1, value: 4 });
  });

  test('coalesces values while acknowledgement is pending', async () => {
    let finishWrite: (() => void) | undefined;
    const write = jest
      .fn()
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => { finishWrite = resolve; })
      )
      .mockResolvedValue(undefined);
    const sampler = new ClockSettingWriteSampler(write, jest.fn());

    sampler.sample(4, 10);
    sampler.sample(4, 20);
    sampler.sample(4, 30);
    jest.advanceTimersByTime(500);
    expect(write).toHaveBeenCalledTimes(1);

    finishWrite?.();
    await Promise.resolve();
    jest.advanceTimersByTime(100);
    await Promise.resolve();
    expect(write).toHaveBeenNthCalledWith(2, { id: 4, value: 30 });
  });

  test('flushes the final release value without waiting for the sample interval', async () => {
    const write = jest.fn().mockResolvedValue(undefined);
    const sampler = new ClockSettingWriteSampler(write, jest.fn());

    sampler.sample(0, 4);
    await Promise.resolve();
    await sampler.flush(0, 9);

    expect(write).toHaveBeenLastCalledWith({ id: 0, value: 9 });
  });

  test('cancels unsent samples and reports a failed setting ID', async () => {
    const failure = new Error('ack timeout');
    const onError = jest.fn();
    const write = jest.fn().mockRejectedValue(failure);
    const sampler = new ClockSettingWriteSampler(write, onError);

    sampler.sample(3, 1);
    sampler.sample(3, 2);
    sampler.cancelPending();
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith(3, failure);
    jest.advanceTimersByTime(500);
    expect(write).toHaveBeenCalledTimes(1);
  });

  test('flushes pending values for every setting before resolving', async () => {
    const write = jest.fn().mockResolvedValue(undefined);
    const sampler = new ClockSettingWriteSampler(write, jest.fn());
    sampler.sample(0, 5);
    sampler.sample(1, 9);

    await sampler.flushAll();

    expect(write).toHaveBeenCalledWith({ id: 0, value: 5 });
    expect(write).toHaveBeenCalledWith({ id: 1, value: 9 });
  });

  test('dispose prevents a pending timer from writing', async () => {
    const write = jest.fn().mockResolvedValue(undefined);
    const sampler = new ClockSettingWriteSampler(write, jest.fn());
    sampler.sample(4, 10);
    sampler.sample(4, 20);
    await Promise.resolve();

    sampler.dispose();
    jest.advanceTimersByTime(500);
    await Promise.resolve();

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({ id: 4, value: 10 });
  });
});
