import type { CameraPose, FilmState, TimelineConfig, Vector3Tuple } from './types';

/**
 * Single source of truth for the cinematic film.
 *
 * Scroll position selects the normalized time `t`. Every visible quantity is a
 * pure, deterministic function of `t`, so scrolling backward reverses the film
 * exactly. Nothing here depends on wall-clock animation state.
 *
 * The camera follows explicit position/target/fov keyframes (front-facing wide
 * shot arcing toward the front of the display). The lid is NOT keyed to `t`:
 * it is derived from the camera's physical distance to the hinge point, so the
 * lid begins opening exactly when the camera reaches the configured distance.
 */
export interface CameraKeyframe {
  t: number;
  position: Vector3Tuple;
  target: Vector3Tuple;
  fov: number;
}

/**
 * Straight front-centered approach down the +X axis (front edge x≈1.34,
 * hinge x≈-1.20, width symmetric about z=0), ending square to the display.
 * Only the final screen-entry keys carry a slight lateral offset for depth.
 */
export const CAMERA_KEYS: CameraKeyframe[] = [
  { t: 0.0, position: [7.8, 2.35, 0.0], target: [-0.1, 0.1, 0], fov: 40 },
  { t: 0.28, position: [4.6, 1.85, 0.0], target: [-0.3, 0.6, 0], fov: 42 },
  { t: 0.52, position: [2.6, 1.65, 0.0], target: [-0.6, 0.9, 0], fov: 44 },
  { t: 0.74, position: [0.9, 1.5, 0.1], target: [-1.2, 1.4, 0], fov: 47 },
  { t: 0.9, position: [-0.3, 1.5, 0.08], target: [-1.5, 1.5, 0], fov: 50 },
  { t: 1.0, position: [-1.1, 1.5, 0.05], target: [-1.7, 1.5, 0], fov: 52 },
];

/** Physical hinge line of the laptop, measured from the actual GLB. */
export const HINGE_POINT: Vector3Tuple = [-1.199, 0.096, 0];

export const TIMELINE: TimelineConfig = {
  /**
   * Runway length (viewports). Sized so each beat owns enough scroll travel:
   * at 420vh the handoff window (0.68–0.83) spanned barely ~400px — a single
   * wheel flick could cross it before the damped camera arrived, making the
   * sequence feel skipped. 520vh stretches every beat ~31% (handoff ≈500px+)
   * so aggressive scrolls land mid-sequence with travel remaining instead of
   * at the exit. 650vh adds a cosmic-act tail after the handoff: every
   * mapping below is in normalized `t`, so the laptop beats keep their exact
   * choreography and only gain travel. Pure input gain: all `t` mappings
   * below are unchanged.
   */
  runwayViewportHeights: 6.5,
  lidStartDistance: 8.0,
  lidFullOpenDistance: 7.0,
  displayFillStartT: 0.9,
  /**
   * Handoff window, chosen from observed screen coverage: the display already
   * fills the frame around t≈0.7, so the DOM crossfades in over 0.68–0.83
   * while the canvas fades slightly behind it (tiny overlap, no bezel flash).
   */
  handoffStartT: 0.68,
  handoffEndT: 0.83,
};

/** Exponential-damping rate used by the camera rig. Higher values feel snappier. */
export const CAMERA_DAMP_LAMBDA = 3.4;

/**
 * Cosmic-act windows (normalized film time `t`). After the handoff panel has
 * fully assembled, it exits over PANEL_EXIT_* to reveal the space act living
 * in the same canvas; the cosmic environment assembles over COSMIC_*.
 * Additive only: every window below starts at or after the handoff lock, so
 * no laptop-act frame changes.
 */
export const COSMIC_REVEAL_START = 0.9;
export const COSMIC_REVEAL_END = 1.0;
export const PANEL_EXIT_START = 0.94;
export const PANEL_EXIT_END = 0.99;

/** Normalized cosmic progress: 0 until the reveal starts, 1 at film end. */
export function cosmicProgress(rawT: number): number {
  return smoothstep(COSMIC_REVEAL_START, COSMIC_REVEAL_END, clamp01(rawT));
}

/** Handoff-panel exit: 1 while the panel owns the frame, 0 once space takes over. */
export function panelExit(rawT: number): number {
  return smoothstep(PANEL_EXIT_START, PANEL_EXIT_END, clamp01(rawT));
}

/** When target and current film times are closer than this, rendering stops. */
export const RENDER_EPSILON = 0.0008;

/**
 * Scatter → assemble window for the handoff panel words (see Overlay).
 * The panel children start displaced at SCATTER_START and all lock by
 * SCATTER_END. Cosmic layers normalize this same window as their master
 * progress (see cosmicProgress), so text and environment assemble as one
 * reversible gesture.
 */
export const SCATTER_START = 0.62;
export const SCATTER_END = 0.86;

export const INITIAL_CAMERA = {
  position: [CAMERA_KEYS[0].position[0], CAMERA_KEYS[0].position[1], CAMERA_KEYS[0].position[2]] as const,
  fov: CAMERA_KEYS[0].fov,
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Monotonic cinematic easing over the whole film (smootherstep). */
export function easeFilmTime(rawT: number): number {
  const t = clamp01(rawT);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerpTuple(a: Vector3Tuple, b: Vector3Tuple, t: number): Vector3Tuple {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Camera pose from the keyframe track. Pure in `t`; shared by camera and lid logic. */
export function sampleCameraPose(rawT: number): CameraPose {
  const e = easeFilmTime(rawT);
  let index = 0;
  while (index < CAMERA_KEYS.length - 2 && e > CAMERA_KEYS[index + 1].t) {
    index += 1;
  }
  const from = CAMERA_KEYS[index];
  const to = CAMERA_KEYS[index + 1];
  const span = Math.max(1e-6, to.t - from.t);
  const u = clamp01((e - from.t) / span);
  return {
    position: lerpTuple(from.position, to.position, u),
    target: lerpTuple(from.target, to.target, u),
    fov: lerp(from.fov, to.fov, u),
  };
}

/** Physical camera-to-hinge distance. The lid trigger reads this, not scroll %. */
export function cameraDistanceForT(rawT: number): number {
  const pose = sampleCameraPose(rawT);
  const dx = pose.position[0] - HINGE_POINT[0];
  const dy = pose.position[1] - HINGE_POINT[1];
  const dz = pose.position[2] - HINGE_POINT[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Distance-driven lid relationship.
 *
 * The lid remains closed while the camera is farther than
 * `lidStartDistance`, begins opening at that threshold, and is fully open by
 * `lidFullOpenDistance`. It is deliberately independent of animation time.
 */
export function lidOpenForDistance(distance: number): number {
  if (distance >= TIMELINE.lidStartDistance) return 0;
  if (distance <= TIMELINE.lidFullOpenDistance) return 1;
  return (
    (TIMELINE.lidStartDistance - distance) /
    (TIMELINE.lidStartDistance - TIMELINE.lidFullOpenDistance)
  );
}

export interface HandoffState {
  /** 0 until the display covers the viewport, 1 once the DOM owns the view. */
  panelOpacity: number;
  /** 1 during the film, fading slightly behind the panel through handoff. */
  canvasOpacity: number;
  handedOff: boolean;
}

/** DOM handoff opacities, driven by the same film time as everything else. */
export function sampleHandoff(rawT: number): HandoffState {
  const t = clamp01(rawT);
  const panelOpacity = smoothstep(TIMELINE.handoffStartT, TIMELINE.handoffEndT, t);
  const canvasOpacity = 1 - smoothstep(TIMELINE.handoffStartT + 0.02, TIMELINE.handoffEndT + 0.03, t);
  return { panelOpacity, canvasOpacity, handedOff: panelOpacity >= 1 };
}

export function sampleTimeline(rawT: number): FilmState {
  const t = clamp01(rawT);
  const camera = sampleCameraPose(t);
  const cameraDistance = cameraDistanceForT(t);

  return {
    t,
    cameraDistance,
    camera,
    lidOpen: lidOpenForDistance(cameraDistance),
    screenGlow: smoothstep(0.45, 0.85, easeFilmTime(t)),
    displayFill: smoothstep(TIMELINE.displayFillStartT, 1, t),
    complete: t >= 0.999,
  };
}
