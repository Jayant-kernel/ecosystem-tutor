import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';

export interface DustLayerHandle {
  /** Overall dust visibility 0..1 (master dust window). */
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

interface Speck {
  left: number;
  top: number;
  size: number;
  color: string;
  opacity: number;
  duration: number;
  delay: number;
  blur: number;
}

/**
 * Sparse atmospheric dust: a couple dozen tiny specks with varied blur and a
 * slow CSS twinkle. The center around the headline stays clean. Opacity is
 * driven from the master progress; twinkle is pure CSS.
 */
const DustLayer = forwardRef<DustLayerHandle>(function DustLayer(_, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const specks = useMemo<Speck[]>(() => {
    const rnd = mulberry32(0xd057);
    const list: Speck[] = [];
    let guard = 0;
    while (list.length < 22 && guard++ < 200) {
      const left = rnd() * 100;
      const top = rnd() * 100;
      // Keep the headline zone clean: reject the central ellipse.
      const dx = (left - 50) / 34;
      const dy = (top - 42) / 24;
      if (dx * dx + dy * dy < 1) continue;
      const bright = rnd() > 0.78;
      list.push({
        left,
        top,
        size: bright ? 2 + rnd() * 1.5 : 1 + rnd() * 1.5,
        color: bright ? '#ede9fe' : rnd() > 0.5 ? '#a78bfa' : '#7c3aed',
        opacity: bright ? 0.5 + rnd() * 0.4 : 0.18 + rnd() * 0.3,
        duration: 3 + rnd() * 4,
        delay: rnd() * 6,
        blur: rnd() > 0.6 ? 1 : 0,
      });
    }
    return list;
  }, []);

  useImperativeHandle(ref, () => ({
    setProgress(level: number) {
      const el = rootRef.current;
      if (!el) return;
      const clamped = Math.min(1, Math.max(0, level));
      el.style.opacity = clamped.toFixed(3);
      el.style.visibility = clamped <= 0.004 ? 'hidden' : 'visible';
    },
  }), []);

  return (
    <div ref={rootRef} aria-hidden="true" className="absolute inset-0" style={{ opacity: 0, visibility: 'hidden' }}>
      {specks.map((speck, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${speck.left}%`,
            top: `${speck.top}%`,
            width: speck.size,
            height: speck.size,
            background: speck.color,
            opacity: speck.opacity,
            // Soft specks get a diffuse halo instead of a blur filter, so the
            // brightness twinkle never overrides their softness.
            boxShadow: speck.blur
              ? `0 0 ${speck.size * 3}px ${speck.color}, 0 0 ${speck.size * 7}px ${speck.color}`
              : `0 0 ${speck.size * 3}px ${speck.color}`,
            animation: `dust-twinkle ${speck.duration.toFixed(2)}s ease-in-out ${speck.delay.toFixed(2)}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
});

export default DustLayer;
