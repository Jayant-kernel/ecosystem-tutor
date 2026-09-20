/** Preferred card placement relative to the highlighted target. */
export type TourPlacement = 'top' | 'bottom' | 'left' | 'right';

/**
 * One data-driven tour step. `target` is the value of a stable `data-tour`
 * attribute in the DOM — never a fragile nested CSS selector.
 */
export interface GuidedTourStep {
  id: string;
  /** Matches `[data-tour="<target>"]` in the document. */
  target: string;
  title: string;
  description: string;
  placement: TourPlacement;
}

export interface GuidedTourState {
  isOpen: boolean;
  /** Index into the resolved (on-screen) step list. */
  stepIndex: number;
}
