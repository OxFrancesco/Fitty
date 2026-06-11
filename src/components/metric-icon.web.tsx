import { Text } from 'react-native';

/** Web counterpart of metric-icon.tsx — SF Symbols only exist on iOS. */
export function MetricIcon({
  glyph,
  size = 18,
}: {
  icon: string;
  glyph: string;
  size?: number;
  color: string;
}) {
  return <Text style={{ fontSize: size - 2, lineHeight: size }}>{glyph}</Text>;
}
