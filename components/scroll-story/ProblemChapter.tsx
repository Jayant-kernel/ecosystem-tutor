import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ChapterShell } from './ChapterShell';
import { Station, StationLabel, StoryPath } from './StoryPath';
import { CHAPTER_COPY, STORY, STORY_FONT, scrollTarget } from './story';

/** Organic serpentine stroke from top-center to bottom-center. */
const PATH_D =
  'M400,-20 C400,90 590,120 590,230 ' +
  'C590,340 210,370 210,480 ' +
  'C210,590 590,620 590,730 ' +
  'C590,840 210,870 210,980 ' +
  'C210,1070 330,1110 400,1220';

const KEYWORDS = [
  { word: 'ERROR', x: 618, y: 238, anchor: 'start' as const, at: 0.15 },
  { word: 'SEARCH', x: 182, y: 488, anchor: 'end' as const, at: 0.33 },
  { word: 'DOCS', x: 618, y: 738, anchor: 'start' as const, at: 0.52 },
  { word: 'CONFUSION', x: 182, y: 988, anchor: 'end' as const, at: 0.7 },
  { word: 'DEBUG', x: 400, y: 1152, anchor: 'middle' as const, at: 0.88 },
];

/**
 * Chapter 1 — the problem. The section starts clean; scroll draws an organic
 * stroke through complication keywords, ending on the turn:
 * "What if you could just ask?"
 *
 * The traveler is the chapter's orb: the SAME chapter progress that reveals
 * each keyword station also positions the orb at that path fraction, so the
 * orb travels into each keyword area exactly as its station activates. The
 * station layout already places ERROR just right of the first bend
 * (path x≈590 → label x=618, both near y≈238, at=0.15), so at ERROR reveal
 * the orb sits on the path immediately left of the word:
 * ERROR ← orb ← path. The ~28-unit viewBox gap keeps both legible with no
 * overlay, and everything scales with the SVG on mobile.
 */
export function ProblemChapter(): JSX.Element {
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: scrollTarget(ref), offset: ['start start', 'end end'] });
  const reduce = useReducedMotion();
  const payoffOpacity = useTransform(scrollYProgress, [0.9, 0.985], [0, 1]);
  const payoffFilled = useTransform(scrollYProgress, () => 1);

  return (
    <ChapterShell copy={CHAPTER_COPY[0]} sectionRef={ref} progress={scrollYProgress}>
      <svg
        viewBox="0 0 800 1200"
        preserveAspectRatio="xMidYMid meet"
        className="h-full max-h-full w-auto max-w-full"
        role="img"
        aria-label="A winding path through coding frustrations"
      >
        <StoryPath
          d={PATH_D}
          progress={scrollYProgress}
          tipColor={STORY.ember}
          tipRadius={22}
          tipGlow
        />
        {KEYWORDS.map((k) => (
          <Station key={k.word} progress={scrollYProgress} at={k.at}>
            <StationLabel x={k.x} y={k.y} anchor={k.anchor} size={34} spacing="6px" color={STORY.ink}>
              {k.word}
            </StationLabel>
          </Station>
        ))}
      </svg>
      <motion.p
        className="font-manrope pointer-events-none absolute inset-x-0 bottom-8 text-center text-2xl font-medium italic md:text-4xl"
        style={{ color: STORY.ink, fontFamily: STORY_FONT, opacity: reduce ? payoffFilled : payoffOpacity }}
      >
        What if you could just ask?
      </motion.p>
    </ChapterShell>
  );
}
