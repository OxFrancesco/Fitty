import { FlexWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetData, WidgetSlot } from '@/lib/widget-data';
import { CARD_BACKGROUND, normalizeSlots, SECONDARY } from './shared';

function ValueColumn({ slot }: { slot: WidgetSlot }) {
  return (
    <FlexWidget style={{ flexDirection: 'column', alignItems: 'center' }}>
      <TextWidget text={slot.label} style={{ fontSize: 12, color: SECONDARY }} />
      <TextWidget
        text={slot.display}
        style={{ fontSize: 26, fontWeight: 'bold', color: slot.color }}
      />
      <TextWidget text={slot.unit} style={{ fontSize: 11, color: SECONDARY }} />
    </FlexWidget>
  );
}

export function ThreeValuesWidget({ data }: { data: WidgetData | null }) {
  const slots = normalizeSlots(data);

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        backgroundColor: CARD_BACKGROUND,
        borderRadius: 24,
        padding: 12,
      }}
    >
      <ValueColumn slot={slots[0]} />
      <ValueColumn slot={slots[1]} />
      <ValueColumn slot={slots[2]} />
    </FlexWidget>
  );
}
