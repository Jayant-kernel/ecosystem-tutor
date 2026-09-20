/**
 * Lightweight 2D-canvas purple nebula. No WebGL, no dependencies, no GLSL:
 * layered radial-gradient blobs composited additively, drifting on slow
 * Lissajous paths, revealed through an expanding radial mask so the
 * environment EMERGES from the center instead of fading in as one image.
 *
 * Driven externally: setProgress() each film tick, frame() every rAF while
 * the hero is visible. Seeded PRNG keeps every load identical.
 */
export interface NebulaBlob {
  /** Base position as a fraction of canvas size. */
  bx: number;
  by: number;
  /** Radius as a fraction of the canvas max dimension. */
  radius: number;
  /** Lissajous drift amplitude (fraction) and speeds. */
  ax: number;
  ay: number;
  sx: number;
  sy: number;
  phase: number;
  color: string;
  /** Peak alpha of the blob core. */
  alpha: number;
  /** Elliptical stretch (>1) and base rotation for filament wisps. */
  stretch: number;
  rotation: number;
}

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

// Deep, dark-first palette: most blobs are near-black violet so luminous
// regions read as light inside darkness, not as a purple wash.
const PALETTE: Array<{ color: string; alpha: number }> = [
  { color: '#150426', alpha: 0.6 },
  { color: '#1a0530', alpha: 0.55 },
  { color: '#2a0a4a', alpha: 0.5 },
  { color: '#3b0f63', alpha: 0.42 },
  { color: '#5b21b6', alpha: 0.34 },
  { color: '#7c3aed', alpha: 0.26 },
  { color: '#a855f7', alpha: 0.18 },
];

const BLOB_COUNT = 14;
const STAR_COUNT = 76;

export class NebulaRenderer {
  private blobs: NebulaBlob[] = [];
  private stars: Star[] = [];
  private level = 0;
  private cleared = false;
  private width = 0;
  private height = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const rnd = mulberry32(0x51ab1e);
    for (let i = 0; i < BLOB_COUNT; i++) {
      // Dark deep-violet base blobs first, luminous cores last (painted over).
      const tier = i < 7 ? 0 : i < 12 ? 1 : 2;
      const entry = PALETTE[Math.min(PALETTE.length - 1, tier * 2 + Math.floor(rnd() * 2))];
      const central = i < 6;
      // A few stretched filaments for marbling; most stay round and soft.
      const filament = i % 4 === 3;
      this.blobs.push({
        bx: central ? 0.36 + rnd() * 0.28 : 0.08 + rnd() * 0.84,
        by: central ? 0.34 + rnd() * 0.26 : 0.08 + rnd() * 0.84,
        radius: tier === 2 ? 0.1 + rnd() * 0.12 : 0.18 + rnd() * 0.26,
        ax: 0.015 + rnd() * 0.03,
        ay: 0.015 + rnd() * 0.03,
        sx: 0.05 + rnd() * 0.08,
        sy: 0.04 + rnd() * 0.07,
        phase: rnd() * Math.PI * 2,
        color: entry.color,
        alpha: entry.alpha,
        stretch: filament ? 2.2 + rnd() * 1.6 : 1,
        rotation: rnd() * Math.PI,
      });
    }
    // One tiny white-hot heart, always central.
    this.blobs.push({
      bx: 0.5, by: 0.44, radius: 0.07,
      ax: 0.008, ay: 0.008, sx: 0.06, sy: 0.05, phase: 1.3,
      color: '#ddd6fe', alpha: 0.5, stretch: 1.4, rotation: 0.6,
    });
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
    // Half-resolution backing store: blobs are soft, upscaling is invisible.
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
        ? `rgba(237,233,254,${alpha.toFixed(3)})`
        : `rgba(196,181,253,${(alpha * 0.78).toFixed(3)})`;
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
    ctx.globalCompositeOperation = 'lighter';
    for (const blob of this.blobs) {
      const x = (blob.bx + blob.ax * Math.sin(t * blob.sx + blob.phase)) * w;
      const y = (blob.by + blob.ay * Math.cos(t * blob.sy + blob.phase * 1.7)) * h;
      const r = blob.radius * maxDim;
      const a = blob.alpha * this.level;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(blob.rotation + 0.06 * Math.sin(t * 0.03 + blob.phase));
      // Stretched local space turns round gradients into wispy filaments.
      ctx.scale(blob.stretch, 1);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      gradient.addColorStop(0, this.withAlpha(blob.color, a));
      gradient.addColorStop(0.55, this.withAlpha(blob.color, a * 0.38));
      gradient.addColorStop(1, this.withAlpha(blob.color, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }

    // Emerging reveal: punch a soft radial mask centered on the hero so the
    // nebula grows out of the darkness instead of fading as a whole. The mask
    // stays tighter than the viewport so the corners remain near-black.
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
    this.blobs = [];
    this.stars = [];
  }

  private withAlpha(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, alpha)).toFixed(3)})`;
  }
}
