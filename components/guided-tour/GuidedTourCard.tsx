import React, { forwardRef } from 'react';

interface GuidedTourCardProps {
  title: string;
  description: string;
  stepNumber: number;
  totalSteps: number;
  isLast: boolean;
  canGoBack: boolean;
  /** 'click' steps require the real target interaction — Next is replaced. */
  mode: 'next' | 'click';
  reducedMotion: boolean;
  nextButtonRef: React.RefObject<HTMLButtonElement>;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

/**
 * Compact explanation card. Styled to match Ecosystem: dark glass surface,
 * orange primary action, zinc secondary controls, strong text contrast.
 */
const GuidedTourCard = forwardRef<HTMLDivElement, GuidedTourCardProps>(
  (
    {
      title,
      description,
      stepNumber,
      totalSteps,
      isLast,
      canGoBack,
      mode,
      reducedMotion,
      nextButtonRef,
      onNext,
      onPrev,
      onSkip,
    },
    ref,
  ) => {
    const describedById = 'guided-tour-card-description';
    return (
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`Guided tour: ${title}`}
        aria-describedby={describedById}
        tabIndex={-1}
        className="pointer-events-auto w-[320px] max-w-[calc(100vw-32px)] rounded-2xl border border-white/10 bg-zinc-950/90 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] backdrop-blur-xl outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        style={{
          transition: reducedMotion ? 'none' : 'left 280ms ease-out, top 280ms ease-out',
        }}
      >
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400">
            Guided tour
          </p>
          <p
            aria-live="polite"
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-zinc-300"
          >
            {stepNumber} / {totalSteps}
          </p>
        </div>
        <h2 className="mb-1.5 font-manrope text-lg font-bold text-white">{title}</h2>
        <p id={describedById} className="mb-4 text-sm leading-relaxed text-zinc-300">
          {description}
        </p>
        <div className="flex items-center gap-2">
          {canGoBack && (
            <button
              type="button"
              onClick={onPrev}
              aria-label="Go to previous tour step"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-bold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              Back
            </button>
          )}
          {mode === 'click' ? (
            <p
              aria-live="polite"
              className="flex flex-1 items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2.5 text-xs font-bold text-orange-200"
            >
              <span aria-hidden="true" className="relative flex h-2 w-2 flex-shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75 motion-safe:animate-ping"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-400"></span>
              </span>
              Click the highlighted control to continue
            </p>
          ) : (
            <button
              ref={nextButtonRef}
              type="button"
              onClick={onNext}
              className="flex-1 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              {isLast ? 'Finish Tour' : 'Next'}
            </button>
          )}
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip the guided tour"
            className="rounded-xl border border-white/10 bg-transparent px-3 py-2.5 text-xs font-bold text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            Skip Tour
          </button>
        </div>
      </div>
    );
  },
);

GuidedTourCard.displayName = 'GuidedTourCard';

export default GuidedTourCard;
