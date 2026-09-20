import { useEffect, useRef } from 'react';
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { scrollTarget, STORY } from '../scroll-story/story';

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
 *
 * Handoff model: orb progress maps 1:1 to section progress (p=1 → orb at
 * the path's bottom-center exit), the camera pans linearly with the same
 * progress (top of track at p=0, bottom at p=1 — no stall zones), and a
 * restrained veil blends the black stage into the story background over the
 * final stretch. Chapter 01's path enters top-center, so the two read as
 * one continuous track with essentially zero dead scroll.
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

/**
 * Camera zoom applied to the slide track inside the sticky viewport. The
 * track keeps its exact 1:2 aspect (so orb viewBox percentages stay valid);
 * scaling it up gives the sticky stage real coverage overflow to pan within,
 * which is what makes the viewport reveal the journey instead of showing the
 * whole slide shrunk at once. Purely relative — no viewport pixel constants.
 */
const CAMERA_ZOOM = 1.6;
/**
 * Handoff veil: the last stretch of scroll blends the black stage toward the
 * story background so Chapter 01 doesn't arrive as a hard black/white cut.
 * Restrained single gradient, scroll-driven, fully reversible. Capped below
 * full opacity so the orb stays visible as it sinks into the light — the
 * actual story background takes over exactly at the section boundary.
 */
const VEIL_START = 0.78;
const VEIL_END = 0.97;
const VEIL_MAX = 0.88;

interface SlideRefs {
  desktop: React.RefObject<SVGPathElement | null>;
  mobile: React.RefObject<SVGPathElement | null>;
  orb: React.RefObject<HTMLDivElement | null>;
  speckle: React.RefObject<HTMLDivElement | null>;
  stage: React.RefObject<HTMLDivElement | null>;
  track: React.RefObject<HTMLDivElement | null>;
}

function applyCamera(refs: SlideRefs, progress: number, fx: number): void {
  const track = refs.track.current;
  const stage = refs.stage.current;
  if (!track || !stage) return;
  // Layout (untransformed) sizes — measured at runtime so every viewport and
  // both slide geometries behave identically with no hardcoded coordinates.
  const trackW = track.offsetWidth;
  const trackH = track.offsetHeight;
  const stageW = stage.clientWidth;
  const stageH = stage.clientHeight;
  if (!trackW || !trackH || !stageW || !stageH) return;
  const scaledW = trackW * CAMERA_ZOOM;
  const scaledH = trackH * CAMERA_ZOOM;
  // Coverage overflow is the only pan budget: the scaled track must always
  // cover the stage, so clamp the pan to ±(scaled - stage)/2 on each axis.
  const maxPanX = Math.max(0, (scaledW - stageW) / 2);
  const maxPanY = Math.max(0, (scaledH - stageH) / 2);
  const p = Math.min(1, Math.max(0, progress));
  // Vertical pan is a strict linear function of section progress: top of the
  // track at p=0, bottom at p=1. No clamp saturation mid-range, so EVERY
  // scroll increment visibly moves the composition — no frozen intervals.
  // The orb still rides real arc length, so it drifts within the moving
  // window and stays readable throughout.
  const ty = maxPanY * (1 - 2 * p);
  // Horizontal: gentle focal tracking of the orb's x-swing, clamped to
  // coverage (zero on wide viewports where the scaled track is narrower).
  const wantX = -(fx - 0.5) * scaledW;
  const tx = Math.min(maxPanX, Math.max(-maxPanX, wantX));
  track.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${CAMERA_ZOOM})`;
}

function useSlideGeometry(
  progress: MotionValue<number>,
  refs: SlideRefs,
): void {
  const lengthCache = useRef<{ path: SVGPathElement | null; total: number }>({ path: null, total: 0 });
  const lastV = useRef(0);
  const renderRef = useRef<(v: number) => void>(() => {});

  const render = (v: number): void => {
    lastV.current = v;
    const desktop = refs.desktop.current;
    const mobile = refs.mobile.current;
    const orb = refs.orb.current;
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
      const fx = point.x / VIEW_W;
      const fy = point.y / VIEW_H;
      orb.style.left = `${(fx * 100).toFixed(2)}%`;
      orb.style.top = `${(fy * 100).toFixed(2)}%`;
      orb.style.top = `${(fy * 100).toFixed(2)}%`;
      const speckle = refs.speckle.current;
      if (speckle) {
        const orbRadiusUnits = (ORB_DIAMETER_FRACTION / 2) * VIEW_W;
        const rollDeg = ((clamped * total) / Math.max(1e-6, orbRadiusUnits)) * (180 / Math.PI);
        speckle.style.transform = `rotate(${rollDeg.toFixed(1)}deg)`;
      }
      // Same scroll input re-maps the track into the sticky viewport: the
      // stage pans linearly with progress so the orb stays readable instead
      // of drifting outside the useful viewport.
      applyCamera(refs, clamped, fx);
    } catch {
      // Geometry unavailable — orb stays parked.
    }
  };

  useMotionValueEvent(progress, 'change', render);
  renderRef.current = render;

  // Resize/orientation change without scrolling would leave a stale camera
  // transform (sizes changed, progress didn't) — re-render from last progress.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = (): void => {
      renderRef.current(lastV.current);
    };
    window.addEventListener('resize', onResize);
    // Initial camera park: orb at the top reads against the journey start.
    const raf = window.requestAnimationFrame(() => renderRef.current(lastV.current));
    return () => {
      window.removeEventListener('resize', onResize);
      window.cancelAnimationFrame(raf);
    };
  }, []);
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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
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
  // Handoff veil: black stage breathes into the story background over the
  // final stretch of scroll. Same progress input, pure style mapping.
  const veilEmpty = useTransform(scrollYProgress, () => 0);
  const veilFull = useTransform(scrollYProgress, [VEIL_START, VEIL_END], [0, VEIL_MAX]);
  const veilOpacity = reduce ? veilEmpty : veilFull;
  const refs: SlideRefs = {
    desktop: desktopRef,
    mobile: mobileRef,
    orb: orbRef,
    speckle: speckleRef,
    stage: stageRef,
    track: trackRef,
  };
  useSlideGeometry(orbProgress, refs);

  // Reduced motion keeps the full slide statically framed — no camera pan.
  useEffect(() => {
    if (reduce && trackRef.current) trackRef.current.style.transform = 'none';
  }, [reduce]);

  return (
    <section
      ref={sectionRef}
      data-post-cinematic="journey"
      aria-label="Slide journey into the learning chapters"
      className="relative bg-black"
      style={{ height: '300vh' }}
    >
      <div
        ref={stageRef}
        className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden"
      >
        {/*
          Exact 1:2 aspect at every viewport (height capped by width) so the
          orb's viewBox percentages always map onto the rendered box.
          SCROLL SPACE (0..1 over this 300vh section) drives the orb along
          the full path; VIEWPORT SPACE is this sticky stage — the camera
          transform on the track (same scroll input, runtime-measured sizes)
          pans the zoomed track so the orb's track point stays readable.
        */}
        <div
          ref={trackRef}
          className="relative aspect-[1/2] h-[min(100%,188vw)] will-change-transform"
          aria-hidden="true"
        >
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
        {/*
          Handoff veil: over the final stretch the black stage breathes into
          the story background (same token Chapter 01 uses), so the orb sinks
          toward the light and Chapter 01 arrives as a continuation rather
          than a hard black/white cut. The post path exits bottom-center and
          the Chapter 01 path enters top-center — one conceptual track.
        */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={{
            height: '58%',
            opacity: veilOpacity,
            background: `linear-gradient(to bottom, rgba(244,243,238,0) 0%, ${STORY.bg} 78%)`,
          }}
        />
      </div>
    </section>
  );
}
