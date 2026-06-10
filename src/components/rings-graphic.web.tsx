import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { CENTER, RADII, type RingProgress, SIZE, STROKE } from './rings-geometry';

/**
 * SVG fallback for web — the Skia implementation would require shipping
 * CanvasKit (~3 MB of WASM), so web keeps the flat stroke rendering.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function ProgressRing({ radius, ring }: { radius: number; ring: RingProgress }) {
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      ring.delay,
      withTiming(ring.progress, { duration: 1100, easing: Easing.out(Easing.cubic) })
    );
  }, [ring.progress, ring.delay, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <>
      {/* Track */}
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={radius}
        stroke={ring.color + '26'}
        strokeWidth={STROKE}
        fill="none"
      />
      {/* Progress arc, starting at 12 o'clock */}
      <AnimatedCircle
        cx={CENTER}
        cy={CENTER}
        r={radius}
        stroke={ring.color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={`${circumference}`}
        animatedProps={animatedProps}
        fill="none"
        transform={`rotate(-90 ${CENTER} ${CENTER})`}
      />
    </>
  );
}

export function RingsGraphic({ rings }: { rings: RingProgress[] }) {
  return (
    <Svg width={SIZE} height={SIZE}>
      {rings.map((ring, i) => (
        <ProgressRing key={ring.key} radius={RADII[i]} ring={ring} />
      ))}
    </Svg>
  );
}
