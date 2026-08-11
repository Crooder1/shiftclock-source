/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/theme/app-theme';

export function useTheme() {
  return Colors[useAppTheme().mode];
}
