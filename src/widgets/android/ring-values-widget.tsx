import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetData, WidgetSlot } from '@/lib/widget-data';
import { heartRingsSvg } from './ring-svg';
import { CARD_BACKGROUND, normalizeSlots, SECONDARY } from './shared';

function ValueRow({ slot }: { slot: WidgetSlot }) {
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <TextWidget text={slot.label} style={{ fontSize: 13, color: SECONDARY }} />
      <TextWidget
        text={`${slot.display} ${slot.unit}`.trim()}
        style={{ fontSize: 15, fontWeight: 'bold', color: slot.color }}
      />
    </FlexWidget>
  );
}

export function RingValuesWidget({ data }: { data: WidgetData | null }) {
  const slots = normalizeSlots(data);

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: CARD_BACKGROUND,
        borderRadius: 24,
        padding: 14,
      }}
    >
      <SvgWidget
        svg={heartRingsSvg(slots, 124, 7)}
        style={{ width: 124, height: 124, marginBottom: 12 }}
      />
      <FlexWidget
        style={{ width: 'match_parent', flexDirection: 'column', justifyContent: 'center' }}
      >
        <ValueRow slot={slots[0]} />
        <ValueRow slot={slots[1]} />
        <ValueRow slot={slots[2]} />
      </FlexWidget>
    </FlexWidget>
  );
}
