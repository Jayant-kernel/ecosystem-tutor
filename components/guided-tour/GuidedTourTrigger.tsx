import React from 'react';
import { useGuidedTour } from './GuidedTourContext';
import { cn } from '../../lib/utils';

interface GuidedTourTriggerProps {
  className?: string;
}

/**
 * Small unobtrusive help control that opens the tour. Sized to sit beside
 * the existing ThemeToggle in either header.
 */
const GuidedTourTrigger: React.FC<GuidedTourTriggerProps> = ({ className = '' }) => {
  const { openTour } = useGuidedTour();

  return (
    <button
      type="button"
      data-tour="tour-trigger"
      aria-label="Take the guided tour"
      title="Take the guided tour"
      onClick={(event) => openTour(event.currentTarget)}
      className={cn(
        'rounded-full transition-all duration-300 active:scale-95 border flex items-center justify-center',
        'bg-black text-white border-white/15 hover:border-orange-500/50 hover:text-orange-300',
        'size-8 p-1',
        className,
      )}
    >
      <i className="fas fa-question text-xs" aria-hidden="true"></i>
    </button>
  );
};

export default GuidedTourTrigger;
