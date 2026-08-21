import { fireEvent, render, screen } from '@testing-library/react-native';

import { TuneSelect } from '../tune-select';

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#eeeeee',
    backgroundSelected: '#dddddd',
    textSecondary: '#666666',
  }),
}));

const tunes = [
  { id: 0, name: 'Push', loopDurationSeconds: 1.28575 },
  { id: 1, name: 'Rise', loopDurationSeconds: 2 },
];

describe('TuneSelect', () => {
  test('opens its options and selects a friendly Tune label', async () => {
    const onChange = jest.fn();
    await render(<TuneSelect label="Alarm tune" tunes={tunes} value={0} onChange={onChange} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Alarm tune: Push - 1.29 s' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Select Rise - 2.00 s' }));

    expect(onChange).toHaveBeenCalledWith(1);
  });

  test('cannot open while disabled', async () => {
    await render(
      <TuneSelect label="Alarm tune" tunes={tunes} value={0} disabled onChange={jest.fn()} />
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Alarm tune: Push - 1.29 s' }));

    expect(screen.queryByRole('button', { name: 'Select Rise - 2.00 s' })).toBeNull();
  });

  test('keeps two selectors independent', async () => {
    await render(
      <>
        <TuneSelect label="Alarm tune" tunes={tunes} value={0} onChange={jest.fn()} />
        <TuneSelect label="Test tune" tunes={tunes} value={1} onChange={jest.fn()} />
      </>
    );

    expect(screen.getByRole('button', { name: 'Alarm tune: Push - 1.29 s' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Test tune: Rise - 2.00 s' })).toBeTruthy();
  });
});
