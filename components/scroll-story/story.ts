/**
 * Shared tokens and scroll-target helper. Previously also held the
 * four-chapter ScrollStory copy and station math; the story sections were
 * removed from the landing page, so only what PostCinematicJourney still
 * imports remains: the handoff background token and the scroll-target
 * adapter. Semantics of both are unchanged.
 */
import type { MutableRefObject } from 'react';
import type { UseScrollOptions } from 'framer-motion';

/** Handoff background token used by the post-cinematic journey veil. */
export const STORY = {
  bg: '#F4F3EE',
} as const;

/**
 * Adapts a section element ref to Framer Motion v13's scroll-target type.
 * Same role as the cinematic hero's `runwayRef` (an `HTMLElement` ref bound
 * to a `<section>`), kept behind this helper so chapters never fight the
 * motion library's own `RefObject` flavor.
 */
export function scrollTarget(ref: MutableRefObject<HTMLElement | null>): UseScrollOptions['target'] {
  return ref as unknown as UseScrollOptions['target'];
}
