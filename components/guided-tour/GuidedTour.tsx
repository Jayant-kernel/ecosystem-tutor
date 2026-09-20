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
const SETTLE_TIMEOUT_MS = 1400;

const PLACEMENT_ORDER: TourPlacement[] = ['bottom', 'top', 'right', 'left'];

function rectOf(el: Element): TourRect {
  const rect = el.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
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
 * Waits until the target stops moving (two identical reads) or the timeout
 * elapses, then returns a fresh rect. Never positions from stale coordinates.
 */
function waitForSettledRect(el: Element, reducedMotion: boolean): Promise<TourRect | null> {
  return new Promise((resolve) => {
    if (reducedMotion) {
      resolve(rectOf(el));
      return;
    }
    const startedAt = Date.now();
    let previous: TourRect | null = null;
    const poll = () => {
      if (!document.contains(el)) {
        resolve(null);
        return;
      }
      const current = rectOf(el);
      if (previous && sameRect(previous, current)) {
        resolve(current);
        return;
      }
      previous = current;
      if (Date.now() - startedAt > SETTLE_TIMEOUT_MS) {
        resolve(current);
        return;
      }
      window.setTimeout(poll, SETTLE_POLL_MS);
    };
    poll();
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
 * Orchestrates the tour: resolves each step's target, scrolls it into view,
 * waits for it to settle, then positions the spotlight, card, and arrow.
 */
const GuidedTour: React.FC = () => {
  const { isOpen, steps, stepIndex, step, totalSteps, closeTour, next, prev, goTo } = useGuidedTour();
  const reducedMotion = usePrefersReducedMotion();
  const [targetRect, setTargetRect] = useState<TourRect | null>(null);
  const [cardPos, setCardPos] = useState<CardPosition | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const cardWrapperRef = useRef<HTMLDivElement | null>(null);
  const runIdRef = useRef(0);

  const measureStep = useCallback(
    async (stepTarget: string, runId: number) => {
      const el = document.querySelector(`[data-tour="${stepTarget}"]`);
      if (!el) return false;
      (el as HTMLElement).scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'center',
        inline: 'nearest',
      });
      const settled = await waitForSettledRect(el, reducedMotion);
      if (runId !== runIdRef.current || !settled) return false;
      // Guard against zero-area or fully off-screen targets.
      if (settled.width < 2 || settled.height < 2) return false;
      setTargetRect(settled);
      setCardReady(false);
      return true;
    },
    [reducedMotion],
  );

  // Resolve the current step whenever it changes or the tour opens.
  useEffect(() => {
    if (!isOpen || !step) return;
    const runId = ++runIdRef.current;
    setTargetRect(null);
    setCardPos(null);
    let cancelled = false;
    // Skip steps whose target vanished (e.g. view changed mid-tour).
    const resolveWithFallback = async (index: number): Promise<void> => {
      for (let i = index; i < steps.length; i += 1) {
        if (cancelled || runId !== runIdRef.current) return;
        const ok = await measureStep(steps[i].target, runId);
        if (cancelled || runId !== runIdRef.current) return;
        if (ok) {
          if (i !== index) goTo(i);
          return;
        }
      }
      if (!cancelled && runId === runIdRef.current) closeTour();
    };
    void resolveWithFallback(stepIndex);
    return () => {
      cancelled = true;
    };
  }, [isOpen, step, stepIndex, steps, measureStep, closeTour, goTo]);

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

  // Keep the spotlight glued to the target on scroll / resize / layout shifts.
  useEffect(() => {
    if (!isOpen || !step) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = document.querySelector(`[data-tour="${step.target}"]`);
        if (!el) return;
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
  }, [isOpen, step]);

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
    <div className="fixed inset-0 z-[90]">
      {targetRect && (
        <GuidedTourOverlay target={targetRect} visible={cardReady} reducedMotion={reducedMotion} />
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
            canGoBack={stepIndex > 0}
            reducedMotion={reducedMotion}
            nextButtonRef={nextButtonRef}
            onNext={next}
            onPrev={prev}
            onSkip={closeTour}
          />
        </div>
      )}
    </div>,
    document.body,
  );
};

export default GuidedTour;
