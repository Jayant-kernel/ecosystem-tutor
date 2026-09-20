import { smoothstep } from './timeline';

/**
 * Cosmic-act layer curves. Each is a pure, deterministic function of the
 * normalized cosmic progress `p` (see `cosmicProgress()` in timeline.ts):
 * p = 0 the environment is fully settled away, p = 1 the space act is fully
 * assembled. No timers, no scroll listeners, no hidden state — reverse
 * scrolling retraces every layer exactly, and each curve is unit-testable
 * in isolation.
 */

/** Warm central illumination: first sensed ~0.25, clearly ember by ~0.5. */
export function emberGlow(p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  // Two-segment ramp: whisper (0.25→0.5) then bloom to full by 0.85.
  if (p < 0.5) return 0.22 * smoothstep(0.25, 0.5, p);
  return 0.22 + 0.78 * smoothstep(0.5, 0.85, p);
}

/** Fluid/nebula environment emergence (never a plain 0→1 fade of one image). */
export function nebulaLevel(p: number): number {
  if (p <= 0.45) return 0;
  if (p >= 0.8) return 1;
  // Near-linear ramp so p=0.6 lands ~35-50% and p=0.7 lands ~60-70%,
  // matching the storyboard; softness comes from the reveal mask, not here.
  return (p - 0.45) / (0.8 - 0.45);
}

/** Floating rock composition settling into depth positions. */
export function rocksLevel(p: number): number {
  return smoothstep(0.7, 0.92, p);
}

/** Dust, bloom and foreground/background separation. */
export function dustLevel(p: number): number {
  return smoothstep(0.78, 0.95, p);
}

/** Readability contrast field strength behind the hero copy. */
export function contrastLevel(p: number): number {
  return 0.25 + 0.75 * smoothstep(0.15, 0.8, p);
}
