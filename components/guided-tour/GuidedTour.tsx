import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGuidedTour } from './GuidedTourContext';
import GuidedTourOverlay, { type TourRect } from './GuidedTourOverlay';
import GuidedTourArrow from './GuidedTourArrow';
import GuidedTourCard from './GuidedTourCard';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import type { TourPlacement } from './guidedTourTypes';

const CARD_WIDTH = 320;
const VIEWPORT_MARGIN = 16;
const CARD_GAP = 20;
const SETTLE_POLL_MS = 90;
/** Upper bound for waiting on a target to mount after navigation. */
const WAIT_FOR_TARGET_MS = 6000;
/** How long a resolved target may be absent before the tour re-resolves. */
const ABSENCE_TOLERANCE_MS = 2000;

const PLACEMENT_ORDER: TourPlacement[] = ['bottom', 'top', 'right', 'left'];

function queryTarget(target: string): Element | null {
  return document.querySelector(`[data-tour="${target}"]`);
}

function rectOf(el: Element): TourRect {
  const rect = el.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

function isUsableRect(rect: TourRect): boolean {
  if (rect.width < 2 || rect.height < 2) return false;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // At least partly on screen.
  return rect.x < vw && rect.y < vh && rect.x + rect.width > 0 && rect.y + rect.height > 0;
}

function sameRect(a: TourRect | null, b: TourRect): boolean {
  return (
    !!a &&
    Math.abs(a.x - b.x) < 1 &&
    Math.abs(a.y - b.y) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
}

/**
 * Waits for a target to exist with a usable rect, then waits for it to
 * settle. Uses a MutationObserver plus polling — never an arbitrary
 * navigation timeout. Resolves null only when the safety bound elapses.
 */
function waitForTourTarget(target: string, reducedMotion: boolean): Promise<TourRect | null> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    let settled = false;
    let previous: TourRect | null = null;
    let observer: MutationObserver | null = null;
    let timer = 0;

    const done = (rect: TourRect | null) => {
      if (settled) return;
      settled = true;
      observer?.disconnect();
      window.clearInterval(timer);
      resolve(rect);
    };

    const check = () => {
      if (settled) return;
      const el = queryTarget(target);
      if (!el || !document.contains(el)) {
        if (Date.now() - startedAt > WAIT_FOR_TARGET_MS) done(null);
        return;
      }
      const current = rectOf(el);
      if (!isUsableRect(current)) {
        if (Date.now() - startedAt > WAIT_FOR_TARGET_MS) done(current);
        return;
      }
      if (reducedMotion) {
        done(current);
        return;
      }
      if (previous && sameRect(previous, current)) {
        done(current);
        return;
      }
      previous = current;
      if (Date.now() - startedAt > WAIT_FOR_TARGET_MS) done(current);
    };

    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(check);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    }
    timer = window.setInterval(check, SETTLE_POLL_MS);
    check();
  });
}

interface CardPosition {
  x: number;
  y: number;
  placement: TourPlacement;
}

/**
 * Chooses a card position: preferred placement first, then the first side
 * with enough room; on small screens the card becomes a bottom (or top)
 * sheet so it can never cover the target or leave the viewport.
 */
function computeCardPosition(
  target: TourRect,
  cardWidth: number,
  cardHeight: number,
  preferred: TourPlacement,
  vw: number,
  vh: number,
): CardPosition {
  const isMobile = vw < 640;
  const clampX = (x: number) => Math.min(Math.max(VIEWPORT_MARGIN, x), Math.max(VIEWPORT_MARGIN, vw - cardWidth - VIEWPORT_MARGIN));
  const clampY = (y: number) => Math.min(Math.max(VIEWPORT_MARGIN, y), Math.max(VIEWPORT_MARGIN, vh - cardHeight - VIEWPORT_MARGIN));

  if (isMobile) {
    const sheetWidth = Math.min(cardWidth, vw - VIEWPORT_MARGIN * 2);
    const x = (vw - sheetWidth) / 2;
    const spaceBelow = vh - (target.y + target.height) - CARD_GAP - VIEWPORT_MARGIN;
    if (spaceBelow >= Math.min(cardHeight, 260)) {
      return { x, y: vh - cardHeight - VIEWPORT_MARGIN, placement: 'bottom' };
    }
    return { x, y: VIEWPORT_MARGIN, placement: 'top' };
  }

  const candidates: TourPlacement[] = [
    preferred,
    ...PLACEMENT_ORDER.filter((placement) => placement !== preferred),
  ];
  for (const placement of candidates) {
    if (placement === 'bottom' && vh - (target.y + target.height) - CARD_GAP >= cardHeight) {
      return {
        x: clampX(target.x + target.width / 2 - cardWidth / 2),
        y: target.y + target.height + CARD_GAP,
        placement,
      };
    }
    if (placement === 'top' && target.y - CARD_GAP >= cardHeight) {
      return {
        x: clampX(target.x + target.width / 2 - cardWidth / 2),
        y: target.y - cardHeight - CARD_GAP,
        placement,
      };
    }
    if (placement === 'right' && vw - (target.x + target.width) - CARD_GAP >= cardWidth) {
      return {
        x: target.x + target.width + CARD_GAP,
        y: clampY(target.y + target.height / 2 - cardHeight / 2),
        placement,
      };
    }
    if (placement === 'left' && target.x - CARD_GAP >= cardWidth) {
      return {
        x: target.x - cardWidth - CARD_GAP,
        y: clampY(target.y + target.height / 2 - cardHeight / 2),
        placement,
      };
    }
  }
  // Fallback: bottom sheet, clamped — always fully on screen.
  return {
    x: clampX(target.x + target.width / 2 - cardWidth / 2),
    y: clampY(vh - cardHeight - VIEWPORT_MARGIN),
    placement: 'bottom',
  };
}

/**
 * Orchestrates the interactive walkthrough: resolves each step's target
 * (waiting across navigation when needed), scrolls it into view, then
 * positions the spotlight, card, and arrow. Interactive steps advance only
 * when the real target is clicked — the tour observes, never synthesizes.
 */
const GuidedTour: React.FC = () => {
  const {
    isOpen,
    steps,
    stepIndex,
    step,
    totalSteps,
    closeTour,
    next,
    prevPresent,
    goTo,
  } = useGuidedTour();
  const reducedMotion = usePrefersReducedMotion();
  const [targetRect, setTargetRect] = useState<TourRect | null>(null);
  const [cardPos, setCardPos] = useState<CardPosition | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const cardWrapperRef = useRef<HTMLDivElement | null>(null);
  const runIdRef = useRef(0);
  const absenceSinceRef = useRef<number | null>(null);

  const isClickStep = step?.interaction === 'click';

  const measureStep = useCallback(
    async (stepTarget: string, runId: number): Promise<boolean> => {
      const settled = await waitForTourTarget(stepTarget, reducedMotion);
      if (runId !== runIdRef.current || !settled || !isUsableRect(settled)) return false;
      const el = queryTarget(stepTarget);
      if (!el) return false;
      (el as HTMLElement).scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'center',
        inline: 'nearest',
      });
      // Re-read after scrolling; the scroll itself may still be animating.
      const afterScroll = await waitForTourTarget(stepTarget, reducedMotion);
      if (runId !== runIdRef.current || !afterScroll || !isUsableRect(afterScroll)) return false;
      setTargetRect(afterScroll);
      absenceSinceRef.current = null;
      setCardReady(false);
      return true;
    },
    [reducedMotion],
  );

  // Immediate (no-wait) presence check used for skip scans.
  const isPresent = useCallback((stepTarget: string): boolean => {
    const el = queryTarget(stepTarget);
    return !!el && isUsableRect(rectOf(el));
  }, []);

  // Resolve the current step whenever it changes or the tour opens.
  useEffect(() => {
    if (!isOpen || !step) return;
    const runId = ++runIdRef.current;
    setTargetRect(null);
    setCardPos(null);
    absenceSinceRef.current = null;
    let cancelled = false;
    const resolveWithFallback = async (index: number): Promise<void> => {
      // Full wait for the current step (covers navigation + mount).
      if (!cancelled && runId === runIdRef.current) {
        const ok = await measureStep(steps[index].target, runId);
        if (cancelled || runId !== runIdRef.current) return;
        if (ok) return;
      }
      // Otherwise jump to the nearest already-present step, forward first
      // (the tour moves ahead through the product), then backward.
      for (let i = index + 1; i < steps.length; i += 1) {
        if (cancelled || runId !== runIdRef.current) return;
        if (isPresent(steps[i].target)) {
          goTo(i);
          return;
        }
      }
      for (let i = index - 1; i >= 0; i -= 1) {
        if (cancelled || runId !== runIdRef.current) return;
        if (isPresent(steps[i].target)) {
          goTo(i);
          return;
        }
      }
      if (!cancelled && runId === runIdRef.current) closeTour();
    };
    void resolveWithFallback(stepIndex);
    return () => {
      cancelled = true;
    };
  }, [isOpen, step, stepIndex, steps, measureStep, isPresent, closeTour, goTo]);

  // Interactive steps: advance when the REAL target is clicked. Capture
  // phase so the tour observes even if the app stops propagation; the
  // application owns all behavior — default is never prevented.
  useEffect(() => {
    if (!isOpen || !step || step.interaction !== 'click') return;
    const onTargetClick = (event: Event) => {
      const el = queryTarget(step.target);
      if (el && (event.target === el || (event.target instanceof Node && el.contains(event.target)))) {
        goTo(stepIndex + 1);
      }
    };
    document.addEventListener('click', onTargetClick, { capture: true });
    return () => document.removeEventListener('click', onTargetClick, { capture: true });
  }, [isOpen, step, stepIndex, goTo]);

  // Two-pass card layout: place with an estimate, measure, then correct.
  useLayoutEffect(() => {
    if (!isOpen || !targetRect || !step) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(CARD_WIDTH, vw - VIEWPORT_MARGIN * 2);
    const estimatedHeight = cardRef.current?.offsetHeight || 240;
    setCardPos((previous) => {
      const nextPos = computeCardPosition(targetRect, width, estimatedHeight, step.placement, vw, vh);
      if (
        previous &&
        Math.abs(previous.x - nextPos.x) < 0.5 &&
        Math.abs(previous.y - nextPos.y) < 0.5 &&
        previous.placement === nextPos.placement
      ) {
        return previous;
      }
      return nextPos;
    });
    // After paint with a real measurement, mark ready (enables the arrow).
    const frame = requestAnimationFrame(() => setCardReady(true));
    return () => cancelAnimationFrame(frame);
  }, [isOpen, targetRect, step]);

  // Keep the spotlight glued to the target on scroll / resize / layout
  // shifts. If the target stays absent (modal closed, panel toggled),
  // re-resolve backward-first so Back-like recovery happens automatically.
  useEffect(() => {
    if (!isOpen || !step) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = queryTarget(step.target);
        if (!el || !isUsableRect(rectOf(el))) {
          if (absenceSinceRef.current === null) {
            absenceSinceRef.current = Date.now();
          } else if (Date.now() - absenceSinceRef.current > ABSENCE_TOLERANCE_MS) {
            absenceSinceRef.current = null;
            const runId = ++runIdRef.current;
            // Nearest present step, backward first (return to where we
            // came from), then forward — no waiting, instant scan.
            void (async () => {
              for (let i = stepIndex - 1; i >= 0; i -= 1) {
                if (runId !== runIdRef.current) return;
                if (isPresent(steps[i].target)) {
                  goTo(i);
                  return;
                }
              }
              for (let i = stepIndex + 1; i < steps.length; i += 1) {
                if (runId !== runIdRef.current) return;
                if (isPresent(steps[i].target)) {
                  goTo(i);
                  return;
                }
              }
              if (runId === runIdRef.current) closeTour();
            })();
          }
          return;
        }
        absenceSinceRef.current = null;
        const rect = rectOf(el);
        setTargetRect((previous) => (sameRect(previous, rect) ? previous : rect));
      });
    };
    window.addEventListener('scroll', update, { capture: true, passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update, { capture: true } as AddEventListenerOptions);
      window.removeEventListener('resize', update);
    };
  }, [isOpen, step, stepIndex, steps, isPresent, goTo, closeTour]);

  // Escape closes the tour; focus moves into the card on each step.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeTour();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeTour]);

  useEffect(() => {
    if (!isOpen || !targetRect) return;
    // Focus the card wrapper so screen readers land on the step content.
    cardWrapperRef.current?.focus({ preventScroll: true });
  }, [isOpen, targetRect, stepIndex]);

  if (!isOpen || !step || typeof document === 'undefined') return null;

  // Back is only offered when an earlier step's target exists right now —
  // it can never strand the spotlight on a missing element.
  let canGoBack = false;
  if (stepIndex > 0 && typeof document !== 'undefined') {
    for (let i = stepIndex - 1; i >= 0; i -= 1) {
      if (queryTarget(steps[i].target)) {
        canGoBack = true;
        break;
      }
    }
  }

  const cardRect: TourRect | null =
    cardPos && cardRef.current
      ? {
          x: cardPos.x,
          y: cardPos.y,
          width: cardRef.current.offsetWidth,
          height: cardRef.current.offsetHeight,
        }
      : null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[90]">
      {targetRect && (
        <GuidedTourOverlay
          target={targetRect}
          visible={cardReady}
          awaitingClick={isClickStep}
          reducedMotion={reducedMotion}
        />
      )}
      {targetRect && cardRect && cardReady && (
        <GuidedTourArrow from={cardRect} to={targetRect} reducedMotion={reducedMotion} />
      )}
      {targetRect && cardPos && (
        <div
          ref={cardWrapperRef}
          tabIndex={-1}
          className="pointer-events-none fixed z-[93] outline-none"
          style={{
            left: cardPos.x,
            top: cardPos.y,
            opacity: cardReady ? 1 : 0,
            transition: reducedMotion ? 'none' : 'left 280ms ease-out, top 280ms ease-out, opacity 200ms ease-out',
          }}
        >
          <GuidedTourCard
            ref={cardRef}
            title={step.title}
            description={step.description}
            stepNumber={stepIndex + 1}
            totalSteps={totalSteps}
            isLast={stepIndex >= totalSteps - 1}
            canGoBack={canGoBack}
            mode={isClickStep ? 'click' : 'next'}
            reducedMotion={reducedMotion}
            nextButtonRef={nextButtonRef}
            onNext={next}
            onPrev={prevPresent}
            onSkip={closeTour}
          />
        </div>
      )}
    </div>,
    document.body,
  );
};

export default GuidedTour;
