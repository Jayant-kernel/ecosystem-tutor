import { smoothstep, SCATTER_START, SCATTER_END } from './timeline';

/**
 * Master cinematic progress.
 *
 * The scattered-word convergence already normalizes itself with
 * smoothstep(SCATTER_START, SCATTER_END, t). Every cosmic layer derives from
 * that SAME normalization, so text and environment assemble as one reversible
 * gesture: p = 0 fully scattered, p = 1 fully assembled hero.
 *
 * All mappings below are pure functions of p (which is pure in film time t),
 * using smoothstep windows per the storyboard. Nothing uses wall-clock time.
 */
export function cinematicProgress(filmT: number): number {
  return smoothstep(SCATTER_START, SCATTER_END, filmT);
}

/** Central violet illumination: first sensed ~0.25, clearly purple by ~0.5. */
export function violetGlow(p: number): number {
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

/** Large curved planet reveal: slow emergence from behind the hero. */
export function planetLevel(p: number): number {
  return smoothstep(0.6, 0.82, p);
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
