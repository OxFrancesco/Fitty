import type { WidgetData } from '@/lib/widget-data';
import { saveLastWidgetData } from '@/lib/widget-store';
import { syncIosWidgets } from '@/widgets/ios/sync';

export async function syncWidgets(data: WidgetData): Promise<void> {
  await saveLastWidgetData(data).catch(() => undefined);
  syncIosWidgets(data);
}
