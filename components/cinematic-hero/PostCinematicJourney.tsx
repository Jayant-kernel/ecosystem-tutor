import { useRef } from 'react';
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { scrollTarget } from '../scroll-story/story';

/**
 * Post-cinematic slide journey. This section begins exactly where the hero
 * runway ends: the laptop film is over, and a glowing orb rolls down a
 * tall central slide as the user scrolls toward ScrollStory.
 *
 * Scroll position is the single source of truth — the section's own
 * scroll progress (same native document scroll, same framer pattern as the
 * story chapters) drives everything, so there is no second scroll system,
 * no timer, and no animation loop. Reverse scrolling retraces the path
 * exactly. The orb follows real arc length (`getPointAtLength`) and rolls
 * physically (rotation = arc / radius).
 */

const VIEW_W = 600;
const VIEW_H = 1200;

/** Desktop slide: top-center start, asymmetric S-curves, bottom-center exit. */
const PATH_DESKTOP =
  'M300,10 C310,140 480,180 470,310 ' +
  'C460,440 140,480 150,610 ' +
  'C160,740 460,780 450,910 ' +
  'C445,1010 370,1090 300,1190';

/** Mobile slide: gentler swing, same top-to-bottom journey. */
const PATH_MOBILE =
  'M300,10 C320,180 420,260 400,420 ' +
  'C380,580 220,640 240,800 ' +
  'C255,930 280,1050 300,1190';

/** Orb diameter as a fraction of the slide width (resolution-independent). */
const ORB_DIAMETER_FRACTION = 0.09;

function useSlideGeometry(
  progress: MotionValue<number>,
  desktopRef: React.RefObject<SVGPathElement | null>,
  mobileRef: React.RefObject<SVGPathElement | null>,
  orbRef: React.RefObject<HTMLDivElement | null>,
  speckleRef: React.RefObject<HTMLDivElement | null>,
): void {
  const lengthCache = useRef<{ path: SVGPathElement | null; total: number }>({ path: null, total: 0 });

  useMotionValueEvent(progress, 'change', (v) => {
    const desktop = desktopRef.current;
    const mobile = mobileRef.current;
    const orb = orbRef.current;
    // Whichever slide is laid out (desktop md+ / mobile below) owns the geometry.
    const active =
      desktop && desktop.getBoundingClientRect().width > 0 ? desktop : mobile;
    if (!active || !orb) return;
    try {
      const cached = lengthCache.current;
      if (cached.path !== active || !cached.total) {
        lengthCache.current = { path: active, total: active.getTotalLength() };
      }
      const total = lengthCache.current.total;
      if (!total) return;
      const clamped = Math.min(1, Math.max(0, v));
      const point = active.getPointAtLength(clamped * total);
      orb.style.left = `${((point.x / VIEW_W) * 100).toFixed(2)}%`;
      orb.style.top = `${((point.y / VIEW_H) * 100).toFixed(2)}%`;
      const speckle = speckleRef.current;
      if (speckle) {
        const orbRadiusUnits = (ORB_DIAMETER_FRACTION / 2) * VIEW_W;
        const rollDeg = ((clamped * total) / Math.max(1e-6, orbRadiusUnits)) * (180 / Math.PI);
        speckle.style.transform = `rotate(${rollDeg.toFixed(1)}deg)`;
      }
    } catch {
      // Geometry unavailable — orb stays parked.
    }
  });
}

function SlideTrack({
  d,
  progress,
  measureRef,
  className,
}: {
  d: string;
  progress: MotionValue<number>;
  measureRef: React.Ref<SVGPathElement>;
  className?: string;
}): JSX.Element {
  return (
    <g className={className}>
      <path d={d} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={10} strokeLinecap="round" />
      <motion.path
        ref={measureRef}
        d={d}
        fill="none"
        stroke="rgba(249,115,22,0.30)"
        strokeWidth={10}
        strokeLinecap="round"
        style={{ pathLength: progress }}
      />
      <motion.path
        d={d}
        fill="none"
        stroke="#fdba74"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.6}
        style={{ pathLength: progress }}
      />
    </g>
  );
}

export function PostCinematicJourney(): JSX.Element {
  const sectionRef = useRef<HTMLElement | null>(null);
  const desktopRef = useRef<SVGPathElement | null>(null);
  const mobileRef = useRef<SVGPathElement | null>(null);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const speckleRef = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: scrollTarget(sectionRef), offset: ['start start', 'end end'] });
  // Reduced motion: complete slide, orb parked at the start — no rolling.
  const filled = useTransform(scrollYProgress, () => 1);
  const draw = reduce ? filled : scrollYProgress;
  const parked = useTransform(scrollYProgress, () => 0);
  const orbProgress = reduce ? parked : scrollYProgress;
  useSlideGeometry(orbProgress, desktopRef, mobileRef, orbRef, speckleRef);

  return (
    <section
      ref={sectionRef}
      data-post-cinematic="journey"
      aria-label="Slide journey into the learning chapters"
      className="relative bg-black"
      style={{ height: '300vh' }}
    >
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden">
        {/*
          Exact 1:2 aspect at every viewport (height capped by width) so the
          orb's viewBox percentages always map onto the rendered box.
        */}
        <div className="relative aspect-[1/2] h-[min(100%,188vw)]" aria-hidden="true">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
            <SlideTrack d={PATH_DESKTOP} progress={draw} measureRef={desktopRef} className="hidden md:block" />
            <SlideTrack d={PATH_MOBILE} progress={draw} measureRef={mobileRef} className="md:hidden" />
          </svg>
          {/* Dimensional glowing orb with a rolling speckle marker. */}
          <div
            ref={orbRef}
            className="absolute aspect-square"
            style={{ width: `${ORB_DIAMETER_FRACTION * 100}%`, transform: 'translate(-50%, -50%)', left: '50%', top: '0.8%' }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle at 34% 30%, #fff7ed 0%, #fdba74 32%, #f97316 62%, #7c2d12 100%)',
                boxShadow:
                  '0 0 18px 4px rgba(249,115,22,0.45), 0 0 46px 12px rgba(249,115,22,0.18), 0 6px 14px rgba(0,0,0,0.5)',
              }}
            />
            <div ref={speckleRef} className="absolute inset-0">
              <div
                className="absolute rounded-full"
                style={{ width: '26%', height: '26%', left: '12%', top: '8%', background: 'rgba(124,45,18,0.55)' }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
