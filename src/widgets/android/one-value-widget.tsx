import { FlexWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetData } from '@/lib/widget-data';
import { CARD_BACKGROUND, normalizeSlots, SECONDARY } from './shared';

export function OneValueWidget({ data }: { data: WidgetData | null }) {
  const [slot] = normalizeSlots(data);

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        backgroundColor: CARD_BACKGROUND,
        borderRadius: 24,
        padding: 10,
      }}
    >
      <TextWidget text={slot.label} style={{ fontSize: 11, color: SECONDARY }} />
      <TextWidget
        text={slot.display}
        style={{ fontSize: 24, fontWeight: 'bold', color: slot.color }}
      />
      <TextWidget text={slot.unit} style={{ fontSize: 10, color: SECONDARY }} />
    </FlexWidget>
  );
}
