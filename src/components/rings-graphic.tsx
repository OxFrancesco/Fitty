import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
  SweepGradient,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import {
  Easing,
  interpolateColor,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {
  CENTER,
  lighten,
  makeHeartGeometry,
  type RingProgress,
  SIZE,
  STROKE,
} from './rings-geometry';

/**
 * Skia activity hearts with a slight 3D treatment:
 * - a sweep gradient brightens each loop toward its head (tube lighting)
 * - the head cap casts a soft shadow onto the track beneath it
 */

/** How far the loop color shifts toward white at full progress */
const HEAD_TINT = 0.32;
/** Tip shadow is nudged ahead of the head, along the direction of travel */
const SHADOW_LEAD = 3;

/** Interpolate along the equal-arc-length sample loop at fraction f of the perimeter. */
function sampleLoop(arr: { x: number; y: number }[], f: number) {
  'worklet';
  const n = arr.length;
  const idx = Math.min(Math.max(f, 0), 1) * n;
  const i0 = Math.floor(idx) % n;
  const i1 = (i0 + 1) % n;
  const frac = idx - Math.floor(idx);
  const a = arr[i0];
  const b = arr[i1];
  return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
}

function Ring({ index, ring }: { index: number; ring: RingProgress }) {
  const progress = useSharedValue(0);
  const headTint = lighten(ring.color, HEAD_TINT);
  const { points, tangents } = useMemo(() => makeHeartGeometry(index), [index]);

  useEffect(() => {
    progress.value = withDelay(
      ring.delay,
      withTiming(ring.progress, { duration: 1100, easing: Easing.out(Easing.cubic) })
    );
  }, [ring.progress, ring.delay, progress]);

  const basePath = useMemo(() => {
    const path = Skia.Path.Make();
    points.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)));
    path.close();
    return path;
  }, [points]);

  // This heart's band — keeps the tip shadow from bleeding into neighbors.
  const band = useMemo(() => {
    const outline = basePath.copy();
    return outline.stroke({ width: STROKE }) ? outline : basePath;
  }, [basePath]);

  const arcPath = useDerivedValue(() => {
    const t = Math.min(Math.max(progress.value, 0.0001), 1);
    const path = basePath.copy();
    return path.trim(0, t, false) ?? path;
  });

  const headPos = useDerivedValue(() => sampleLoop(points, progress.value));

  const shadowPos = useDerivedValue(() => {
    const pos = sampleLoop(points, progress.value);
    const tan = sampleLoop(tangents, progress.value);
    return { x: pos.x + SHADOW_LEAD * tan.x, y: pos.y + SHADOW_LEAD * tan.y };
  });

  const headColor = useDerivedValue(() =>
    interpolateColor(progress.value, [0, 1], [ring.color, headTint])
  );

  const arcOpacity = useDerivedValue(() => (progress.value > 0.001 ? 1 : 0));

  return (
    <>
      {/* Track */}
      <Path
        path={basePath}
        style="stroke"
        strokeWidth={STROKE}
        strokeJoin="round"
        color={ring.color + '26'}
      />

      <Group opacity={arcOpacity}>
        {/* Progress sweep, brightening toward the head */}
        <Path path={arcPath} style="stroke" strokeWidth={STROKE} strokeCap="round" strokeJoin="round">
          <SweepGradient c={vec(CENTER, CENTER)} colors={[ring.color, headTint]} />
        </Path>

        {/* Soft shadow cast by the head onto whatever sits beneath it */}
        <Group clip={band}>
          <Circle c={shadowPos} r={STROKE / 2} color="black" opacity={0.3}>
            <BlurMask blur={5} style="normal" />
          </Circle>
        </Group>

        {/* Head cap drawn over the shadow */}
        <Circle c={headPos} r={STROKE / 2} color={headColor} />
      </Group>
    </>
  );
}

export function RingsGraphic({ rings }: { rings: RingProgress[] }) {
  return (
    <Canvas style={{ width: SIZE, height: SIZE }}>
      {/* Heart loops start at the top notch and sweep down the right lobe */}
      {rings.map((ring, i) => (
        <Ring key={ring.key} index={i} ring={ring} />
      ))}
    </Canvas>
  );
}
