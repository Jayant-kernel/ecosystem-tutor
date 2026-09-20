import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

export interface RockLayerHandle {
  setProgress: (level: number) => void;
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

/** A deterministic, uneven silhouette in a 0..100 viewBox. */
function rockPath(seed: number, points = 10): string {
  const rnd = mulberry32(seed);
  const coords: string[] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const radius = 33 + rnd() * 17 + (i % 3 === 0 ? rnd() * 13 : 0);
    coords.push(`${(50 + radius * Math.cos(angle)).toFixed(1)},${(50 + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return `M${coords.join(' L')} Z`;
}

interface Crater {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotation: number;
  opacity: number;
}

function craterDetails(seed: number): Crater[] {
  const rnd = mulberry32(seed ^ 0x7f4a7c15);
  return Array.from({ length: 4 }, () => ({
    x: 31 + rnd() * 39,
    y: 29 + rnd() * 39,
    rx: 3.8 + rnd() * 5.8,
    ry: 2.1 + rnd() * 3.8,
    rotation: -38 + rnd() * 76,
    opacity: 0.22 + rnd() * 0.22,
  }));
}

interface RockConfig {
  id: string;
  seed: number;
  left: number;
  top: number;
  size: number;
  fromXvw: number;
  fromYvh: number;
  fromRot: number;
  opacity: number;
  blur: number;
  driftSeconds: number;
  compactSize?: number;
  compactLeft?: number;
  compactTop?: number;
}

/**
 * Hand-authored SVG meteoroids. Neutral basalt material, recessed craters and
 * a thin warm rim make them read as rock under ember light. No downloaded
 * image or WebGL is needed. Rocks fly in from the edges as cosmic progress
 * rises; a slow CSS drift keeps them alive without fighting the JS transform.
 */
const ROCKS: RockConfig[] = [
  { id: 'fore-left', seed: 101, left: 0.02, top: 0.56, size: 340, compactSize: 178, compactLeft: -0.11, compactTop: 0.68, fromXvw: -14, fromYvh: 8, fromRot: -8, opacity: 0.92, blur: 0, driftSeconds: 22 },
  { id: 'mid-right', seed: 202, left: 0.78, top: 0.28, size: 196, compactSize: 108, fromXvw: 12, fromYvh: -5, fromRot: 8, opacity: 0.88, blur: 0, driftSeconds: 26 },
  { id: 'mid-left', seed: 303, left: 0.13, top: 0.16, size: 142, compactSize: 86, compactTop: 0.1, fromXvw: -9, fromYvh: -6, fromRot: -6, opacity: 0.82, blur: 0.5, driftSeconds: 24 },
  { id: 'bg-right', seed: 404, left: 0.7, top: 0.64, size: 78, fromXvw: 7, fromYvh: 5, fromRot: 5, opacity: 0.44, blur: 3, driftSeconds: 30 },
  { id: 'bg-left', seed: 505, left: 0.3, top: 0.72, size: 60, fromXvw: -6, fromYvh: 6, fromRot: -5, opacity: 0.36, blur: 5, driftSeconds: 32 },
];

const RockLayer = forwardRef<RockLayerHandle>(function RockLayer(_, ref) {
  const els = useRef<Array<HTMLDivElement | null>>([]);
  const [compact] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);

  useImperativeHandle(ref, () => ({
    setProgress(level: number) {
      const clamped = Math.min(1, Math.max(0, level));
      ROCKS.forEach((rock, i) => {
        const el = els.current[i];
        if (!el) return;
        const arrived = 1 - clamped;
        el.style.opacity = (rock.opacity * clamped).toFixed(3);
        el.style.visibility = clamped <= 0.004 ? 'hidden' : 'visible';
        el.style.transform =
          `translate(${(rock.fromXvw * arrived).toFixed(2)}vw, ${(rock.fromYvh * arrived).toFixed(2)}vh) ` +
          `rotate(${(rock.fromRot * arrived).toFixed(2)}deg)`;
        el.style.filter = rock.blur ? `blur(${(rock.blur * (0.4 + 0.6 * clamped)).toFixed(2)}px)` : '';
      });
    },
  }), []);

  return (
    <>
      {ROCKS.map((rock, i) => {
        const shape = rockPath(rock.seed);
        const craters = craterDetails(rock.seed);
        const rimDx = rock.left < 0.5 ? -5 : 5;
        const rimDy = rock.top < 0.46 ? -4 : 4;
        const gid = `meteor-${rock.id}`;
        const size = compact ? (rock.compactSize ?? rock.size) : rock.size;
        const left = compact ? (rock.compactLeft ?? rock.left) : rock.left;
        const top = compact ? (rock.compactTop ?? rock.top) : rock.top;
        return (
          <div
            key={rock.id}
            ref={(el) => { els.current[i] = el; }}
            aria-hidden="true"
            className={`absolute${rock.blur >= 3 ? ' rock--bg' : ''}`}
            style={{ left: `${left * 100}%`, top: `${top * 100}%`, width: size, height: size, opacity: 0, visibility: 'hidden' }}
          >
            <div className="h-full w-full" style={{ animation: `rock-drift ${rock.driftSeconds}s ease-in-out infinite alternate` }}>
              <svg viewBox="0 0 100 100" className="h-full w-full" style={{ overflow: 'visible' }}>
                <defs>
                  <radialGradient id={`${gid}-body`} cx="28%" cy="20%" r="82%">
                    <stop offset="0%" stopColor="#a69a94" />
                    <stop offset="20%" stopColor="#665b5a" />
                    <stop offset="56%" stopColor="#28212a" />
                    <stop offset="100%" stopColor="#08060d" />
                  </radialGradient>
                  <linearGradient id={`${gid}-facet`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#d6d3d1" stopOpacity="0.32" />
                    <stop offset="55%" stopColor="#756973" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="#120d18" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id={`${gid}-rim`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffedd5" />
                    <stop offset="34%" stopColor="#fdba74" />
                    <stop offset="100%" stopColor="#c2410c" stopOpacity="0" />
                  </linearGradient>
                  <radialGradient id={`${gid}-crater`} cx="32%" cy="24%" r="72%">
                    <stop offset="0%" stopColor="#09070c" />
                    <stop offset="70%" stopColor="#1c1620" />
                    <stop offset="100%" stopColor="#978b86" stopOpacity="0.62" />
                  </radialGradient>
                  <clipPath id={`${gid}-clip`}><path d={shape} /></clipPath>
                </defs>
                <path d={shape} fill={`url(#${gid}-rim)`} opacity="0.94" transform={`translate(${rimDx} ${rimDy})`} />
                <path d={shape} fill={`url(#${gid}-body)`} />
                <g clipPath={`url(#${gid}-clip)`}>
                  <path d="M6 20 C31 4, 58 9, 94 37 L82 54 C55 39, 32 46, 12 61 Z" fill={`url(#${gid}-facet)`} />
                  {craters.map((crater, craterIndex) => (
                    <g key={craterIndex} transform={`rotate(${crater.rotation} ${crater.x} ${crater.y})`} opacity={crater.opacity}>
                      <ellipse cx={crater.x} cy={crater.y} rx={crater.rx + 1.4} ry={crater.ry + 1.2} fill="#fdba74" opacity="0.16" />
                      <ellipse cx={crater.x} cy={crater.y} rx={crater.rx} ry={crater.ry} fill={`url(#${gid}-crater)`} />
                      <ellipse cx={crater.x - crater.rx * 0.18} cy={crater.y - crater.ry * 0.3} rx={crater.rx * 0.52} ry={crater.ry * 0.28} fill="#d6d3d1" opacity="0.13" />
                    </g>
                  ))}
                </g>
                <path d={shape} fill="none" stroke="#ffedd5" strokeOpacity="0.1" strokeWidth="0.8" />
              </svg>
            </div>
          </div>
        );
      })}
    </>
  );
});

export default RockLayer;
