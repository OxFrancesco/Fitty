import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Path,
  PathOp,
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

import { CENTER, lighten, RADII, type RingProgress, SIZE, STROKE } from './rings-geometry';

/**
 * Skia activity rings with a slight 3D treatment:
 * - a sweep gradient brightens each arc toward its head (tube lighting)
 * - the head cap casts a soft shadow onto the track beneath it
 */

/** How far the arc color shifts toward white at a full ring */
const HEAD_TINT = 0.32;
/** Tip shadow is nudged ahead of the head, along the direction of travel */
const SHADOW_LEAD = 3;

function Ring({ radius, ring }: { radius: number; ring: RingProgress }) {
  const progress = useSharedValue(0);
  const headTint = lighten(ring.color, HEAD_TINT);

  useEffect(() => {
    progress.value = withDelay(
      ring.delay,
      withTiming(ring.progress, { duration: 1100, easing: Easing.out(Easing.cubic) })
    );
  }, [ring.progress, ring.delay, progress]);

  const basePath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addCircle(CENTER, CENTER, radius);
    return path;
  }, [radius]);

  // This ring's band — keeps the tip shadow from bleeding into neighbors.
  const band = useMemo(() => {
    const outer = Skia.Path.Make();
    outer.addCircle(CENTER, CENTER, radius + STROKE / 2);
    const inner = Skia.Path.Make();
    inner.addCircle(CENTER, CENTER, radius - STROKE / 2);
    return Skia.Path.MakeFromOp(outer, inner, PathOp.Difference) ?? outer;
  }, [radius]);

  const arcPath = useDerivedValue(() => {
    const t = Math.min(Math.max(progress.value, 0.0001), 1);
    const path = basePath.copy();
    return path.trim(0, t, false) ?? path;
  });

  const headPos = useDerivedValue(() => {
    const theta = 2 * Math.PI * progress.value;
    return { x: CENTER + radius * Math.cos(theta), y: CENTER + radius * Math.sin(theta) };
  });

  const shadowPos = useDerivedValue(() => {
    const theta = 2 * Math.PI * progress.value;
    return {
      x: CENTER + radius * Math.cos(theta) - SHADOW_LEAD * Math.sin(theta),
      y: CENTER + radius * Math.sin(theta) + SHADOW_LEAD * Math.cos(theta),
    };
  });

  const headColor = useDerivedValue(() =>
    interpolateColor(progress.value, [0, 1], [ring.color, headTint])
  );

  const arcOpacity = useDerivedValue(() => (progress.value > 0.001 ? 1 : 0));

  return (
    <>
      {/* Track */}
      <Circle
        c={vec(CENTER, CENTER)}
        r={radius}
        style="stroke"
        strokeWidth={STROKE}
        color={ring.color + '26'}
      />

      <Group opacity={arcOpacity}>
        {/* Progress arc, brightening toward the head */}
        <Path path={arcPath} style="stroke" strokeWidth={STROKE} strokeCap="round">
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
      {/* Rotate so arcs start at 12 o'clock */}
      <Group transform={[{ rotate: -Math.PI / 2 }]} origin={vec(CENTER, CENTER)}>
        {rings.map((ring, i) => (
          <Ring key={ring.key} radius={RADII[i]} ring={ring} />
        ))}
      </Group>
    </Canvas>
  );
}
