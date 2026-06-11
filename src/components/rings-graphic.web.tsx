import { useEffect, useMemo } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { lighten, makeHeartGeometry, type RingProgress, SIZE, STROKE } from './rings-geometry';

/**
 * SVG fallback for web — the Skia implementation would require shipping
 * CanvasKit (~3 MB of WASM), so web keeps the flat stroke rendering.
 * Past 100% the completed lap stays underneath and the current lap
 * continues on top in a brighter tint.
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** How far the overlap lap color shifts toward white */
const HEAD_TINT = 0.32;

function lapFraction(p: number) {
  'worklet';
  return p >= 1 ? p - Math.floor(p) : Math.min(Math.max(p, 0), 1);
}

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
  const headTint = lighten(ring.color, HEAD_TINT);

  useEffect(() => {
    progress.value = withDelay(
      ring.delay,
      withTiming(ring.progress, { duration: 1100, easing: Easing.out(Easing.cubic) })
    );
  }, [ring.progress, ring.delay, progress]);

  const fullLapProps = useAnimatedProps(() => ({
    opacity: progress.value >= 1 ? 1 : 0,
  }));

  const firstLapProps = useAnimatedProps(() => ({
    strokeDashoffset: perimeter * (1 - lapFraction(progress.value)),
    opacity: progress.value < 1 ? 1 : 0,
  }));

  const overlapLapProps = useAnimatedProps(() => ({
    strokeDashoffset: perimeter * (1 - lapFraction(progress.value)),
    opacity: progress.value >= 1 ? 1 : 0,
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
      {/* Completed lap stays underneath once the goal is passed */}
      <AnimatedPath
        d={d}
        stroke={ring.color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        animatedProps={fullLapProps}
        fill="none"
      />
      {/* First lap: progress sweep, starting at the top notch */}
      <AnimatedPath
        d={d}
        stroke={ring.color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${perimeter}`}
        animatedProps={firstLapProps}
        fill="none"
      />
      {/* Overlap lap rides on top in a brighter tint */}
      <AnimatedPath
        d={d}
        stroke={headTint}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${perimeter}`}
        animatedProps={overlapLapProps}
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
