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
 * - past 100% the loop wraps: a completed lap stays underneath and the
 *   current lap rides on top, brighter, with a dark blurred underside
 */

/** How far the loop color shifts toward white at full progress */
const HEAD_TINT = 0.32;
/** Second-lap end tint — brighter still, so the overlap reads as raised */
const LAP_TINT = 0.55;
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

/** Fraction of the current lap (0..1) for a possibly multi-lap progress. */
function lapFraction(p: number) {
  'worklet';
  return p >= 1 ? p - Math.floor(p) : Math.min(Math.max(p, 0), 1);
}

function Ring({ index, ring }: { index: number; ring: RingProgress }) {
  const progress = useSharedValue(0);
  const headTint = lighten(ring.color, HEAD_TINT);
  const lapTint = lighten(ring.color, LAP_TINT);
  const { points, tangents } = useMemo(() => makeHeartGeometry(index), [index]);

  useEffect(() => {
    progress.value = withDelay(
      ring.delay,
      withTiming(ring.progress, { duration: 1100, easing: Easing.out(Easing.cubic) })
    );
  }, [ring.progress, ring.delay, progress]);

  const basePath = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    points.forEach((p, i) => (i === 0 ? builder.moveTo(p.x, p.y) : builder.lineTo(p.x, p.y)));
    return builder.close().build();
  }, [points]);

  // This heart's band — keeps shadows from bleeding into neighbors.
  const band = useMemo(() => {
    return Skia.Path.Stroke(basePath, { width: STROKE }) ?? basePath;
  }, [basePath]);

  // Arc of the lap currently being drawn (wraps past 100%).
  const arcPath = useDerivedValue(() => {
    const t = Math.min(Math.max(lapFraction(progress.value), 0.0001), 1);
    return Skia.Path.Trim(basePath, 0, t, false) ?? basePath;
  });

  const headPos = useDerivedValue(() => sampleLoop(points, lapFraction(progress.value)));

  const shadowPos = useDerivedValue(() => {
    const f = lapFraction(progress.value);
    const pos = sampleLoop(points, f);
    const tan = sampleLoop(tangents, f);
    return { x: pos.x + SHADOW_LEAD * tan.x, y: pos.y + SHADOW_LEAD * tan.y };
  });

  const headColor = useDerivedValue(() =>
    interpolateColor(Math.min(progress.value, 2), [0, 1, 2], [ring.color, headTint, lapTint])
  );

  const firstLapOpacity = useDerivedValue(() =>
    progress.value > 0.001 && progress.value < 1 ? 1 : 0
  );
  const fullLapOpacity = useDerivedValue(() => (progress.value >= 1 ? 1 : 0));
  const headOpacity = useDerivedValue(() => (progress.value > 0.001 ? 1 : 0));

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

      {/* Completed lap stays underneath once the goal is passed */}
      <Group opacity={fullLapOpacity}>
        <Path path={basePath} style="stroke" strokeWidth={STROKE} strokeJoin="round">
          <SweepGradient c={vec(CENTER, CENTER)} colors={[ring.color, headTint]} />
        </Path>
      </Group>

      {/* First lap: progress sweep brightening toward the head */}
      <Group opacity={firstLapOpacity}>
        <Path path={arcPath} style="stroke" strokeWidth={STROKE} strokeCap="round" strokeJoin="round">
          <SweepGradient c={vec(CENTER, CENTER)} colors={[ring.color, headTint]} />
        </Path>
      </Group>

      {/* Overlap lap: darkens the lap below, then rides on top, brighter */}
      <Group opacity={fullLapOpacity} clip={band}>
        <Path
          path={arcPath}
          style="stroke"
          strokeWidth={STROKE}
          strokeCap="round"
          strokeJoin="round"
          color="black"
          opacity={0.28}
        >
          <BlurMask blur={5} style="normal" />
        </Path>
        <Path path={arcPath} style="stroke" strokeWidth={STROKE} strokeCap="round" strokeJoin="round">
          <SweepGradient c={vec(CENTER, CENTER)} colors={[headTint, lapTint]} />
        </Path>
      </Group>

      <Group opacity={headOpacity}>
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
