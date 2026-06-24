import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { loadLastWidgetData } from '@/lib/widget-store';
import { NAME_TO_WIDGET, type AndroidWidgetName } from './sync';

/**
 * Headless renderer invoked by the launcher (add/resize/periodic update).
 * Renders from the last synced data — fresh data comes from the foreground
 * app and the background refresh task, never from here.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const name = props.widgetInfo.widgetName as AndroidWidgetName;
  const Widget = NAME_TO_WIDGET[name];

  if (!Widget) {
    return;
  }

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await loadLastWidgetData();
      props.renderWidget(<Widget data={data} />);
      break;
    }
    default:
      break;
  }
}
