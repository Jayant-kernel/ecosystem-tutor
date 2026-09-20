import { useEffect, useRef } from 'react';
import { filmDriver } from '../filmDriver';
import { sampleTimeline } from '../timeline';
import { usePrefersReducedMotion } from '../usePrefersReducedMotion';
import { cinematicProgress, contrastLevel, dustLevel, nebulaLevel, violetGlow } from '../cosmicProgress';
import { NebulaRenderer } from './nebula';
import PlanetLayer from './PlanetLayer';
import RockLayer, { type RockLayerHandle } from './RockLayer';
import DustLayer, { type DustLayerHandle } from './DustLayer';

/**
 * Cosmic environment behind the hero copy. Every layer is a pure function of
 * the master cinematic progress p (itself pure in film time t), so scrolling
 * backward reverses the reveal exactly. No independent timers: one rAF loop
 * writes styles only when the film signature changes; ambient evolution is
 * CSS-only or canvas-time driven inside the same tick.
 *
 * Stacking (all decorative, pointer-events none, below the Overlay panel):
 * nebula z1 / real models in the canvas beneath / dust z4 / contrast z5.
 */
export default function CosmicScene(): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const contrastRef = useRef<HTMLDivElement | null>(null);
  const nebulaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const nebulaRef = useRef<NebulaRenderer | null>(null);
  const rocksRef = useRef<RockLayerHandle | null>(null);
  const dustRef = useRef<DustLayerHandle | null>(null);
  const dustWrapRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  // Pointer parallax target/current (normalized -1..1), damped each tick.
  // Touch devices never set a target (listener only on fine pointers).
  const parallaxTarget = useRef({ x: 0, y: 0 });
  const parallaxCurrent = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (reducedMotion) return;
    const root = rootRef.current;
    if (!root || typeof window === 'undefined') return;
    const runway = root.closest('[data-cinematic-hero="runway"]');
    if (nebulaCanvasRef.current && !nebulaRef.current) {
      nebulaRef.current = new NebulaRenderer(nebulaCanvasRef.current);
    }
    let raf = 0;
    let running = false;
    let lastSignature = '';
    let lastNebulaPaintAt = Number.NEGATIVE_INFINITY;

    const paintNebula = (timeMs: number, minimumIntervalMs: number) => {
      const nebula = nebulaRef.current;
      if (!nebula || timeMs - lastNebulaPaintAt < minimumIntervalMs) return;
      nebula.frame(timeMs);
      lastNebulaPaintAt = timeMs;
    };

    const applyFrame = (t: number, timeMs: number) => {
      const p = cinematicProgress(t);
      const glow = glowRef.current;
      if (glow) {
        const intensity = violetGlow(p);
        glow.style.opacity = intensity.toFixed(3);
        glow.style.visibility = intensity <= 0.004 ? 'hidden' : 'visible';
      }
      const contrast = contrastRef.current;
      if (contrast) {
        contrast.style.opacity = contrastLevel(p).toFixed(3);
      }
      const nebula = nebulaRef.current;
      if (nebula) {
        nebula.setProgress(nebulaLevel(p));
        // The canvas is deliberately soft. Thirty frames per second while
        // scrubbing is visually fluid and avoids repainting 14 gradients for
        // every browser scroll frame.
        paintNebula(timeMs, 33);
      }
      const parallax = parallaxCurrent.current;
      // Dust veil follows the master dust window.
      dustRef.current?.setProgress(dustLevel(p));
      // Pointer parallax keeps the 2D atmosphere subtly alive above the real
      // GLBs without competing with their depth.
      if (nebulaCanvasRef.current) {
        nebulaCanvasRef.current.style.transform =
          `translate(${(parallax.x * 2).toFixed(2)}px, ${(parallax.y * 2).toFixed(2)}px)`;
      }
      if (dustWrapRef.current) {
        dustWrapRef.current.style.transform =
          `translate(${(parallax.x * 3).toFixed(2)}px, ${(parallax.y * 3).toFixed(2)}px)`;
      }
    };

    const tick = (timeMs: number) => {
      const film = sampleTimeline(filmDriver.currentT);
      const signature = `${film.t.toFixed(4)}|${filmDriver.targetT.toFixed(4)}`;
      const nebula = nebulaRef.current;
      if (signature !== lastSignature) {
        lastSignature = signature;
        applyFrame(film.t, timeMs);
      } else if (nebula) {
        // Once the film settles, the star field only needs a quiet 8fps
        // twinkle. This removes the continuous canvas cost behind a static
        // hero while retaining a living sky.
        paintNebula(timeMs, 125);
      }
      // Damped pointer parallax (writes only while still settling).
      const pt = parallaxTarget.current;
      const pc = parallaxCurrent.current;
      const nx = pc.x + (pt.x - pc.x) * 0.06;
      const ny = pc.y + (pt.y - pc.y) * 0.06;
      if (Math.abs(nx - pc.x) + Math.abs(ny - pc.y) > 0.0004) {
        parallaxCurrent.current = { x: nx, y: ny };
        const p = cinematicProgress(film.t);
        if (nebulaCanvasRef.current) {
          nebulaCanvasRef.current.style.transform =
            `translate(${(nx * 2).toFixed(2)}px, ${(ny * 2).toFixed(2)}px)`;
        }
        if (dustWrapRef.current) {
          dustWrapRef.current.style.transform =
            `translate(${(nx * 3).toFixed(2)}px, ${(ny * 3).toFixed(2)}px)`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (running) return;
      running = true;
      lastSignature = '';
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    let io: IntersectionObserver | null = null;
    if (runway && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) start();
          else stop();
        },
        { rootMargin: '200px' },
      );
      io.observe(runway);
    } else {
      start();
    }
    // Paint the current frame immediately so a mid-scroll load never flashes.
    applyFrame(sampleTimeline(filmDriver.currentT).t, performance.now());
    const handleResize = () => nebulaRef.current?.resize();
    window.addEventListener('resize', handleResize);
    // Subtle pointer parallax, fine pointers only (never on touch).
    const canHover =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const handlePointer = (event: PointerEvent) => {
      parallaxTarget.current = {
        x: Math.min(1, Math.max(-1, (event.clientX / window.innerWidth) * 2 - 1)),
        y: Math.min(1, Math.max(-1, (event.clientY / window.innerHeight) * 2 - 1)),
      };
    };
    if (canHover) window.addEventListener('pointermove', handlePointer, { passive: true });
    return () => {
      stop();
      io?.disconnect();
      window.removeEventListener('resize', handleResize);
      if (canHover) window.removeEventListener('pointermove', handlePointer);
      nebulaRef.current?.destroy();
      nebulaRef.current = null;
    };
  }, [reducedMotion]);

  // Reduced-motion poster: snap rocks + dust to their settled state once.
  // No loop, no animation (ambient CSS is killed by .cosmic-poster).
  useEffect(() => {
    if (!reducedMotion) return;
    rocksRef.current?.setProgress(1);
    dustRef.current?.setProgress(1);
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <div ref={rootRef} aria-hidden="true" className="cosmic-poster pointer-events-none absolute inset-0 z-[1]">
        {/* Static settled poster: nebula impression + planet + glow + contrast. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 55% 42% at 46% 44%, rgba(91,33,182,0.5) 0%, rgba(59,15,99,0.28) 42%, transparent 68%),' +
              'radial-gradient(ellipse 40% 34% at 60% 52%, rgba(124,58,237,0.32) 0%, transparent 65%),' +
              'radial-gradient(ellipse 30% 26% at 38% 58%, rgba(42,10,74,0.55) 0%, transparent 70%)',
          }}
        />
        {/* Settled planet horizon (static, final reveal state). */}
        <div
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
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 44% 32% at 50% 46%, rgba(124,58,237,0.34) 0%, rgba(76,29,149,0.14) 45%, transparent 70%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 62% 52% at 50% 44%, rgba(5,3,12,0.6) 0%, rgba(5,3,12,0.25) 55%, transparent 78%)',
          }}
        />
        {/* Settled rocks + dust at full reveal (ambient CSS disabled above). */}
        <RockLayer ref={rocksRef} />
        <DustLayer ref={dustRef} />
      </div>
    );
  }

  return (
    <div ref={rootRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]">
      {/* Fluid nebula environment (2D canvas, intensity + reveal from p). */}
      <canvas ref={nebulaCanvasRef} className="absolute inset-0 h-full w-full" />
      {/* Sparse atmospheric dust, kept clear of the headline zone. */}
      <div ref={dustWrapRef} className="absolute inset-0">
        <DustLayer ref={dustRef} />
      </div>
      {/* Central violet illumination: a whisper of purple behind the words. */}
      <div
        ref={glowRef}
        className="absolute inset-0"
        style={{
          opacity: 0,
          visibility: 'hidden',
          background:
            'radial-gradient(ellipse 44% 32% at 50% 46%, rgba(124,58,237,0.34) 0%, rgba(76,29,149,0.14) 45%, transparent 70%)',
        }}
      />
      {/* Readability contrast field behind the hero copy. */}
      <div
        ref={contrastRef}
        className="absolute inset-0"
        style={{
          opacity: 0.25,
          background:
            'radial-gradient(ellipse 62% 52% at 50% 44%, rgba(5,3,12,0.6) 0%, rgba(5,3,12,0.25) 55%, transparent 78%)',
        }}
      />
    </div>
  );
}
