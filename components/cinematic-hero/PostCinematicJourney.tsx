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
import type { View } from '../../App';
import { JOURNEY_VIEWPORT_HEIGHTS } from '../journey/journeySections';
import { JourneyContent, JourneyStatic } from '../journey/JourneyContent';

/**
 * Post-cinematic story journey. This section begins exactly where the hero
 * runway ends: the laptop film is over, and a glowing orb rolls down a
 * tall continuous track that now serves as the structural spine of the
 * landing page.
 *
 * Scroll position is the single source of truth — the section's own
 * scroll progress (same native document scroll) drives the orb along real
 * arc length (`getPointAtLength`), the camera pan, the travelled-track
 * illumination, AND the five data-driven journey sections (text/video fade
 * in and out around the orb's position). No second scroll system, no timer,
 * no animation loop. Reverse scrolling retraces everything exactly.
 *
 * Handoff model: orb progress maps 1:1 to section progress (p=1 → orb at
 * the path's bottom-center exit, final CTA dominant), the camera pans
 * linearly with the same progress (top of track at p=0, bottom at p=1 —
 * no stall zones, so every scroll increment visibly moves orb + camera +
 * section fades together), and a restrained veil softens the final stretch
 * before the footer arrives.
 */

const VIEW_W = 600;
const VIEW_H = 1200;

/**
 * Desktop journey: one continuous downward track in seven visual movements —
 * initial descent, wide sweep to the right wall and back across, a large
 * teardrop loop (ring closed with a rounded neck, no self-crossing), a tight
 * reversal tip with a left-side exit drop, a long flowing descent sweeping
 * back right under the ring, a smaller teardrop loop whose tail pierces its
 * base in one clean intentional X (~73°), and a final descent to the
 * bottom-center handoff. Overall progress is strictly downward; local upward
 * travel happens only inside the two loops and the reversal tip.
 */
const PATH_DESKTOP =
  'M300,10 C305,90 360,140 350,215 ' +
  'C340,295 505,270 498,365 C490,450 250,440 250,520 ' +
  'C250,560 300,570 350,575 C410,580 442,620 440,680 ' +
  'C438,750 370,795 300,792 C235,789 198,730 196,668 ' +
  'C194,655 193,645 195,632 C197,608 190,600 172,600 ' +
  'C154,600 150,612 150,628 C150,680 150,730 160,780 ' +
  'C175,835 260,860 360,875 ' +
  'C410,880 445,905 443,945 C441,985 400,1005 365,995 ' +
  'C330,985 322,945 335,915 C343,905 352,903 370,905 ' +
  'C390,905 392,918 390,930 C388,960 380,985 372,1010 ' +
  'C365,1070 340,1120 300,1190';

/**
 * Mobile journey: same seven-movement topology, redrawn — not rescaled — for
 * a 390-wide stage. Narrower x-band, tighter bend radii, and smaller loops
 * (large ring ~210 wide, small ring ~90 wide) so nothing overflows
 * horizontally and the loops stay readable in a tall viewport.
 */
const PATH_MOBILE =
  'M300,10 C302,100 340,150 335,220 ' +
  'C330,290 420,300 415,380 C410,450 265,450 265,520 ' +
  'C265,555 300,562 340,566 C385,570 405,600 404,645 ' +
  'C403,695 355,720 305,718 C260,716 232,680 231,635 ' +
  'C230,625 230,618 231,608 C232,592 226,586 212,586 ' +
  'C198,586 195,596 195,608 C195,655 195,700 202,745 ' +
  'C212,795 270,815 340,828 ' +
  'C375,833 398,850 397,880 C396,910 365,923 340,915 ' +
  'C315,907 310,880 320,860 C327,852 333,851 345,852 ' +
  'C360,852 361,862 360,871 C359,895 355,915 350,935 ' +
  'C345,1010 325,1100 300,1190';

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
 * Horizontal focal-tracking gain. The vertical pan stays a strict linear
 * function of scroll progress (top at p=0, bottom at p=1); horizontally the
 * camera only leans toward the orb's x-swing at half strength so wide sweeps
 * and loops read with surrounding context instead of snapping left/right.
 * Pure function of (progress, orb-x): no state, no timers — reverse scroll
 * retraces exactly and fast flings land on the matching frame.
 */
const HORIZONTAL_TRACKING = 0.5;
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
  // Damped to half strength so loops read with context instead of snapping.
  const wantX = -(fx - 0.5) * scaledW * HORIZONTAL_TRACKING;
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

export function PostCinematicJourney({
  navigateTo,
}: {
  navigateTo: (view: View) => void;
}): JSX.Element {
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
      aria-label="Story journey following the orb down the path"
      className="relative bg-black"
      style={{ height: reduce ? 'auto' : `${JOURNEY_VIEWPORT_HEIGHTS * 100}vh` }}
    >
      <div
        ref={stageRef}
        className={`${reduce ? 'relative' : 'sticky top-0'} flex h-screen w-full items-center justify-center overflow-hidden`}
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
          className="pointer-events-none relative z-20 aspect-[1/2] h-[min(100%,188vw)] will-change-transform"
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
          Journey content layer: the five data-driven sections render around
          the track (text on one side, video on the other, alternating), all
          driven by the SAME scrollYProgress MotionValue as the orb — the orb
          stays the master timeline. The track keeps the visual center so the
          path reads as the spine between text and video; the orb rides above
          in DOM order only where panels leave the middle open.
        */}
        {!reduce && (
          <JourneyContent progress={scrollYProgress} navigateTo={navigateTo} />
        )}
        {/*
          Handoff veil: over the final stretch the black stage breathes toward
          the light token so the orb sinks toward the footer handoff as a
          continuation rather than a hard cut. The path exits bottom-center
          with the final section dominant — one continuous track throughout.
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
      {/*
        Reduced motion: same sections as a static stacked list below the
        parked stage — full copy, no autoplay, no scroll-driven transforms.
      */}
      {reduce && <JourneyStatic navigateTo={navigateTo} />}
    </section>
  );
}
