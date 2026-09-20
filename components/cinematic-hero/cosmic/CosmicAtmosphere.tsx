import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { NebulaRenderer } from './nebula';
import {
  contrastLevel,
  dustLevel,
  emberGlow,
  nebulaLevel,
  rocksLevel,
} from '../cosmicProgress';
import DustLayer, { type DustLayerHandle } from './DustLayer';
import RockLayer, { type RockLayerHandle } from './RockLayer';

export interface CosmicAtmosphereHandle {
  /**
   * Paint one frame of the 2D cosmic atmosphere for normalized cosmic
   * progress `p`. Called from the Overlay's existing film tick — this
   * component owns NO rAF loop, NO scroll listener, NO clock of its own.
   * Nebula repaints are throttled internally (fluid while scrubbing, quiet
   * twinkle once settled).
   */
  paint: (p: number, timeMs: number) => void;
  resize: () => void;
  destroy: () => void;
}

/**
 * DOM atmosphere for the space act: fluid nebula canvas, SVG meteoroids,
 * sparse dust, ember glow, and a readability contrast field. All layers are
 * decorative, pointer-transparent, and stacked BELOW the handoff panel, so
 * the laptop act (t < reveal) renders pixel-identically with or without it.
 */
const CosmicAtmosphere = forwardRef<CosmicAtmosphereHandle>(function CosmicAtmosphere(_, ref) {
  const glowRef = useRef<HTMLDivElement | null>(null);
  const contrastRef = useRef<HTMLDivElement | null>(null);
  const rocksWrapRef = useRef<HTMLDivElement | null>(null);
  const nebulaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const nebulaRef = useRef<NebulaRenderer | null>(null);
  const rocksRef = useRef<RockLayerHandle | null>(null);
  const dustRef = useRef<DustLayerHandle | null>(null);
  const lastNebulaPaintAt = useRef(Number.NEGATIVE_INFINITY);

  // The 2D nebula renderer is created once against the mounted canvas.
  // Frames are driven exclusively through paint() — no loop lives here.
  useEffect(() => {
    if (nebulaCanvasRef.current && !nebulaRef.current) {
      nebulaRef.current = new NebulaRenderer(nebulaCanvasRef.current);
    }
    return () => {
      nebulaRef.current?.destroy();
      nebulaRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    paint(p: number, timeMs: number) {
      const glow = glowRef.current;
      if (glow) {
        const intensity = emberGlow(p);
        glow.style.opacity = intensity.toFixed(3);
        glow.style.visibility = intensity <= 0.004 ? 'hidden' : 'visible';
      }
      const contrast = contrastRef.current;
      if (contrast) {
        contrast.style.opacity = contrastLevel(p).toFixed(3);
      }
      rocksRef.current?.setProgress(rocksLevel(p));
      dustRef.current?.setProgress(dustLevel(p));
      const nebula = nebulaRef.current;
      if (nebula) {
        nebula.setProgress(nebulaLevel(p));
        // Soft canvas: ~30fps while scrubbing is fluid; ~8fps twinkle rests
        // cheaply once the film settles (Overlay passes through each tick).
        const settled = p <= 0.002 || p >= 0.999;
        const minimumIntervalMs = settled ? 125 : 33;
        if (timeMs - lastNebulaPaintAt.current >= minimumIntervalMs) {
          nebula.frame(timeMs);
          lastNebulaPaintAt.current = timeMs;
        }
      }
    },
    resize() {
      nebulaRef.current?.resize();
    },
    destroy() {
      nebulaRef.current?.destroy();
      nebulaRef.current = null;
    },
  }), []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]">
      {/* Fluid nebula environment (2D canvas, intensity + reveal from p). */}
      <canvas ref={nebulaCanvasRef} className="absolute inset-0 h-full w-full" />
      {/* Hand-authored SVG meteoroids assembling from the edges. */}
      <div ref={rocksWrapRef} className="absolute inset-0">
        <RockLayer ref={rocksRef} />
      </div>
      {/* Sparse atmospheric dust, kept clear of the headline zone. */}
      <div className="absolute inset-0">
        <DustLayer ref={dustRef} />
      </div>
      {/* Central ember illumination echoing the orb journey's glow. */}
      <div
        ref={glowRef}
        className="absolute inset-0"
        style={{
          opacity: 0,
          visibility: 'hidden',
          background:
            'radial-gradient(ellipse 44% 32% at 50% 46%, rgba(249,115,22,0.30) 0%, rgba(124,45,18,0.12) 45%, transparent 70%)',
        }}
      />
      {/* Readability contrast field behind the hero copy. */}
      <div
        ref={contrastRef}
        className="absolute inset-0"
        style={{
          opacity: 0.25,
          background:
            'radial-gradient(ellipse 62% 52% at 50% 44%, rgba(3,4,8,0.6) 0%, rgba(3,4,8,0.25) 55%, transparent 78%)',
        }}
      />
    </div>
  );
});

export default CosmicAtmosphere;
