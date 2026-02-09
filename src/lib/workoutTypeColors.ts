export const WORKOUT_COLORS: readonly string[] = [
  // Priority pastels (user-specified order)
  '#A8E6CF', // 1. pastel green
  '#A8D8EA', // 2. pastel blue
  '#FFF3B0', // 3. pastel yellow
  '#FFB3B3', // 4. pastel red
  '#FFCC99', // 5. pastel orange
  '#C9B1FF', // 6. pastel purple
  '#C8D6E5', // 7. pastel silver
  // Additional distinct pastels
  '#88E5D9', // 8. pastel teal
  '#C5E99B', // 9. pastel lime
  // Regular colors (when pastels would look too similar)
  '#FF7F7F', // 10. coral
  '#5B9BD5', // 11. medium blue
  '#F4C542', // 12. gold
  '#7EC8A0', // 13. sage
] as const;

/** Pick a color by index, cycling through the palette when it overflows. */
export function colorForIndex(index: number): string {
  return WORKOUT_COLORS[index % WORKOUT_COLORS.length]!;
}

/**
 * Build a Map<templateName, color> from an ordered list of template names.
 * The first name gets color 0 (pastel green), second gets color 1 (pastel blue), etc.
 * Duplicates are ignored (first occurrence wins).
 */
export function buildColorMap(orderedNames: string[]): Map<string, string> {
  const map = new Map<string, string>();
  let idx = 0;
  for (const name of orderedNames) {
    if (!map.has(name)) {
      map.set(name, colorForIndex(idx));
      idx++;
    }
  }
  return map;
}

export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(0,0,0,${alpha})`;
  const int = Number.parseInt(m[1]!, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

