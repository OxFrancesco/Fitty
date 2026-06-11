import { useEffect, useMemo } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { makeHeartGeometry, type RingProgress, SIZE, STROKE } from './rings-geometry';

/**
 * SVG fallback for web — the Skia implementation would require shipping
 * CanvasKit (~3 MB of WASM), so web keeps the flat stroke rendering.
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);

function ProgressRing({ index, ring }: { index: number; ring: RingProgress }) {
  const { points, perimeter } = useMemo(() => makeHeartGeometry(index), [index]);
  const d = useMemo(
    () =>
      points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(' ') + ' Z',
    [points]
  );
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      ring.delay,
      withTiming(ring.progress, { duration: 1100, easing: Easing.out(Easing.cubic) })
    );
  }, [ring.progress, ring.delay, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: perimeter * (1 - progress.value),
  }));

  return (
    <>
      {/* Track */}
      <Path
        d={d}
        stroke={ring.color + '26'}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill="none"
      />
      {/* Progress sweep, starting at the top notch */}
      <AnimatedPath
        d={d}
        stroke={ring.color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${perimeter}`}
        animatedProps={animatedProps}
        fill="none"
      />
    </>
  );
}

export function RingsGraphic({ rings }: { rings: RingProgress[] }) {
  return (
    <Svg width={SIZE} height={SIZE}>
      {rings.map((ring, i) => (
        <ProgressRing key={ring.key} index={i} ring={ring} />
      ))}
    </Svg>
  );
}
