import { Platform } from 'react-native';

export const typography = {
  h1: {
    fontFamily: Platform.select({ ios: 'Lora-Bold', android: 'Lora-Bold', default: 'serif' }),
    fontSize: 32,
    fontWeight: '700' as const,
  },
  body: {
    fontFamily: Platform.select({ ios: 'Inter', android: 'Inter', default: 'sans-serif' }),
    fontSize: 16,
  },
  label: {
    fontFamily: Platform.select({ ios: 'Inter-SemiBold', android: 'Inter-SemiBold', default: 'sans-serif' }),
    fontSize: 14,
    fontWeight: '600' as const,
  }
};
