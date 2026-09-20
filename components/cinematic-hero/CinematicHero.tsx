import React, { Suspense, useEffect, useRef, useState } from 'react';
import Overlay from './Overlay';
import CosmicScene from './cosmic/CosmicScene';
import { TIMELINE } from './timeline';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { useScrollTimeline } from './useScrollTimeline';
import type { VoiceScreenContent } from './scene/VoiceScreen';

const CinematicCanvas = React.lazy(() => import('./CinematicCanvas'));

interface CinematicHeroProps {
  navigateTo: (view: 'courses') => void;
  screenContent?: VoiceScreenContent;
}

/**
 * Landing hero: a scroll-controlled film. Native scroll drives a normalized
 * timeline; the 3D canvas only mounts near the viewport, renders on demand,
 * and unmounts with the route. Reduced motion gets a static, WebGL-free hero.
 */
const CinematicHero: React.FC<CinematicHeroProps> = ({ navigateTo, screenContent }) => {
  const runwayRef = useRef<HTMLElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [heroNear, setHeroNear] = useState(false);
  useScrollTimeline(runwayRef, reducedMotion);

  useEffect(() => {
    if (reducedMotion) return;
    const el = runwayRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setHeroNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHeroNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '600px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <section
        aria-label="Ecosystem intro"
        className="relative flex min-h-screen items-center justify-center bg-black px-6 py-24 text-center"
      >
        {/* Settled cosmic poster behind the static reduced-motion hero. */}
        <CosmicScene />
        <div className="relative z-10 max-w-3xl">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            Ecosystem
          </p>
          <h1 className="quantum-hero-title mb-6 font-quantum text-3xl font-normal leading-[1.3] tracking-[0.055em] text-violet-50 md:text-5xl">
            Learn to code with your voice.
          </h1>
          <p className="mb-8 text-lg text-zinc-400">
            Reduced motion is enabled, so the cinematic camera is off. Scroll normally to explore the course.
          </p>
          <button
            type="button"
            onClick={() => navigateTo('courses')}
            className="rounded-full bg-white px-8 py-4 text-sm font-bold uppercase tracking-widest text-black transition-colors hover:bg-orange-500 hover:text-white"
          >
            Start Learning Free
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={runwayRef}
      data-cinematic-hero="runway"
      aria-label="Cinematic laptop introduction"
      className="relative"
      style={{ height: `${TIMELINE.runwayViewportHeights * 100}vh` }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-black">
        <div className="absolute inset-0">
          {heroNear ? (
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center bg-black text-xs uppercase tracking-[0.25em] text-zinc-600">
                  Preparing camera
                </div>
              }
            >
              <CinematicCanvas screenContent={screenContent} />
            </Suspense>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black text-xs uppercase tracking-[0.25em] text-zinc-600">
              Preparing camera
            </div>
          )}
        </div>
        <Overlay navigateTo={navigateTo} />
        {/* The DOM layer supplies the soft nebula, dust and twinkling while the
            real Earth and asteroids stay inside the original R3F canvas. */}
        <CosmicScene />
      </div>
    </section>
  );
};

export default CinematicHero;
