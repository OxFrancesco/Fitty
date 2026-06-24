import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetData, WidgetSlot } from '@/lib/widget-data';
import { ringSvg } from './ring-svg';
import { CARD_BACKGROUND, normalizeSlots, SECONDARY } from './shared';

function RingColumn({ slot }: { slot: WidgetSlot }) {
  return (
    <FlexWidget style={{ flexDirection: 'column', alignItems: 'center' }}>
      <SvgWidget svg={ringSvg(slot.progress, slot.color)} style={{ width: 64, height: 64 }} />
      <TextWidget
        text={slot.display}
        style={{ fontSize: 16, fontWeight: 'bold', color: '#FFFFFF', marginTop: 4 }}
      />
      <TextWidget text={slot.label} style={{ fontSize: 11, color: SECONDARY }} />
    </FlexWidget>
  );
}

export function FullRingsWidget({ data }: { data: WidgetData | null }) {
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
      <RingColumn slot={slots[0]} />
      <RingColumn slot={slots[1]} />
      <RingColumn slot={slots[2]} />
    </FlexWidget>
  );
}
