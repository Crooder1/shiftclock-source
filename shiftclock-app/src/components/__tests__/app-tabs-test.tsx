import { render } from '@testing-library/react-native';

import NativeAppTabs from '../app-tabs';
import AppTabs from '../app-tabs.web';

jest.mock('expo-symbols', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SymbolView: ({ name, ...props }: { name: object }) =>
      React.createElement(View, {
        ...props,
        accessible: true,
        accessibilityRole: 'image',
        iconName: name,
      }),
  };
});

jest.mock('expo-router/unstable-native-tabs', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  const Trigger = ({ children }: { children: React.ReactNode }) =>
    React.createElement(View, null, children);
  Trigger.Label = ({ children }: { children: React.ReactNode }) =>
    React.createElement(Text, null, children);
  Trigger.Icon = ({ md, sf }: { md: string; sf: string }) =>
    React.createElement(View, { accessible: true, accessibilityRole: 'image', md, sf });
  const NativeTabs = ({ children }: { children: React.ReactNode }) =>
    React.createElement(View, null, children);
  NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});

jest.mock('expo-router/ui', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Tabs: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
    TabSlot: () => null,
    TabList: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
    TabTrigger: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
  };
});

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#f0f0f3',
    backgroundSelected: '#e0e1e6',
    textSecondary: '#60646c',
  }),
}));

jest.mock('@/theme/app-theme', () => ({
  useAppTheme: () => ({ mode: 'light' }),
}));

test('renders stopwatch, settings, and alarm icons with their web tabs', async () => {
  const view = await render(<AppTabs />);
  const icons = view.getAllByRole('image');

  expect(icons.map((icon) => icon.props.iconName)).toEqual([
    { ios: 'stopwatch', android: 'timer', web: 'timer' },
    { ios: 'gearshape', android: 'settings', web: 'settings' },
    { ios: 'alarm', android: 'alarm', web: 'alarm' },
  ]);
});

test('uses the same stopwatch, settings, and alarm mapping for native tabs', async () => {
  const view = await render(<NativeAppTabs />);

  expect(view.getAllByRole('image').map(({ props }) => ({ sf: props.sf, md: props.md }))).toEqual([
    { sf: 'stopwatch', md: 'timer' },
    { sf: 'gearshape', md: 'settings' },
    { sf: 'alarm', md: 'alarm' },
  ]);
});

test('lets web tab buttons share compact widths without wrapping labels', async () => {
  const view = await render(<AppTabs />);
  const label = view.getByText('Clock');

  expect(label).toHaveProp('numberOfLines', 1);
  expect(label.parent).toHaveStyle({ width: '100%' });
  expect(label.parent?.parent).toHaveStyle({ flex: 1, minWidth: 0 });
});
