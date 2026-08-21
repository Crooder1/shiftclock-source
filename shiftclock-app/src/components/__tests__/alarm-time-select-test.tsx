import { fireEvent, render } from '@testing-library/react-native';

import { AlarmTimeSelect } from '../alarm-time-select';

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#f0f0f3',
    backgroundSelected: '#e0e1e6',
    textSecondary: '#60646c',
  }),
}));

test('closes an expanded time menu when the control becomes disabled', async () => {
  const onChange = jest.fn();
  const view = await render(<AlarmTimeSelect onChange={onChange} value={7 * 3600} />);
  const hour = view.getByRole('button', { name: 'Alarm hour: 07' });

  await fireEvent.press(hour);
  expect(hour).toHaveProp('accessibilityState', expect.objectContaining({ expanded: true }));

  await view.rerender(<AlarmTimeSelect disabled onChange={onChange} value={7 * 3600} />);
  expect(hour).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));

  await view.rerender(<AlarmTimeSelect onChange={onChange} value={7 * 3600} />);
  expect(hour).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));
});

test('marks the selected option and gives options a full touch target', async () => {
  const view = await render(<AlarmTimeSelect onChange={jest.fn()} value={7 * 3600 + 1} />);

  await fireEvent.press(view.getByRole('button', { name: 'Alarm second: 01' }));
  const selected = view.getByRole('button', { name: 'Set alarm second to 01' });

  expect(selected).toHaveProp('accessibilityState', expect.objectContaining({ selected: true }));
  expect(selected).toHaveStyle({ minHeight: 44 });
});
