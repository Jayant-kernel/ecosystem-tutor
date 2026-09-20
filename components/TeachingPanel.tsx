import React from 'react';

interface TeachingPanelProps {
  step: number;
  total: number;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onReplay: () => void;
  onClose: () => void;
}

/**
 * Compact step controls for an active teaching session. Rendered as a small
 * card attached to the code workspace — never a modal — reusing the
 * editor's dark palette and orange tutor accent. Purely presentational: the
 * current step in LearningView is the single source of truth.
 */
const TeachingPanel: React.FC<TeachingPanelProps> = ({
  step,
  total,
  label,
  onPrev,
  onNext,
  onReplay,
  onClose,
}) => {
  const isFirst = step <= 0;
  const isLast = step >= total - 1;
  return (
    <div
      role="region"
      aria-label={`Teaching step ${step + 1} of ${total}`}
      className="w-64 rounded-2xl border border-white/10 bg-zinc-900/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-md"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-orange-500">
          Teaching
        </span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={onReplay}
            title="Show this step again"
            aria-label="Show this step again"
            className="rounded-full px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <i className="fas fa-rotate-right" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Exit teaching"
            aria-label="Exit teaching"
            className="rounded-full px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <i className="fas fa-xmark" aria-hidden="true"></i>
          </button>
        </span>
      </div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
        Step {step + 1} / {total}
      </p>
      <p className="mb-3 text-sm font-semibold leading-snug text-white">{label}</p>
      <div className="flex items-center justify-between gap-2">
        {!isFirst ? (
          <button
            type="button"
            onClick={onPrev}
            className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-zinc-300 transition-colors hover:border-white/40 hover:text-white"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onNext}
          className="rounded-full bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-orange-500 hover:text-white"
        >
          {isLast ? 'Finish' : 'Next →'}
        </button>
      </div>
    </div>
  );
};

export default TeachingPanel;
