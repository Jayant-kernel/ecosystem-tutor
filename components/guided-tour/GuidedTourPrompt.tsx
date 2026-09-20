import React, { useState } from 'react';
import { useGuidedTour, TOUR_PROMPT_DISMISSED_KEY, hasTourFlag } from './GuidedTourContext';

/**
 * One-time, dismissible first-visit offer. Never auto-launches the tour —
 * it simply invites the user to start it. Dismissal is persisted separately
 * from completion so the Navbar control can always restart the tour.
 */
const GuidedTourPrompt: React.FC = () => {
  const { isOpen, isFirstVisit, openTour, dismissPrompt } = useGuidedTour();
  const [dismissed, setDismissed] = useState<boolean>(() => hasTourFlag(TOUR_PROMPT_DISMISSED_KEY));

  if (isOpen || !isFirstVisit || dismissed) return null;

  const onDismiss = () => {
    dismissPrompt();
    setDismissed(true);
  };

  return (
    <div
      role="status"
      className="fixed bottom-5 right-5 z-[80] w-[300px] max-w-[calc(100vw-40px)] rounded-2xl border border-white/10 bg-zinc-950/90 p-4 shadow-[0_24px_64px_rgba(0,0,0,0.6)] backdrop-blur-xl"
    >
      <p className="mb-1 font-manrope text-sm font-bold text-white">New to Ecosystem?</p>
      <p className="mb-3 text-xs leading-relaxed text-zinc-400">
        Take a 1-minute guided tour of the most important controls.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(event) => openTour(event.currentTarget)}
          className="flex-1 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        >
          Take the tour
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss the tour invitation"
          className="rounded-xl border border-white/10 px-3 py-2 text-[11px] font-bold text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          Later
        </button>
      </div>
    </div>
  );
};

export default GuidedTourPrompt;
