import type { WidgetData } from '@/lib/widget-data';
import { saveLastWidgetData } from '@/lib/widget-store';
import { syncAndroidWidgets } from '@/widgets/android/sync';

export async function syncWidgets(data: WidgetData): Promise<void> {
  await saveLastWidgetData(data).catch(() => undefined);
  await syncAndroidWidgets(data);
}
