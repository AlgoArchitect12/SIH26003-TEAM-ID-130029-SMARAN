import { Platform, type ViewStyle } from 'react-native';

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Layout = {
  contentMaxWidth: 680,
  pagePadding: Spacing.md,
  sectionGap: Spacing.lg,
  minTouchTarget: 56,
  cardMinHeight: 88,
  buttonHeight: 60,
  largeButtonHeight: 72,
  gameCardMinSize: 56,
  interactiveSeparation: 16,
} as const;

export const PageLayout = {
  content: { alignSelf: 'center', width: '100%', maxWidth: Layout.contentMaxWidth, gap: Layout.sectionGap },
  heading: { gap: Spacing.sm },
  group: { gap: Spacing.md },
} as const satisfies Record<string, ViewStyle>;

export const Radius = {
  card: 20,
  largeCard: 24,
  button: 14,
} as const;

export const Elevation = {
  card: Platform.select<ViewStyle>({
    web: { boxShadow: '0 2px 8px rgba(28, 37, 38, 0.08)' },
    default: {
      elevation: 2,
      shadowColor: '#1C2526',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
  }),
} as const satisfies Record<string, ViewStyle>;
