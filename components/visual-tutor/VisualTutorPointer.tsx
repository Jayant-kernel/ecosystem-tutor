import { motion, useReducedMotion } from 'framer-motion';
import VirtualTeachingHand from '../VirtualTeachingHand';
import type { VisualPosition } from './layout';

export type HandPhase =
  | { kind: 'idle' }
  | { kind: 'travel'; to: VisualPosition }
  | { kind: 'visible'; at: VisualPosition };

interface PointerProps {
  hand: HandPhase;
  effect: 'grab' | 'point';
  /** Fired when the hand finishes travelling to its target. */
  onArrive: () => void;
}

/** The hand's pixel coordinates when parked outside the canvas (staging palette). */
export const PARKED_POSITION: VisualPosition = { x: -170, y: -120 };

/**
 * The tutor's virtual hand: a visual-only overlay that glides between the
 * real rendered React Flow node rectangles. It never intercepts input and
 * never touches the operating-system cursor.
 */
export default function VisualTutorPointer({ hand, effect, onArrive }: PointerProps) {
  const prefersReduced = useReducedMotion();
  const visible = hand.kind !== 'idle';
  const target = hand.kind === 'travel' ? hand.to : hand.kind === 'visible' ? hand.at : PARKED_POSITION;
  const grabbing = effect === 'grab' && hand.kind !== 'travel';

  return (
    <div className="visual-tutor-pointer-layer" aria-hidden="true">
      <motion.div
        className={`visual-tutor-pointer ${grabbing ? 'is-grabbing' : ''}`}
        initial={false}
        animate={{
          left: target.x,
          top: target.y,
          opacity: visible ? 1 : 0,
          scale: hand.kind === 'travel' ? 0.94 : 1,
        }}
        onAnimationComplete={() => {
          if (hand.kind === 'travel') onArrive();
        }}
        transition={
          prefersReduced
            ? { duration: 0 }
            : { type: 'spring', stiffness: 58, damping: 19, mass: 0.9 }
        }
      >
        <span className="visual-tutor-pointer__hand">
          <VirtualTeachingHand size={44} />
        </span>
        <span className="visual-tutor-pointer__spark" />
        <span className="visual-tutor-pointer__trail" />
      </motion.div>
    </div>
  );
}
