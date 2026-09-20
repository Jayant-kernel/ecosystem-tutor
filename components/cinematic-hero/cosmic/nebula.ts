/**
 * Lightweight 2D-canvas deep-space starfield. No WebGL, no dependencies:
 * seeded stars with a slow twinkle, revealed through an expanding radial
 * mask so the environment EMERGES from the center instead of fading in as
 * one image. (An earlier fluid-nebula blob layer was removed: its broad
 * blue wash covered content. Stars + dust + GLB models carry the act now.)
 *
 * Driven externally: setProgress() each film tick, frame() on demand while
 * the hero is visible. Seeded PRNG keeps every load identical.
 */

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  phase: number;
  speed: number;
  cool: boolean;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Starfield only: the former nebula blob wash was removed for covering
// content. Cool and warm specks on near-black.
const STAR_COUNT = 76;

export class NebulaRenderer {
  private stars: Star[] = [];
  private level = 0;
  private cleared = false;
  private width = 0;
  private height = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const rnd = mulberry32(0x51ab1e);
    // A stable star field feels much more like deep space than random dots.
    // Keep the reading ellipse clear, then give just a few stars a restrained
    // cross flare so the result stays elegant rather than game-like.
    while (this.stars.length < STAR_COUNT) {
      const x = rnd();
      const y = rnd();
      const dx = (x - 0.5) / 0.34;
      const dy = (y - 0.42) / 0.24;
      if (dx * dx + dy * dy < 1) continue;
      const bright = rnd() > 0.88;
      this.stars.push({
        x,
        y,
        radius: bright ? 0.9 + rnd() * 0.55 : 0.3 + rnd() * 0.55,
        alpha: bright ? 0.45 + rnd() * 0.35 : 0.16 + rnd() * 0.28,
        phase: rnd() * Math.PI * 2,
        speed: 0.45 + rnd() * 0.75,
        cool: rnd() > 0.42,
      });
    }
    this.resize();
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    const cssW = parent ? parent.clientWidth : window.innerWidth;
    const cssH = parent ? parent.clientHeight : window.innerHeight;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    // Half-resolution backing store: stars are tiny, upscaling is invisible.
    this.width = Math.max(2, Math.round((cssW * dpr) / 2));
    this.height = Math.max(2, Math.round((cssH * dpr) / 2));
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.cleared = false;
  }

  setProgress(level: number): void {
    this.level = Math.min(1, Math.max(0, level));
  }

  /** Draw one frame. timeMs is wall-clock; motion is ambient only. */
  frame(timeMs: number): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    if (this.level <= 0.002) {
      if (!this.cleared) {
        ctx.clearRect(0, 0, this.width, this.height);
        this.cleared = true;
      }
      return;
    }
    this.cleared = false;
    const { width: w, height: h } = this;
    const maxDim = Math.max(w, h);
    const t = timeMs / 1000;

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    for (const star of this.stars) {
      const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * star.speed + star.phase));
      const alpha = star.alpha * twinkle * (0.26 + this.level * 0.74);
      const x = star.x * w;
      const y = star.y * h;
      ctx.fillStyle = star.cool
        ? `rgba(232,237,247,${alpha.toFixed(3)})`
        : `rgba(252,217,184,${(alpha * 0.78).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fill();
      if (star.radius > 1.15) {
        ctx.globalAlpha = alpha * 0.42;
        ctx.fillRect(x - star.radius * 3, y, star.radius * 6, 0.45);
        ctx.fillRect(x, y - star.radius * 3, 0.45, star.radius * 6);
        ctx.globalAlpha = 1;
      }
    }
    // Emerging reveal: punch a soft radial mask centered on the hero so the
    // starfield grows out of the darkness instead of fading as a whole. The
    // mask stays tighter than the viewport so the corners remain near-black.
    const reveal = 0.08 + 0.62 * this.level;
    ctx.globalCompositeOperation = 'destination-in';
    const mask = ctx.createRadialGradient(
      w * 0.5, h * 0.46, 0,
      w * 0.5, h * 0.46, maxDim * 0.75 * reveal + maxDim * 0.05,
    );
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.72, 'rgba(0,0,0,1)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  destroy(): void {
    this.stars = [];
  }
}
