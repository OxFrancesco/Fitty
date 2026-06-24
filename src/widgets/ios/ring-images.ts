import { Directory, File } from 'expo-file-system';
import { widgetsDirectory } from 'expo-widgets';
import { ImageFormat, PaintStyle, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia';

import { lighten, makeHeartGeometry, SIZE, STROKE } from '@/components/rings-geometry';
import type { WidgetData, WidgetSlot } from '@/lib/widget-data';

const SLOT_COLORS = ['#007AFF', '#FF3B30', '#34C759'] as const;
const IMAGE_SIZE = SIZE;
const IMAGE_PREFIX = 'openfit-heart-ring-';

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function makePath(points: { x: number; y: number }[]) {
  const path = Skia.PathBuilder.Make();
  points.forEach((point, index) => {
    if (index === 0) {
      path.moveTo(point.x, point.y);
    } else {
      path.lineTo(point.x, point.y);
    }
  });
  path.close();
  return path.detach();
}

function ringPng(slot: WidgetSlot, ringIndex: number) {
  const { points, perimeter } = makeHeartGeometry(ringIndex, 220);
  const path = makePath(points);
  const progress = Math.max(0, Math.min(1, slot.progress));
  const filled = perimeter * progress;
  const empty = Math.max(0.001, perimeter - filled);
  const color = SLOT_COLORS[ringIndex] ?? slot.color;
  const headColor = lighten(color, 0.32);
  const headIndex = Math.max(0, Math.min(points.length - 1, Math.floor(progress * points.length)));

  const surface = Skia.Surface.MakeOffscreen(IMAGE_SIZE, IMAGE_SIZE);
  if (!surface) {
    return null;
  }

  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));

  const trackPaint = Skia.Paint();
  trackPaint.setAntiAlias(true);
  trackPaint.setColor(Skia.Color(color));
  trackPaint.setAlphaf(0.16);
  trackPaint.setStrokeWidth(STROKE);
  trackPaint.setStrokeJoin(StrokeJoin.Round);
  trackPaint.setStyle(PaintStyle.Stroke);
  canvas.drawPath(path, trackPaint);

  if (progress > 0) {
    const progressPaint = Skia.Paint();
    progressPaint.setAntiAlias(true);
    progressPaint.setColor(Skia.Color(color));
    progressPaint.setStrokeWidth(STROKE);
    progressPaint.setStrokeCap(StrokeCap.Round);
    progressPaint.setStrokeJoin(StrokeJoin.Round);
    progressPaint.setStyle(PaintStyle.Stroke);
    progressPaint.setPathEffect(Skia.PathEffect.MakeDash([filled, empty], 0));
    canvas.drawPath(path, progressPaint);

    const head = points[headIndex];
    const headPaint = Skia.Paint();
    headPaint.setAntiAlias(true);
    headPaint.setColor(Skia.Color(headColor));
    headPaint.setStyle(PaintStyle.Fill);
    canvas.drawCircle(head.x, head.y, STROKE / 2, headPaint);
  }

  surface.flush();
  return surface.makeImageSnapshot().encodeToBytes(ImageFormat.PNG);
}

function writeRingImage(slot: WidgetSlot, ringIndex: number, updatedAt: number) {
  if (!widgetsDirectory) {
    return '';
  }

  try {
    const file = new File(
      widgetsDirectory,
      `${IMAGE_PREFIX}${safeFilePart(slot.id)}-${ringIndex}-${updatedAt}.png`
    );
    const png = ringPng(slot, ringIndex);
    if (!png) {
      return '';
    }

    file.create({ intermediates: true, overwrite: true });
    file.write(png);
    return file.uri;
  } catch {
    return '';
  }
}

export function cleanupStaleIosRingImages(currentUpdatedAt: number) {
  if (!widgetsDirectory) {
    return;
  }

  try {
    const directory = new Directory(widgetsDirectory);
    const currentSuffix = `-${currentUpdatedAt}.png`;

    if (!directory.exists) {
      return;
    }

    for (const entry of directory.list()) {
      if (
        entry instanceof File &&
        entry.name.startsWith(IMAGE_PREFIX) &&
        !entry.name.endsWith(currentSuffix)
      ) {
        try {
          entry.delete();
        } catch {
          // Best effort; stale images are harmless if the OS still has a handle.
        }
      }
    }
  } catch {
    // Widget rendering should not fail because cache cleanup failed.
  }
}

export function withIosRingImages(data: WidgetData): WidgetData {
  const imageCache = new Map<string, string>();

  const enrichSlot = (slot: WidgetSlot): WidgetSlot => ({
    ...slot,
    ringImageUris: SLOT_COLORS.map((_, ringIndex) => {
      const key = `${slot.id}:${slot.progress}:${ringIndex}:${data.updatedAt}`;
      if (!imageCache.has(key)) {
        imageCache.set(key, writeRingImage(slot, ringIndex, data.updatedAt));
      }
      return imageCache.get(key) ?? '';
    }),
  });

  return {
    ...data,
    slots: data.slots.map(enrichSlot),
    metricsById: Object.fromEntries(
      Object.entries(data.metricsById).map(([id, slot]) => [id, enrichSlot(slot)])
    ),
  };
}
