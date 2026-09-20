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
  /**
   * How the step advances.
   * - `next`: passive — the user reads and clicks Next.
   * - `click`: interactive — the user MUST click the highlighted target
   *   itself; Next is replaced by an instruction and the tour advances when
   *   the real target interaction is observed. The tour never synthesizes
   *   clicks; the application owns its behavior.
   */
  interaction?: 'next' | 'click';
}

export interface GuidedTourState {
  isOpen: boolean;
  /** Index into the resolved (on-screen) step list. */
  stepIndex: number;
}
