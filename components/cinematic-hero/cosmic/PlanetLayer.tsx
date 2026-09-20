import { forwardRef } from 'react';

/**
 * Fake 2.5D planet: an oversized disc, mostly below the viewport, showing only
 * its curved upper horizon behind the hero. Marble texture, rim light and halo
 * are layered gradients — no 3D, no textures to download. The outer wrapper's
 * opacity/transform is written by CosmicScene from the master progress; the
 * inner drift is a pure CSS ambient animation (never fights the JS transform).
 */
const PlanetLayer = forwardRef<HTMLDivElement>(function PlanetLayer(_, ref) {
  return (
    <div ref={ref} className="absolute inset-0" style={{ opacity: 0, visibility: 'hidden' }}>
      {/* Atmospheric halo outside the disc, centered on the horizon. */}
      <div
        aria-hidden="true"
        className="planet-halo absolute left-1/2"
        style={{
          top: 'calc(68% + 75vw)',
          width: '130vw',
          height: '130vw',
          transform: 'translate(-50%, -50%)',
          animation: 'planet-breathe 26s ease-in-out infinite',
          background:
            'radial-gradient(circle, rgba(124,58,237,0.22) 0%, rgba(76,29,149,0.1) 42%, transparent 62%)',
          filter: 'blur(40px)',
        }}
      />
      {/* The disc itself: 150vw circle whose top arc lands at ~64% height. */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 overflow-hidden"
        style={{
          top: 'calc(68% + 75vw)',
          width: '150vw',
          height: '150vw',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 50% 18%, rgba(221,214,254,0.5) 0%, rgba(168,85,247,0.28) 12%, rgba(76,29,149,0.35) 30%, #1a0530 58%, #05020b 78%)',
          boxShadow:
            'inset 0 34px 90px -18px rgba(221,214,254,0.55), inset 0 -120px 160px -40px rgba(0,0,0,0.9)',
        }}
      >
        {/* Marble swirls, clipped to the disc, softly blurred. */}
        <div
          className="planet-marble absolute inset-0"
          style={{
            borderRadius: '50%',
            filter: 'blur(28px)',
            opacity: 0.75,
            background:
              'repeating-conic-gradient(from 200deg at 42% 30%, rgba(124,58,237,0.35) 0deg 14deg, transparent 14deg 34deg, rgba(192,38,211,0.22) 34deg 44deg, transparent 44deg 70deg),' +
              'repeating-conic-gradient(from 20deg at 62% 26%, rgba(221,214,254,0.16) 0deg 10deg, transparent 10deg 30deg),' +
              'radial-gradient(circle at 50% 22%, rgba(255,255,255,0.22) 0%, transparent 26%)',
          }}
        />
        {/* Bright white-violet rim hugging the upper edge. */}
        <div
          className="absolute left-0 right-0 top-0"
          style={{
            height: '12%',
            borderRadius: '50%',
            filter: 'blur(7px)',
            background:
              'radial-gradient(ellipse 52% 100% at 50% 0%, rgba(255,255,255,0.75) 0%, rgba(221,214,254,0.4) 34%, transparent 68%)',
          }}
        />
        {/* Dark lower half swallowing the curve. */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: '50%',
            background: 'linear-gradient(to bottom, transparent 38%, rgba(3,1,6,0.55) 62%, rgba(3,1,6,0.96) 82%)',
          }}
        />
      </div>
    </div>
  );
});

export default PlanetLayer;
