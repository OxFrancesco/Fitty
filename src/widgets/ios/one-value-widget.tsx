import { Gauge, HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  lineLimit,
  minimumScaleFactor,
  resizable,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetData, WidgetSlot } from '../../lib/widget-data';

type OneValueWidgetConfiguration = {
  style?: string;
  firstMetric?: string;
  secondMetric?: string;
  thirdMetric?: string;
};

// The component body is serialized verbatim and evaluated inside the widget
// extension, where only props, environment, and the expo-widgets globals exist.
const OneValueWidget = (
  props: WidgetData,
  environment: WidgetEnvironment<OneValueWidgetConfiguration>
) => {
  'widget';

  const WIDGET_BACKGROUND = '#1C1C1E';
  const SECONDARY = '#A1A1AA';
  const SLOT_COLORS = ['#007AFF', '#FF3B30', '#34C759'] as const;
  const fallback: WidgetSlot = {
    id: '',
    label: 'OpenFit',
    value: 0,
    display: '--',
    unit: '',
    goal: 0,
    progress: 0,
    color: '#8E8E93',
  };

  const raw = props?.slots ?? [];
  const appSlots = [raw[0] ?? fallback, raw[1] ?? fallback, raw[2] ?? fallback];
  const metricsById = props?.metricsById ?? {};
  const metricIds: Record<string, string> = {
    steps: 'steps',
    activeEnergyBurned: 'active-energy-burned',
    totalCalories: 'total-calories',
    activeMinutes: 'active-minutes',
    activeZoneMinutes: 'active-zone-minutes',
    distance: 'distance',
    floors: 'floors',
    altitude: 'altitude',
    sedentaryPeriod: 'sedentary-period',
    swimLengthsData: 'swim-lengths-data',
    runVo2Max: 'run-vo2-max',
    heartRate: 'heart-rate',
    dailyRestingHeartRate: 'daily-resting-heart-rate',
    dailyHeartRateVariability: 'daily-heart-rate-variability',
    timeInHeartRateZone: 'time-in-heart-rate-zone',
    caloriesInHeartRateZone: 'calories-in-heart-rate-zone',
    dailyVo2Max: 'daily-vo2-max',
    weight: 'weight',
    bodyFat: 'body-fat',
    coreBodyTemperature: 'core-body-temperature',
    bloodGlucose: 'blood-glucose',
    dailyOxygenSaturation: 'daily-oxygen-saturation',
    dailyRespiratoryRate: 'daily-respiratory-rate',
    nutritionLog: 'nutrition-log',
    hydrationLog: 'hydration-log',
  };

  const resolveSlot = (choice: string | undefined, fallbackIndex: number) => {
    if (choice === 'appFirst') {
      return { ...appSlots[0], color: SLOT_COLORS[fallbackIndex] };
    }
    if (choice === 'appSecond') {
      return { ...appSlots[1], color: SLOT_COLORS[fallbackIndex] };
    }
    if (choice === 'appThird') {
      return { ...appSlots[2], color: SLOT_COLORS[fallbackIndex] };
    }

    const metricId = choice ? metricIds[choice] : null;
    const slot = (metricId ? metricsById[metricId] : null) ?? appSlots[fallbackIndex] ?? fallback;
    return { ...slot, color: SLOT_COLORS[fallbackIndex] };
  };

  const config = environment.configuration ?? {};
  const slots = [
    resolveSlot(config.firstMetric, 0),
    resolveSlot(config.secondMetric, 1),
    resolveSlot(config.thirdMetric, 2),
  ];
  const style =
    config.style === 'rings' || config.style === 'values' || config.style === 'hearts'
      ? config.style
      : 'hearts';
  const simplified = environment.levelOfDetail === 'simplified';

  const labelText = (slot: WidgetSlot, size = 12) => (
    <Text
      modifiers={[
        font({ size, weight: 'semibold' }),
        foregroundStyle(SECONDARY),
        lineLimit(1),
        minimumScaleFactor(0.65),
      ]}
    >
      {slot.label}
    </Text>
  );

  const valueText = (slot: WidgetSlot, size: number) => (
    <Text
      modifiers={[
        font({ size, weight: 'bold' }),
        foregroundStyle(slot.color),
        lineLimit(1),
        minimumScaleFactor(0.55),
      ]}
    >
      {slot.display}
    </Text>
  );

  const unitText = (slot: WidgetSlot, size = 11) => (
    <Text
      modifiers={[
        font({ size }),
        foregroundStyle(SECONDARY),
        lineLimit(1),
        minimumScaleFactor(0.7),
      ]}
    >
      {slot.unit}
    </Text>
  );

  const valueColumn = (slot: WidgetSlot, valueSize: number) => (
    <VStack alignment="leading" spacing={3}>
      {labelText(slot)}
      {valueText(slot, valueSize)}
      {unitText(slot)}
    </VStack>
  );

  const compactValueColumn = (slot: WidgetSlot) => (
    <VStack alignment="center" spacing={3}>
      {labelText(slot, 11)}
      {valueText(slot, 24)}
      {unitText(slot, 10)}
    </VStack>
  );

  const compactValueRow = (slot: WidgetSlot) => (
    <HStack spacing={6}>
      {labelText(slot, 12)}
      <Spacer />
      <Text
        modifiers={[
          font({ size: 13, weight: 'bold' }),
          foregroundStyle(slot.color),
          lineLimit(1),
          minimumScaleFactor(0.6),
        ]}
      >
        {`${slot.display} ${slot.unit}`.trim()}
      </Text>
    </HStack>
  );

  const metricRow = (slot: WidgetSlot) => (
    <VStack alignment="center" spacing={3} modifiers={[frame({ width: 142, height: 50, alignment: 'center' })]}>
      {labelText(slot, 11)}
      <HStack spacing={5}>
        <Image systemName="circle.fill" color={slot.color} size={9} />
        <Text
          modifiers={[
            font({ size: 17, weight: 'bold' }),
            foregroundStyle(slot.color),
            lineLimit(1),
            minimumScaleFactor(0.55),
          ]}
        >
          {`${slot.display} ${slot.unit}`.trim()}
        </Text>
      </HStack>
    </VStack>
  );

  const gaugeColumn = (slot: WidgetSlot, size: number) => (
    <VStack spacing={5}>
      <Gauge
        value={slot.progress}
        modifiers={[
          gaugeStyle('circularCapacity'),
          tint(slot.color),
          frame({ width: size, height: size }),
        ]}
      >
        <Text
          modifiers={[
            font({ size: size > 70 ? 13 : 11, weight: 'bold' }),
            lineLimit(1),
            minimumScaleFactor(0.6),
          ]}
        >
          {slot.display}
        </Text>
      </Gauge>
      {labelText(slot, size > 70 ? 12 : 10)}
    </VStack>
  );

  const ringLayer = (slot: WidgetSlot, ringIndex: number, size: number) => {
    const uri = slot.ringImageUris?.[ringIndex];

    if (!uri) {
      return null;
    }

    return <Image uiImage={uri} modifiers={[resizable(), frame({ width: size, height: size })]} />;
  };

  const ringsGraphic = (size: number) => (
    <ZStack modifiers={[frame({ width: size, height: size })]}>
      {ringLayer(slots[0], 0, size)}
      {ringLayer(slots[1], 1, size)}
      {ringLayer(slots[2], 2, size)}
    </ZStack>
  );

  const largeHeartsAndStats = () => (
    <HStack spacing={14} modifiers={[containerBackground(WIDGET_BACKGROUND, 'widget')]}>
      <VStack spacing={8} modifiers={[frame({ width: 152, height: 196 })]}>
        <Spacer />
        {ringsGraphic(150)}
        <Spacer />
      </VStack>
      <VStack spacing={8} modifiers={[frame({ width: 142, height: 196 })]}>
        <Spacer />
        {metricRow(slots[0])}
        {metricRow(slots[1])}
        {metricRow(slots[2])}
        <Spacer />
      </VStack>
    </HStack>
  );

  if (environment.widgetFamily === 'systemSmall') {
    if (style === 'rings') {
      return (
        <VStack spacing={6} modifiers={[containerBackground(WIDGET_BACKGROUND, 'widget')]}>
          {gaugeColumn(slots[0], 72)}
          {unitText(slots[0])}
        </VStack>
      );
    }

    if (style === 'hearts') {
      return (
        <VStack spacing={4} modifiers={[containerBackground(WIDGET_BACKGROUND, 'widget')]}>
          {ringsGraphic(78)}
          {labelText(slots[0], 13)}
          {valueText(slots[0], 36)}
          {unitText(slots[0])}
        </VStack>
      );
    }

    return (
      <VStack spacing={5} modifiers={[containerBackground(WIDGET_BACKGROUND, 'widget')]}>
        {labelText(slots[0], 13)}
        {valueText(slots[0], 40)}
        {unitText(slots[0], 12)}
      </VStack>
    );
  }

  if (environment.widgetFamily === 'systemMedium') {
    if (style === 'rings') {
      return (
        <HStack spacing={8} modifiers={[containerBackground(WIDGET_BACKGROUND, 'widget')]}>
          <Spacer />
          {gaugeColumn(slots[0], 62)}
          <Spacer />
          {gaugeColumn(slots[1], 62)}
          <Spacer />
          {gaugeColumn(slots[2], 62)}
          <Spacer />
        </HStack>
      );
    }

    if (style === 'hearts') {
      return (
        <HStack spacing={14} modifiers={[containerBackground(WIDGET_BACKGROUND, 'widget')]}>
          {ringsGraphic(112)}
          <VStack spacing={simplified ? 8 : 5}>
            {compactValueRow(slots[0])}
            {compactValueRow(slots[1])}
            {simplified ? null : compactValueRow(slots[2])}
          </VStack>
        </HStack>
      );
    }

    return (
      <HStack spacing={10} modifiers={[containerBackground(WIDGET_BACKGROUND, 'widget')]}>
        <Spacer />
        {compactValueColumn(slots[0])}
        <Spacer />
        {compactValueColumn(slots[1])}
        <Spacer />
        {compactValueColumn(slots[2])}
        <Spacer />
      </HStack>
    );
  }

  if (style === 'rings') {
    return largeHeartsAndStats();
  }

  if (style === 'values') {
    return (
      <VStack alignment="leading" spacing={18} modifiers={[containerBackground(WIDGET_BACKGROUND, 'widget')]}>
        {valueColumn(slots[0], 46)}
        {valueColumn(slots[1], 40)}
        {valueColumn(slots[2], 40)}
      </VStack>
    );
  }

  return largeHeartsAndStats();
};

export default createWidget<WidgetData, OneValueWidgetConfiguration>('OneValue', OneValueWidget);
