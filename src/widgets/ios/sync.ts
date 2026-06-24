import type { WidgetData } from '../../lib/widget-data';
import OneValue from './one-value-widget';
import { cleanupStaleIosRingImages, withIosRingImages } from './ring-images';

/** Importing the widget modules registers them with expo-widgets. */
const ALL_WIDGETS = [OneValue];

export function syncIosWidgets(data: WidgetData) {
  const dataWithImages = withIosRingImages(data);

  for (const widget of ALL_WIDGETS) {
    try {
      widget.updateSnapshot(dataWithImages);
    } catch (error) {
      console.warn('Failed to sync iOS widget', error);
      // One widget failing must not block the others.
    }
  }

  cleanupStaleIosRingImages(data.updatedAt);
}
