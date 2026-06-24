import { requestWidgetUpdate } from 'react-native-android-widget';

import type { WidgetData } from '@/lib/widget-data';
import { OneValueWidget } from './one-value-widget';
import { RingValuesWidget } from './ring-values-widget';
import { TwoValuesWidget } from './two-values-widget';

export const NAME_TO_WIDGET = {
  OneValue: OneValueWidget,
  TwoValues: TwoValuesWidget,
  RingValues: RingValuesWidget,
} as const;

export type AndroidWidgetName = keyof typeof NAME_TO_WIDGET;

export async function syncAndroidWidgets(data: WidgetData) {
  await Promise.all(
    (Object.keys(NAME_TO_WIDGET) as AndroidWidgetName[]).map((name) => {
      const Widget = NAME_TO_WIDGET[name];
      return requestWidgetUpdate({
        widgetName: name,
        renderWidget: () => <Widget data={data} />,
        // The user simply hasn't added this widget — nothing to clean up.
        widgetNotFound: () => undefined,
      }).catch(() => undefined);
    })
  );
}
