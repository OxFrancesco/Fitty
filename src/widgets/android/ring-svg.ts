/** Circular progress ring as an inline SVG string for SvgWidget. */
export function ringSvg(progress: number, color: string, size = 64, stroke = 8) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  const filled = clamped * circumference;
  const center = size / 2;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${center}" cy="${center}" r="${radius}" stroke="${color}33" stroke-width="${stroke}" fill="none"/>
  <circle cx="${center}" cy="${center}" r="${radius}" stroke="${color}" stroke-width="${stroke}" fill="none"
    stroke-linecap="round" stroke-dasharray="${filled} ${circumference - filled}"
    transform="rotate(-90 ${center} ${center})"/>
</svg>`;
}

export function heartRingsSvg(
  slots: { progress: number; color: string }[],
  size = 124,
  stroke = 7
) {
  const heartPath =
    'M60 106 C24 73 8 53 15 31 C20 13 42 12 60 35 C78 12 100 13 105 31 C112 53 96 73 60 106 Z';
  const scales = [1, 0.78, 0.58];

  const rings = scales
    .map((scale, index) => {
      const slot = slots[index] ?? { progress: 0, color: '#98989E' };
      const progress = Math.max(0, Math.min(1, slot.progress));
      const translate = ((1 - scale) * 120) / 2;

      return `
        <g transform="translate(${translate} ${translate}) scale(${scale})">
          <path d="${heartPath}" pathLength="100" stroke="${slot.color}33" stroke-width="${stroke}" fill="none" stroke-linejoin="round"/>
          <path d="${heartPath}" pathLength="100" stroke="${slot.color}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-linejoin="round"
            stroke-dasharray="${progress * 100} ${100 - progress * 100}"/>
        </g>`;
    })
    .join('');

  return `<svg width="${size}" height="${size}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">${rings}</svg>`;
}
