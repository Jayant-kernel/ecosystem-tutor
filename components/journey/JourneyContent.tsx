import { useEffect, useRef, useState } from 'react';
import { useMotionValueEvent, type MotionValue } from 'framer-motion';
import type { View } from '../../App';
import {
  JOURNEY_SECTIONS,
  clamp01,
  sectionLocal,
  sectionWeight,
  activeSectionIndex,
  type JourneySection,
} from './journeySections';
import { JourneyVideo } from './JourneyVideo';

export type JourneyNavigate = (view: View) => void;

function TextPanel({
  section,
  navigateTo,
  ctaEnabled,
}: {
  section: JourneySection;
  navigateTo: JourneyNavigate;
  ctaEnabled: boolean;
}): JSX.Element {
  return (
    <div className="w-full max-w-md">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300/90 md:text-xs">
        {section.eyebrow}
      </p>
      <h2 className="mt-3 font-manrope text-3xl font-bold leading-tight text-white md:mt-4 md:text-5xl">
        {section.title}
      </h2>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-400 md:mt-4 md:text-base">
        {section.description}
      </p>
      {section.cta ? (
        <button
          type="button"
          onClick={() => navigateTo(section.cta!.target)}
          tabIndex={ctaEnabled ? 0 : -1}
          style={{ pointerEvents: ctaEnabled ? 'auto' : 'none' }}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(249,115,22,0.35)] transition-colors hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-300 disabled:opacity-40"
        >
          {section.cta.label}
          <span aria-hidden="true">→</span>
        </button>
      ) : null}
    </div>
  );
}

/**
 * Write one crossfade frame for all panels. Pure function of journey
 * progress: weight ramps in/out around each section window (see
 * sectionWeight), and each panel drifts vertically with its LOCAL section
 * progress (+24px entering → 0 mid-section → −24px leaving) so content
 * feels physically attached to the orb travelling down the path rather
 * than fading in place. Panels below epsilon are hidden for perf/a11y,
 * the rail fill tracks progress. Called on every progress change and once
 * on mount.
 */
function paintPanels(
  panels: Array<HTMLDivElement | null>,
  rail: HTMLDivElement | null,
  p: number,
): void {
  for (let i = 0; i < JOURNEY_SECTIONS.length; i++) {
    const el = panels[i];
    if (!el) continue;
    const w = sectionWeight(p, i);
    const local = sectionLocal(p, i);
    el.style.opacity = w.toFixed(3);
    el.style.transform = `translate3d(0, ${((0.5 - local) * 48).toFixed(1)}px, 0) scale(${(0.97 + 0.03 * w).toFixed(4)})`;
    el.style.visibility = w <= 0.001 ? 'hidden' : 'visible';
  }
  if (rail) rail.style.height = `${(p * 100).toFixed(2)}%`;
}

function AnimatedPanels({
  progress,
  navigateTo,
}: {
  progress: MotionValue<number>;
  navigateTo: JourneyNavigate;
}): JSX.Element {
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const railRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  // One shared crossfade rig: every panel's opacity/slide/scale is written
  // imperatively from the SAME journey progress that drives the orb (the
  // same proven pattern as the orb/camera geometry pass) — each scroll
  // increment moves orb + camera + fades together with no frozen intervals,
  // no timers, and exact reverse. Fixed ref order (5 sections).
  useMotionValueEvent(progress, 'change', (v) => {
    paintPanels(panelRefs.current, railRef.current, clamp01(v));
    const next = activeSectionIndex(v);
    setActive((prev) => (prev === next ? prev : next));
  });

  // Initial paint: scroll may already sit mid-journey on mount (e.g.
  // back-navigation restoring position) — render the matching frame.
  useEffect(() => {
    paintPanels(panelRefs.current, railRef.current, clamp01(progress.get()));
    setActive(activeSectionIndex(progress.get()));
  }, [progress]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10" data-journey="content">
      {JOURNEY_SECTIONS.map((s, i) => {
        const textLeft = s.side === 'text-left';
        const isActive = active === i;
        return (
          <div
            key={s.id}
            ref={(el) => {
              panelRefs.current[i] = el;
            }}
            aria-hidden={!isActive}
            data-section={s.id}
            data-active={isActive}
            className="absolute inset-0"
            style={{ opacity: i === 0 ? 1 : 0 }}
          >
            {/* Desktop: text | spine gap | video, sides alternate. The center
                gap yields to the track (narrower on small desktop so media
                stays readable) — the path always keeps a clear middle. */}
            <div className="hidden h-full w-full items-center md:flex">
              <div
                className={`grid w-full grid-cols-[1fr_minmax(0,200px)_1fr] items-center gap-4 px-6 lg:grid-cols-[1fr_minmax(0,400px)_1fr] lg:gap-6 lg:px-16`}
              >
                <div className="col-start-1 justify-self-end">
                  {textLeft ? (
                    <TextPanel section={s} navigateTo={navigateTo} ctaEnabled={isActive} />
                  ) : (
                    <div className="w-full max-w-md justify-self-end">
                      <JourneyVideo slot={s.video} playing={isActive} reduceMotion={false} />
                    </div>
                  )}
                </div>
                <div aria-hidden="true" className="col-start-2" />
                <div className="col-start-3 justify-self-start">
                  {textLeft ? (
                    <div className="w-full max-w-md">
                      <JourneyVideo slot={s.video} playing={isActive} reduceMotion={false} />
                    </div>
                  ) : (
                    <TextPanel section={s} navigateTo={navigateTo} ctaEnabled={isActive} />
                  )}
                </div>
              </div>
            </div>
            {/* Mobile: text top, video bottom, guarded central corridor for
                the orb/path. Panels hug the edges (compact padding, capped
                video width) and an explicit spacer keeps ≥16vh of open
                middle; combined with the track rendering above this layer,
                the orb always keeps visual priority. */}
            <div className="flex h-full w-full flex-col px-5 pb-[5vh] pt-[7vh] md:hidden">
              <div className="flex-none rounded-2xl bg-black/55 p-4 backdrop-blur-sm">
                <TextPanel section={s} navigateTo={navigateTo} ctaEnabled={isActive} />
              </div>
              <div aria-hidden="true" className="min-h-[16vh] flex-1" />
              <div className="mx-auto w-full max-w-[320px] flex-none rounded-2xl bg-black/55 p-2 backdrop-blur-sm">
                <JourneyVideo slot={s.video} playing={isActive} reduceMotion={false} />
              </div>
            </div>
          </div>
        );
      })}
      {/* Orb-driven progress rail: 5 stations, fill follows journey progress. */}
      <div aria-hidden="true" className="absolute right-4 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-3 md:flex lg:right-8">
        <div className="relative flex flex-col items-center gap-3">
          <div className="absolute bottom-1 top-1 w-px bg-white/15" />
          <div ref={railRef} className="absolute top-1 w-px bg-orange-400" style={{ height: '0%' }} />
          {JOURNEY_SECTIONS.map((s, i) => (
            <span
              key={s.id}
              className={`relative z-10 block h-2 w-2 rounded-full transition-colors ${
                active === i ? 'bg-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.8)]' : 'bg-white/25'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Reduced-motion fallback: the same sections as a static stacked list — full
 * copy, same video slots (never autoplay), no sticky viewport, no
 * scroll-driven transforms. Rendered by PostCinematicJourney in normal flow.
 */
export function JourneyStatic({ navigateTo }: { navigateTo: JourneyNavigate }): JSX.Element {
  return (
    <div className="relative bg-black px-6 py-16" data-journey="static">
      <div className="mx-auto flex max-w-5xl flex-col gap-14">
        {JOURNEY_SECTIONS.map((s) => {
          const textLeft = s.side === 'text-left';
          return (
            <div
              key={s.id}
              data-section={s.id}
              className="grid items-center gap-8 md:grid-cols-2"
            >
              <div className={textLeft ? 'md:order-1' : 'md:order-2'}>
                <TextPanel section={s} navigateTo={navigateTo} ctaEnabled />
              </div>
              <div className={textLeft ? 'md:order-2' : 'md:order-1'}>
                <JourneyVideo slot={s.video} playing={false} reduceMotion />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function JourneyContent({
  progress,
  navigateTo,
}: {
  progress: MotionValue<number>;
  navigateTo: JourneyNavigate;
}): JSX.Element {
  return <AnimatedPanels progress={progress} navigateTo={navigateTo} />;
}
