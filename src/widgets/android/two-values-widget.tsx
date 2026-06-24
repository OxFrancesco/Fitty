import { FlexWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetData, WidgetSlot } from '@/lib/widget-data';
import { CARD_BACKGROUND, normalizeSlots, SECONDARY } from './shared';

function ValueColumn({ slot }: { slot: WidgetSlot }) {
  return (
    <FlexWidget
      style={{ width: 'match_parent', flexDirection: 'column', alignItems: 'flex-start' }}
    >
      <TextWidget text={slot.label} style={{ fontSize: 13, color: SECONDARY }} />
      <TextWidget
        text={slot.display}
        style={{ fontSize: 30, fontWeight: 'bold', color: slot.color }}
      />
      <TextWidget text={slot.unit} style={{ fontSize: 12, color: SECONDARY }} />
    </FlexWidget>
  );
}

export function TwoValuesWidget({ data }: { data: WidgetData | null }) {
  const [first, second] = normalizeSlots(data);

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-evenly',
        alignItems: 'flex-start',
        backgroundColor: CARD_BACKGROUND,
        borderRadius: 24,
        padding: 18,
      }}
    >
      <ValueColumn slot={first} />
      <ValueColumn slot={second} />
    </FlexWidget>
  );
}
