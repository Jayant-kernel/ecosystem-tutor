import React from 'react';

export interface TourRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GuidedTourOverlayProps {
  target: TourRect;
  /** Fade the scrim in once the first target is measured. */
  visible: boolean;
  /** The step requires a real click: pulse the ring as an affordance. */
  awaitingClick: boolean;
  reducedMotion: boolean;
}

const SPOTLIGHT_PAD = 8;
const SPOTLIGHT_RADIUS = 14;

/**
 * Fullscreen scrim with a real spotlight cutout: one SVG path covering the
 * viewport with a rounded-rect hole (evenodd) exactly over the target, so the
 * page reads as darkened *around* the highlighted element.
 */
const GuidedTourOverlay: React.FC<GuidedTourOverlayProps> = ({
  target,
  visible,
  awaitingClick,
  reducedMotion,
}) => {
  const vw = typeof window === 'undefined' ? 0 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 0 : window.innerHeight;

  const x = Math.max(0, target.x - SPOTLIGHT_PAD);
  const y = Math.max(0, target.y - SPOTLIGHT_PAD);
  const w = Math.min(vw - x, target.width + SPOTLIGHT_PAD * 2);
  const h = Math.min(vh - y, target.height + SPOTLIGHT_PAD * 2);
  const r = Math.min(SPOTLIGHT_RADIUS, w / 2, h / 2);

  // Rounded-rect subpath that becomes the hole via fill-rule="evenodd".
  const hole =
    `M ${x + r} ${y} ` +
    `H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} ` +
    `V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} ` +
    `H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} ` +
    `V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[90]"
      style={{
        opacity: visible ? 1 : 0,
        transition: reducedMotion ? 'none' : 'opacity 240ms ease-out',
      }}
    >
      <svg width={vw} height={vh} className="pointer-events-none block">
        <path
          d={`M 0 0 H ${vw} V ${vh} H 0 Z ${hole}`}
          fill="rgba(4, 4, 10, 0.68)"
          fillRule="evenodd"
          /*
           * Hit-testing follows the paint: the darkened region swallows
           * clicks (blocking unrelated controls), while the evenodd hole
           * is unpainted so the real target underneath receives the
           * user's pointer event directly. No z-index changes, no clones,
           * no synthetic clicks — stacking contexts stay untouched.
           */
          style={{ pointerEvents: 'auto' }}
        />
      </svg>
      {/* Glow ring around the cutout: shape + text label, never color alone. */}
      <div
        className="absolute rounded-2xl"
        style={{
          left: x,
          top: y,
          width: w,
          height: h,
          borderRadius: r,
          boxShadow:
            '0 0 0 2px rgba(249, 115, 22, 0.9), 0 0 28px rgba(249, 115, 22, 0.45), inset 0 0 0 1px rgba(255,255,255,0.25)',
          transition: reducedMotion
            ? 'none'
            : 'left 280ms ease-out, top 280ms ease-out, width 280ms ease-out, height 280ms ease-out',
          animation:
            awaitingClick && !reducedMotion ? 'guided-tour-ring-pulse 1.6s ease-in-out infinite' : 'none',
        }}
      />
      <style>{`@keyframes guided-tour-ring-pulse {
        0%, 100% { box-shadow: 0 0 0 2px rgba(249,115,22,0.9), 0 0 22px rgba(249,115,22,0.35), inset 0 0 0 1px rgba(255,255,255,0.25); }
        50% { box-shadow: 0 0 0 3px rgba(251,146,60,1), 0 0 40px rgba(249,115,22,0.65), inset 0 0 0 1px rgba(255,255,255,0.25); }
      }`}</style>
    </div>
  );
};

export default GuidedTourOverlay;
