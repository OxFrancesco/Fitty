import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code'
    | 'hero'
    | 'metric'
    | 'caption';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        type === 'hero' && styles.hero,
        type === 'metric' && styles.metric,
        type === 'caption' && styles.caption,
        style,
      ]}
      {...rest}
    />
  );
}

// Apple Health–style scale: system font, bold headings, quiet gray captions.
const styles = StyleSheet.create({
  small: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 400,
  },
  smallBold: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 600,
  },
  default: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 400,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 700,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#007AFF',
  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  hero: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  metric: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 400,
  },
});
