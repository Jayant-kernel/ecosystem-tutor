/**
 * Data model for the scroll-driven story journey.
 *
 * The journey is DATA here; rendering, transitions, and video control live in
 * JourneyContent/JourneyVideo and are fully shared. The orb path inside
 * PostCinematicJourney remains the single master timeline: each section owns
 * a [start, end] window of the SAME 0..1 journey progress that drives the
 * orb via getPointAtLength, so text/video state is always a pure function of
 * orb position. No timers, no animation loops — reverse scroll retraces.
 *
 * Boundaries sit on natural path landmarks (arc-length fractions of the
 * desktop track, total ≈ 2598 units; the mobile track shares the topology):
 *   0.17 right-wall bend · 0.29 diagonal end · 0.40 loop right side ·
 *   0.47 loop bottom · 0.56–0.59 reversal tip · 0.65 exit-drop end ·
 *   0.74 small-loop entry · 0.93 tail end.
 */

export type JourneySide = 'text-left' | 'text-right';

export interface JourneyVideoSlot {
  /** Human label shown on the placeholder; also used as <video> aria-label. */
  label: string;
  /**
   * Real video file to play when available. No local video assets ship with
   * the repo yet, so every section starts as a placeholder (src omitted);
   * dropping a path here swaps that slot to a real <video> with no other
   * code changes.
   */
  src?: string;
  poster?: string;
}

export interface JourneySection {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  video: JourneyVideoSlot;
  /** Alternates so the path stays the visual spine between text and video. */
  side: JourneySide;
  /** Inclusive journey-progress window. Adjacent windows share an edge. */
  start: number;
  end: number;
  /** Optional call-to-action rendered inside the section's text panel. */
  cta?: { label: string; target: 'courses' | 'explanations' };
}

export const JOURNEY_XFADE = 0.035;

export const JOURNEY_SECTIONS: readonly JourneySection[] = [
  {
    id: 'problem',
    eyebrow: "LEARNING TO CODE SHOULDN'T FEEL LIKE THIS",
    title: 'Coding gets complicated.',
    description:
      'Docs, tutorials, forums, editor — too many tabs open just to understand one error.',
    video: { label: 'The friction: scattered debugging' },
    side: 'text-left',
    start: 0.0,
    end: 0.2,
  },
  {
    id: 'voice',
    eyebrow: 'YOUR AI CODING COMPANION',
    title: 'Your voice becomes your interface.',
    description:
      "Ask naturally. Describe the error. Ecosystem keeps your context so you never break flow.",
    video: { label: 'Ask naturally, stay in flow' },
    side: 'text-right',
    start: 0.2,
    end: 0.4,
  },
  {
    id: 'understand',
    eyebrow: 'BUILT FOR UNDERSTANDING',
    title: "Don't just get the answer.",
    description:
      'Guided concepts and clear explanations of unfamiliar code — discover the solution yourself.',
    video: { label: 'Understand, not just answers' },
    side: 'text-left',
    start: 0.4,
    end: 0.6,
  },
  {
    id: 'build',
    eyebrow: 'BUILD AND DEBUG',
    title: 'From stuck to building.',
    description:
      'Learn concepts. Understand errors. Keep building with confidence.',
    video: { label: 'Debug while you build' },
    side: 'text-right',
    start: 0.6,
    end: 0.74,
  },
  {
    id: 'confidence',
    eyebrow: 'ONE PLACE TO GROW',
    title: 'Build with confidence.',
    description: 'Your companion from first error to shipped project.',
    video: { label: 'Ship your project' },
    side: 'text-left',
    start: 0.74,
    end: 1.0,
    cta: { label: 'Explore courses', target: 'courses' },
  },
];

/** Total scroll runway for the journey, in viewport heights. */
export const JOURNEY_VIEWPORT_HEIGHTS = 6.5;

/** Linear clamp helper shared by weight math. */
export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Smoothstep easing for crossfade ramps — gentle ends, exact midpoint. */
export function smooth01(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

/**
 * Per-section visibility weight in [0,1], pure function of journey progress.
 * Ramps in across [start-X, start+X], holds 1 through the body, ramps out
 * across [end-X, end+X] — so around every boundary the outgoing section
 * fades/slides away exactly as the incoming one resolves (0.5/0.5 at the
 * boundary midpoint, single dominance everywhere else). First section
 * starts dominant, last section stays dominant through p=1.
 */
export function sectionWeight(p: number, index: number): number {
  const s = JOURNEY_SECTIONS[index];
  const X = JOURNEY_XFADE;
  const enter =
    index === 0 ? 1 : smooth01((p - (s.start - X)) / (2 * X));
  const exit =
    index === JOURNEY_SECTIONS.length - 1
      ? 1
      : 1 - smooth01((p - (s.end - X)) / (2 * X));
  return clamp01(Math.min(enter, exit));
}

/**
 * Local progress within a section window, 0 at entry → 1 at exit.
 * Drives the subtle pass-through drift (panels rise as the orb travels).
 */
export function sectionLocal(p: number, index: number): number {
  const s = JOURNEY_SECTIONS[index];
  const span = Math.max(1e-9, s.end - s.start);
  return clamp01((p - s.start) / span);
}

/** Index of the visually dominant section at progress p. Ties go later. */
export function activeSectionIndex(p: number): number {
  const c = clamp01(p);
  let best = 0;
  for (let i = 0; i < JOURNEY_SECTIONS.length; i++) {
    if (c >= JOURNEY_SECTIONS[i].start - 1e-9) best = i;
  }
  return best;
}
