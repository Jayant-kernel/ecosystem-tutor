import { Fragment, useEffect, useRef } from 'react';
import { filmDriver } from './filmDriver';
import { sampleTimeline, smoothstep, SCATTER_START, SCATTER_END, TIMELINE } from './timeline';

/**
 * Handoff window: the 3D screen fades out while the DOM panel fades in over
 * 0.62–0.78. Both are smoothstep curves in `t` — a pure function of film
 * progress, identical forward and reverse. The canvas lags the panel slightly
 * so no background edge or bezel can flash through mid-blend.
 */
const HANDOFF_START = TIMELINE.handoffStartT;
const HANDOFF_END = TIMELINE.handoffEndT;

interface OverlayProps {
  navigateTo: (view: 'courses') => void;
}

function setFade(
  el: HTMLElement | null,
  opacity: number,
  translateYPx = 0,
  interactive = false,
): void {
  if (!el) return;
  const clamped = Math.min(1, Math.max(0, opacity));
  el.style.opacity = clamped.toFixed(3);
  el.style.visibility = clamped <= 0.01 ? 'hidden' : 'visible';
  el.style.transform = translateYPx ? `translateY(${translateYPx.toFixed(1)}px)` : '';
  if (interactive) {
    el.style.pointerEvents = clamped > 0.5 ? 'auto' : 'none';
  }
}

/**
 * Scatter → assemble entrance for the first inside page (the handoff panel).
 *
 * The panel children start displaced and converge to their exact existing
 * layout as the film crosses the handoff window — the page reconstructs
 * itself as the camera finishes entering. Deterministic per-element seeds,
 * staggered starts, one common lock point; a pure function of film time so
 * reverse scrub disassembles symmetrically. At progress 1 the transform
 * resolves to '' — pixel-identical to the layout without scatter.
 * (Window constants live in timeline.ts so cosmic layers share them.)
 */

interface ScatterSeed {
  dx: number;
  dy: number;
  rotDeg: number;
  scale: number;
}

interface WordSeed extends ScatterSeed {
  /** Staggered assembly start for this word; all words lock by SCATTER_END. */
  start: number;
}

/** Deterministic PRNG (fixed seeds — never Math.random during rendering). */
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

/**
 * Single source of truth for the panel copy. Rendered word-by-word below so
 * each word can scatter independently while the assembled layout stays
 * exactly the normal hero copy.
 */
const COPY = {
  eyebrow: 'Ecosystem · AI Coding Tutor',
  headline: 'Talk. Code. Understand.',
  sub: 'An AI-powered coding companion that helps you learn concepts, debug errors, and build with confidence all through your voice.',
  ctaPrimary: 'Browse Courses',
  note: 'Scroll to continue',
} as const;

type CopyKey = keyof typeof COPY;

const WORDS: Record<CopyKey, string[]> = {
  eyebrow: COPY.eyebrow.split(' '),
  headline: COPY.headline.split(' '),
  sub: COPY.sub.split(' '),
  ctaPrimary: COPY.ctaPrimary.split(' '),
  note: COPY.note.split(' '),
};

function makeWordSeeds(count: number, salt: number): WordSeed[] {
  const rnd = mulberry32(0x9e3779b9 ^ salt);
  return Array.from({ length: count }, (_, i) => ({
    // Neighboring words fly opposite ways for composed contrast.
    dx: (i % 2 === 0 ? 1 : -1) * (60 + rnd() * 80),
    dy: (rnd() * 2 - 1) * 110,
    rotDeg: (rnd() * 2 - 1) * 5,
    scale: 0.9 + rnd() * 0.18,
    start: SCATTER_START + (count <= 1 ? 0 : (i / (count - 1)) * 0.1),
  }));
}

/** Stable deterministic seeds, computed once per copy block. */
const SEEDS: Record<CopyKey, WordSeed[]> = {
  eyebrow: makeWordSeeds(WORDS.eyebrow.length, 11),
  headline: makeWordSeeds(WORDS.headline.length, 22),
  sub: makeWordSeeds(WORDS.sub.length, 33),
  ctaPrimary: makeWordSeeds(WORDS.ctaPrimary.length, 44),
  note: makeWordSeeds(WORDS.note.length, 66),
};

function setScatter(
  el: HTMLElement | null,
  progress: number,
  seed: ScatterSeed,
  driftYPx: number,
): void {
  if (!el) return;
  const k = 1 - Math.min(1, Math.max(0, progress));
  const x = seed.dx * k;
  const y = seed.dy * k + driftYPx;
  const r = seed.rotDeg * k;
  const s = 1 + (seed.scale - 1) * k;
  const settled =
    Math.abs(x) < 0.05 && Math.abs(y) < 0.05 && Math.abs(r) < 0.05 && Math.abs(s - 1) < 0.001;
  el.style.transform = settled
    ? ''
    : `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(3)})`;
}

/** Applies per-word scatter for one copy block; all words lock by SCATTER_END. */
function scatterWords(
  refs: Array<HTMLSpanElement | null>,
  seeds: WordSeed[],
  t: number,
  driftYPx: number,
): void {
  for (let i = 0; i < refs.length; i++) {
    const el = refs[i];
    const seed = seeds[i];
    if (!el || !seed) continue;
    setScatter(el, smoothstep(seed.start, SCATTER_END, t), seed, driftYPx);
  }
}

/**
 * DOM overlay for the film. Every opacity and offset below is a pure function
 * of film time, so forward and reverse scrubbing render identical frames for
 * identical `t`. A dedicated lightweight loop writes only these styles and
 * runs solely while the runway is visible.
 */
export default function Overlay({ navigateTo }: OverlayProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hintRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const eyebrowRef = useRef<HTMLParagraphElement | null>(null);
  const headlineRef = useRef<HTMLHeadingElement | null>(null);
  const subRef = useRef<HTMLParagraphElement | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);
  const noteRef = useRef<HTMLParagraphElement | null>(null);
  const eyebrowWordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const headlineWordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const subWordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const ctaPrimaryWordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const noteWordRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === 'undefined') return;
    const runway = root.closest('[data-cinematic-hero="runway"]');
    let raf = 0;
    let running = false;
    let lastSignature = '';

    const tick = () => {
      const film = sampleTimeline(filmDriver.currentT);
      const signature = `${film.t.toFixed(4)}|${filmDriver.targetT.toFixed(4)}`;
      if (signature !== lastSignature) {
        lastSignature = signature;
        const t = film.t;

        // Scroll hint: fades and drifts up over the opening frames.
        const hintOut = smoothstep(0, 0.08, t);
        setFade(hintRef.current, 1 - hintOut, -12 * hintOut);

        // Film progress hairline: grows with t, yields as the panel takes over.
        const panel = smoothstep(HANDOFF_START, HANDOFF_END, t);
        const progress = progressRef.current;
        if (progress) {
          progress.style.width = `${(t * 100).toFixed(1)}%`;
          setFade(progress, 1 - panel);
        }

        // Handoff: the panel fades in while the laptop act exits inside the
        // existing canvas. The canvas itself stays mounted for the real space
        // models, avoiding a second WebGL context or a background flash.
        // Editorial children stagger inside the same window; the note settles
        // just after. Each word scatters independently and converges to the
        // exact layout — the assembled page matches the hero copy precisely.
        // All pure in t — reverse is the exact inverse.
        setFade(panelRef.current, panel, 0, true);
        const eyebrow = smoothstep(0.64, 0.74, t);
        setFade(eyebrowRef.current, eyebrow);
        scatterWords(eyebrowWordRefs.current, SEEDS.eyebrow, t, 0);
        const headline = smoothstep(0.66, 0.78, t);
        const headlineDrift = (1 - headline) * 20;
        setFade(headlineRef.current, headline, headlineDrift);
        scatterWords(headlineWordRefs.current, SEEDS.headline, t, headlineDrift);
        const sub = smoothstep(0.68, 0.8, t);
        const subDrift = (1 - sub) * 16;
        setFade(subRef.current, sub, subDrift);
        scatterWords(subWordRefs.current, SEEDS.sub, t, subDrift);
        const ctas = smoothstep(0.7, 0.82, t);
        const ctaDrift = (1 - ctas) * 12;
        setFade(ctaRef.current, ctas, ctaDrift);
        scatterWords(ctaPrimaryWordRefs.current, SEEDS.ctaPrimary, t, ctaDrift);
        setFade(noteRef.current, smoothstep(0.72, 0.84, t));
        scatterWords(noteWordRefs.current, SEEDS.note, t, 0);

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
    return () => {
      stop();
      io?.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} className="absolute inset-0 z-10">
      {/* Static cinematic vignette (pure CSS, zero GPU loop cost). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)' }}
      />
      <div ref={hintRef} className="absolute inset-x-0 bottom-10 flex justify-center">
        <div className="rounded-full border border-white/10 bg-black/55 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-300 backdrop-blur-sm">
          Scroll to move the camera
        </div>
      </div>
      {/* Film progress hairline. */}
      <div
        ref={progressRef}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-px bg-orange-500/60"
        style={{ width: '0%' }}
      />

      <div
        ref={panelRef}
        // Transparent: the cosmic environment (CosmicScene, z-1) carries the
        // backdrop now; readability comes from its contrast field, not from
        // an opaque panel. Fade/interaction behavior unchanged.
        className="absolute inset-0 flex items-center justify-center px-6 text-center"
        style={{ opacity: 0, visibility: 'hidden' }}
      >
        <div className="max-w-2xl">
          <p
            ref={eyebrowRef}
            className="mb-5 font-quantum text-[10px] uppercase tracking-[0.22em] text-violet-200/80"
          >
            {WORDS.eyebrow.map((word, i) => (
              <Fragment key={`eyebrow-${i}`}>
                <span
                  ref={(el) => {
                    eyebrowWordRefs.current[i] = el;
                  }}
                  className="inline-block"
                >
                  {word}
                </span>
                {i < WORDS.eyebrow.length - 1 ? ' ' : null}
              </Fragment>
            ))}
          </p>
          <h1
            ref={headlineRef}
            className="quantum-hero-title mb-6 font-quantum text-[clamp(2rem,5vw,4.45rem)] font-normal leading-[1.3] tracking-[0.055em] text-violet-50"
          >
            {WORDS.headline.map((word, i) => (
              <Fragment key={`headline-${i}`}>
                <span
                  ref={(el) => {
                    headlineWordRefs.current[i] = el;
                  }}
                  className="inline-block"
                >
                  {word}
                </span>
                {i < WORDS.headline.length - 1 ? ' ' : null}
              </Fragment>
            ))}
          </h1>
          <p ref={subRef} className="mx-auto mb-8 max-w-lg text-base leading-relaxed text-zinc-400/90 md:text-lg">
            {WORDS.sub.map((word, i) => (
              <Fragment key={`sub-${i}`}>
                <span
                  ref={(el) => {
                    subWordRefs.current[i] = el;
                  }}
                  className="inline-block"
                >
                  {word}
                </span>
                {i < WORDS.sub.length - 1 ? ' ' : null}
              </Fragment>
            ))}
          </p>
          <div ref={ctaRef} className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => navigateTo('courses')}
              className="rounded-full border border-violet-100/80 bg-violet-50 px-8 py-3.5 text-[12px] font-bold uppercase tracking-[0.16em] text-violet-950 shadow-[0_0_28px_rgba(196,181,253,0.26)] transition-colors hover:bg-violet-200"
            >
              {WORDS.ctaPrimary.map((word, i) => (
                <Fragment key={`cta-primary-${i}`}>
                  <span
                    ref={(el) => {
                      ctaPrimaryWordRefs.current[i] = el;
                    }}
                    className="inline-block"
                  >
                    {word}
                  </span>
                  {i < WORDS.ctaPrimary.length - 1 ? ' ' : null}
                </Fragment>
              ))}
            </button>
          </div>
          <p ref={noteRef} className="mt-8 text-[13px] font-bold uppercase tracking-[0.2em] text-violet-900">
            {WORDS.note.map((word, i) => (
              <Fragment key={`note-${i}`}>
                <span
                  ref={(el) => {
                    noteWordRefs.current[i] = el;
                  }}
                  className="inline-block"
                >
                  {word}
                </span>
                {i < WORDS.note.length - 1 ? ' ' : null}
              </Fragment>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
