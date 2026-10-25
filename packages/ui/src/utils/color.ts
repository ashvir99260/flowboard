import { getContrastRatio } from '@mui/material/styles';

import { designTokens } from '../modules/theme/tokens.js';

/** Convert persisted hexadecimal colors at the presentation boundary. CSS tokens pass through. */
export function toHslColor(color: string): string {
  if (!/^#[\da-f]{6}$/i.test(color)) return color;

  const [red, green, blue] = [1, 3, 5].map(
    (start) => Number.parseInt(color.slice(start, start + 2), 16) / 255,
  ) as [number, number, number];
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const hue =
    delta === 0
      ? 0
      : maximum === red
        ? ((green - blue) / delta) % 6
        : maximum === green
          ? (blue - red) / delta + 2
          : (red - green) / delta + 4;
  const round = (value: number) => Number(value.toFixed(4));

  return `hsl(${round((hue * 60 + 360) % 360)}, ${round(saturation * 100)}%, ${round(lightness * 100)}%)`;
}

/** Contract colors are opaque hex; unsupported inputs retain the neutral themed fill. */
export function colorFill(color: string) {
  if (!/^#[\da-f]{6}$/i.test(color)) return undefined;

  const backgroundColor = toHslColor(color);
  const { dark, light } = designTokens.contrast;

  return {
    backgroundColor,
    color:
      getContrastRatio(backgroundColor, light) >= getContrastRatio(backgroundColor, dark)
        ? light
        : dark,
  };
}
