const WORKOUT_COLORS: readonly string[] = [
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
  '#C5E99B', // 10. pastel lime
  // Regular colors (when pastels would look too similar)
  '#FF7F7F', // 11. coral
  '#5B9BD5', // 12. medium blue
  '#F4C542', // 13. gold
  '#7EC8A0', // 14. sage
] as const;

function hashString(s: string): number {
  // Simple deterministic 32-bit hash (FNV-1a-ish).
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pastelForWorkoutType(type: string): string {
  const key = type.trim().toLowerCase();
  const idx = hashString(key) % WORKOUT_COLORS.length;
  return WORKOUT_COLORS[idx]!;
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

