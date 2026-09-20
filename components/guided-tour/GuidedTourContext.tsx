import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { TOUR_STEPS } from './guidedTourSteps';
import type { GuidedTourStep } from './guidedTourTypes';

export const TOUR_COMPLETED_KEY = 'ecosystem-guided-tour-completed';
export const TOUR_PROMPT_DISMISSED_KEY = 'ecosystem-guided-tour-prompt-dismissed';

const readFlag = (key: string): boolean => {
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
};

const writeFlag = (key: string): void => {
  try {
    window.localStorage.setItem(key, 'true');
  } catch {
    /* private mode etc. — tour still works, it just won't persist */
  }
};

/** Steps whose target element exists in the current view, in catalog order. */
export function resolveTourSteps(): GuidedTourStep[] {
  if (typeof document === 'undefined') return [];
  return TOUR_STEPS.filter((step) =>
    document.querySelector(`[data-tour="${step.target}"]`),
  );
}

interface GuidedTourContextValue {
  isOpen: boolean;
  steps: GuidedTourStep[];
  stepIndex: number;
  step: GuidedTourStep | null;
  totalSteps: number;
  isFirstVisit: boolean;
  openTour: (opener?: HTMLElement | null) => void;
  /** Close and persist completion (used by skip, finish, and Escape). */
  closeTour: () => void;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  /**
   * Step back to the nearest previous step whose target exists in the
   * current DOM. Never navigates — if no earlier target is present, this
   * is a no-op so Back can never strand the spotlight.
   */
  prevPresent: () => void;
  dismissPrompt: () => void;
}

const GuidedTourContext = createContext<GuidedTourContextValue | null>(null);

export const GuidedTourProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [steps, setSteps] = useState<GuidedTourStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [isFirstVisit, setIsFirstVisit] = useState<boolean>(() => !readFlag(TOUR_COMPLETED_KEY));
  const openerRef = useRef<HTMLElement | null>(null);

  const openTour = useCallback((opener?: HTMLElement | null) => {
    const resolved = resolveTourSteps();
    if (resolved.length === 0) return;
    openerRef.current = opener ?? null;
    setSteps(resolved);
    setStepIndex(0);
    setIsOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
    writeFlag(TOUR_COMPLETED_KEY);
    setIsFirstVisit(false);
    // Return focus to whatever opened the tour, when possible.
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener && document.contains(opener)) {
      opener.focus({ preventScroll: true });
    }
  }, []);

  const next = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      // Final step: finishing persists completion and closes.
      writeFlag(TOUR_COMPLETED_KEY);
      setIsFirstVisit(false);
      setIsOpen(false);
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
      return;
    }
    setStepIndex(stepIndex + 1);
  }, [stepIndex, steps.length]);

  const prev = useCallback(() => {
    setStepIndex((index) => Math.max(0, index - 1));
  }, []);

  const goTo = useCallback(
    (index: number) => {
      setStepIndex(Math.min(Math.max(0, index), Math.max(0, steps.length - 1)));
    },
    [steps.length],
  );

  const prevPresent = useCallback(() => {
    setStepIndex((index) => {
      for (let i = index - 1; i >= 0; i -= 1) {
        if (document.querySelector(`[data-tour="${steps[i].target}"]`)) return i;
      }
      return index;
    });
  }, [steps]);

  const dismissPrompt = useCallback(() => {
    writeFlag(TOUR_PROMPT_DISMISSED_KEY);
    // Re-render consumers that gate on the prompt key.
    setIsFirstVisit((value) => value);
  }, []);

  const value = useMemo<GuidedTourContextValue>(
    () => ({
      isOpen,
      steps,
      stepIndex,
      step: steps[stepIndex] ?? null,
      totalSteps: steps.length,
      isFirstVisit,
      openTour,
      closeTour,
      next,
      prev,
      goTo,
      prevPresent,
      dismissPrompt,
    }),
    [isOpen, steps, stepIndex, isFirstVisit, openTour, closeTour, next, prev, goTo, prevPresent, dismissPrompt],
  );

  return <GuidedTourContext.Provider value={value}>{children}</GuidedTourContext.Provider>;
};

export function useGuidedTour(): GuidedTourContextValue {
  const context = useContext(GuidedTourContext);
  if (!context) throw new Error('useGuidedTour must be used within GuidedTourProvider');
  return context;
}

export function hasTourFlag(key: string): boolean {
  return readFlag(key);
}
