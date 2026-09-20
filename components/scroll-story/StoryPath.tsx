import { useRef } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from 'framer-motion';
import { STORY, STORY_FONT, stationWindow } from './story';

interface StoryPathProps {
  /** SVG path definition for the journey stroke. */
  d: string;
  /** Chapter scroll progress (0 → 1). The ONLY animation input. */
  progress: MotionValue<number>;
  stroke?: string;
  strokeWidth?: number;
  tipColor?: string;
  trackOpacity?: number;
  /**
   * Traveler radius in viewBox units. Defaults to a small dot
   * (`strokeWidth * 1.7`); chapters that need the traveler to read as an
   * orb beside a keyword pass a larger radius. ViewBox units scale with the
   * SVG at every viewport, so this never uses screen pixel coordinates.
   */
  tipRadius?: number;
  /** When true, the traveler gets a soft halo so it reads as a glowing orb. */
  tipGlow?: boolean;
}

/**
 * The core visual mechanism: an organic stroke progressively revealed by
 * scroll progress via `pathLength`, with a small traveler dot riding the
 * drawing tip. No loops or timers — the dot is positioned imperatively from
 * scroll-driven motion-value changes only.
 */
export function StoryPath({
  d,
  progress,
  stroke = STORY.ink,
  strokeWidth = 5,
  tipColor = STORY.pine,
  trackOpacity = 0.12,
  tipRadius,
  tipGlow = false,
}: StoryPathProps): JSX.Element {
  const reduce = useReducedMotion();
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);
  const lengthRef = useRef(0);
  const radius = tipRadius ?? strokeWidth * 1.7;

  // Reduced-motion readers get the completed illustration, statically.
  const filled = useTransform(progress, () => 1);
  const draw = reduce ? filled : progress;

  useMotionValueEvent(draw, 'change', (v) => {
    const path = pathRef.current;
    const dot = dotRef.current;
    if (!path || !dot) return;
    try {
      if (!lengthRef.current) lengthRef.current = path.getTotalLength();
      const total = lengthRef.current;
      if (!total) return;
      const clamped = Math.min(1, Math.max(0, v));
      const point = path.getPointAtLength(clamped * total);
      const hidden = clamped <= 0.002 || clamped >= 0.999;
      dot.setAttribute('cx', point.x.toFixed(1));
      dot.setAttribute('cy', point.y.toFixed(1));
      dot.setAttribute('opacity', hidden ? '0' : '1');
      const halo = haloRef.current;
      if (halo) {
        halo.setAttribute('cx', point.x.toFixed(1));
        halo.setAttribute('cy', point.y.toFixed(1));
        halo.setAttribute('opacity', hidden ? '0' : '0.22');
      }
    } catch {
      // Geometry unavailable (e.g. display:none ancestors) — dot stays hidden.
    }
  });

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={trackOpacity}
      />
      <motion.path
        ref={pathRef}
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pathLength: draw }}
      />
      {tipGlow ? (
        <circle ref={haloRef} r={radius * 2.1} fill={tipColor} opacity={0} />
      ) : null}
      <circle
        ref={dotRef}
        r={radius}
        fill={tipColor}
        opacity={0}
        style={
          tipGlow
            ? { filter: `drop-shadow(0 0 ${radius * 0.9}px ${tipColor})` }
            : undefined
        }
      />
    </g>
  );
}

interface StationProps {
  /** Chapter scroll progress (0 → 1). */
  progress: MotionValue<number>;
  /** Fraction of the drawn path where this station sits. */
  at: number;
  children: React.ReactNode;
}

/**
 * A word/label that activates as the stroke reaches its station. Opacity
 * latches at 1 once reached (reverse scroll unlatches deterministically).
 */
export function Station({ progress, at, children }: StationProps): JSX.Element {
  const reduce = useReducedMotion();
  const [start, end] = stationWindow(at);
  const appear = useTransform(progress, [start, end], [0, 1]);
  const filled = useTransform(progress, () => 1);
  return (
    <motion.g style={{ opacity: reduce ? filled : appear }}>
      {children}
    </motion.g>
  );
}

interface StationLabelProps {
  x: number | string;
  y: number | string;
  size?: number;
  color?: string;
  anchor?: 'start' | 'middle' | 'end';
  weight?: number;
  spacing?: string;
  children: React.ReactNode;
}

/** Editorial SVG text label in the story typeface. */
export function StationLabel({
  x,
  y,
  size = 30,
  color = STORY.ink,
  anchor = 'middle',
  weight = 700,
  spacing,
  children,
}: StationLabelProps): JSX.Element {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontFamily={STORY_FONT}
      fontSize={size}
      fontWeight={weight}
      letterSpacing={spacing}
      fill={color}
    >
      {children}
    </text>
  );
}
