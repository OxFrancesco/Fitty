import type { WidgetData, WidgetSlot } from '@/lib/widget-data';

export const CARD_BACKGROUND = '#1C1C1E';
export const SECONDARY = '#98989E';

export const PLACEHOLDER_SLOT: WidgetSlot = {
  id: '',
  label: 'OpenFit',
  value: 0,
  display: '--',
  unit: '',
  goal: 0,
  progress: 0,
  color: SECONDARY,
};

/** Renders may run before the first sync — always provide three safe slots. */
export function normalizeSlots(
  data: WidgetData | null | undefined
): [WidgetSlot, WidgetSlot, WidgetSlot] {
  const slots = data?.slots ?? [];
  return [
    slots[0] ?? PLACEHOLDER_SLOT,
    slots[1] ?? PLACEHOLDER_SLOT,
    slots[2] ?? PLACEHOLDER_SLOT,
  ];
}
