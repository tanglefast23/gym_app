const PASTEL_COLORS: readonly string[] = [
  '#8FE3B1', // mint
  '#84C7FF', // sky
  '#B7A3FF', // lavender
  '#FFB7A8', // peach
  '#FFE08A', // lemon
  '#7FE6E0', // aqua
  '#FF9EDB', // pink
  '#DCC7A1', // sand
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
  const idx = hashString(key) % PASTEL_COLORS.length;
  return PASTEL_COLORS[idx]!;
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

