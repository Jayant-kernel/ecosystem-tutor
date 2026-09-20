import React from 'react';
import type { TourRect } from './GuidedTourOverlay';

interface GuidedTourArrowProps {
  from: TourRect;
  to: TourRect;
  reducedMotion: boolean;
}

interface Anchor {
  x: number;
  y: number;
}

/** Midpoint of the card edge that faces the target. */
function cardAnchor(card: TourRect, target: TourRect): Anchor {
  const cx = card.x + card.width / 2;
  const cy = card.y + card.height / 2;
  const tx = target.x + target.width / 2;
  const ty = target.y + target.height / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { x: card.x + card.width, y: cy }
      : { x: card.x, y: cy };
  }
  return dy >= 0
    ? { x: cx, y: card.y + card.height }
    : { x: cx, y: card.y };
}

/** Point on the target edge nearest the card. */
function targetAnchor(card: TourRect, target: TourRect): Anchor {
  const cx = card.x + card.width / 2;
  const cy = card.y + card.height / 2;
  const tx = target.x + target.width / 2;
  const ty = target.y + target.height / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { x: target.x, y: Math.min(Math.max(cy, target.y + 6), target.y + target.height - 6) }
      : { x: target.x + target.width, y: Math.min(Math.max(cy, target.y + 6), target.y + target.height - 6) };
  }
  return dy >= 0
    ? { x: Math.min(Math.max(cx, target.x + 6), target.x + target.width - 6), y: target.y }
    : { x: Math.min(Math.max(cx, target.x + 6), target.x + target.width - 6), y: target.y + target.height };
}

/**
 * Minimal SVG pointer from the explanation card to the target. Both
 * endpoints derive from live rects — nothing is hardcoded per step.
 */
const GuidedTourArrow: React.FC<GuidedTourArrowProps> = ({ from, to, reducedMotion }) => {
  const vw = typeof window === 'undefined' ? 0 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 0 : window.innerHeight;
  const start = cardAnchor(from, to);
  const end = targetAnchor(from, to);

  // Gentle curve: control point pulled perpendicular for an elegant arc.
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const bend = Math.min(48, len * 0.18);
  const cx = mx + (-dy / len) * bend;
  const cy = my + (dx / len) * bend;

  // Stop the tip just short of the glow ring so it never covers the target.
  const tipPullback = 12;
  const t = Math.max(0, (len - tipPullback) / len);
  const qx = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * cx + t * t * end.x;
  const qy = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * cy + t * t * end.y;

  return (
    <svg
      aria-hidden="true"
      width={vw}
      height={vh}
      className="pointer-events-none fixed inset-0 z-[92]"
      style={{
        opacity: 1,
        transition: reducedMotion ? 'none' : 'opacity 200ms ease-out',
      }}
    >
      <defs>
        <marker
          id="guided-tour-arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="6.5"
          refY="4"
          orient="auto"
        >
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="#fb923c" />
        </marker>
      </defs>
      <path
        d={`M ${start.x} ${start.y} Q ${cx} ${cy} ${qx} ${qy}`}
        fill="none"
        stroke="#fb923c"
        strokeWidth={2.5}
        strokeLinecap="round"
        markerEnd="url(#guided-tour-arrowhead)"
        style={
          reducedMotion
            ? undefined
            : { strokeDasharray: 6, animation: 'guided-tour-dash 1.2s linear infinite' }
        }
      />
      <style>{`@keyframes guided-tour-dash { to { stroke-dashoffset: -12; } }`}</style>
    </svg>
  );
};

export default GuidedTourArrow;
