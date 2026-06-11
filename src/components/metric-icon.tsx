import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Platform, Text } from 'react-native';

/**
 * Metric glyph: SF Symbol on iOS (with a subtle bounce on mount),
 * plain-text glyph everywhere else.
 */
export function MetricIcon({
  icon,
  glyph,
  size = 18,
  color,
}: {
  icon: string;
  glyph: string;
  size?: number;
  color: string;
}) {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={icon as SFSymbol}
        size={size}
        tintColor={color}
        animationSpec={{ effect: { type: 'bounce' } }}
      />
    );
  }

  return <Text style={{ fontSize: size - 2, lineHeight: size }}>{glyph}</Text>;
}
