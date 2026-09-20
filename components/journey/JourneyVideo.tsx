import { useEffect, useRef } from 'react';
import type { JourneyVideoSlot } from './journeySections';

const PLACEHOLDER_RATIO = 'aspect-video';

/**
 * One journey section's video slot.
 *
 * Architecture supports real videos later: give the section's slot a `src`
 * and this renders a muted autoplay-loop-inline <video>; without a `src` it
 * renders a clean same-size placeholder with the premium black treatment.
 * Playback is fully parent-driven via `playing` (only the dominant section
 * plays): on deactivate the video pauses and rewinds so re-entry and reverse
 * scroll always restart deterministically. No timers, no global state.
 * Reduced motion never autoplays.
 */
export function JourneyVideo({
  slot,
  playing,
  reduceMotion,
}: {
  slot: JourneyVideoSlot;
  playing: boolean;
  reduceMotion: boolean;
}): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (playing && !reduceMotion) {
      void el.play().catch(() => {
        // Autoplay blocked — the poster/first frame still reads fine.
      });
    } else {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        // Metadata not loaded yet — nothing to rewind.
      }
    }
  }, [playing, reduceMotion, slot.src]);

  if (!slot.src) {
    return (
      <div
        role="img"
        aria-label={`${slot.label} (video placeholder)`}
        className={`${PLACEHOLDER_RATIO} w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 via-black to-zinc-900 shadow-[0_0_60px_rgba(249,115,22,0.12)]`}
      >
        <div className="relative flex h-full w-full flex-col">
          {/* Dark stage with ember floor-glow and CSS-only grain. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-60"
            style={{
              background:
                'radial-gradient(60% 80% at 50% 110%, rgba(249,115,22,0.22) 0%, rgba(249,115,22,0) 70%)',
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 3px)',
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-3 rounded-lg border border-white/10"
          />
          {/* Corner registration marks — deliberate frame, not content. */}
          <span aria-hidden="true" className="absolute left-5 top-5 h-3 w-3 border-l border-t border-orange-300/50" />
          <span aria-hidden="true" className="absolute right-5 top-5 h-3 w-3 border-r border-t border-orange-300/50" />
          <span aria-hidden="true" className="absolute bottom-14 left-5 h-3 w-3 border-b border-l border-orange-300/50" />
          <span aria-hidden="true" className="absolute bottom-14 right-5 h-3 w-3 border-b border-r border-orange-300/50" />
          <div className="relative flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-orange-400/40 bg-orange-500/10"
            >
              <span className="ml-0.5 inline-block h-0 w-0 border-y-8 border-l-[14px] border-y-transparent border-l-orange-300/80" />
            </span>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
              {slot.label}
            </p>
          </div>
          {/* Mock transport bar: play state, track, timecode shell. */}
          <div aria-hidden="true" className="relative flex items-center gap-3 px-5 pb-4">
            <span className="inline-block h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-zinc-500" />
            <span className="relative h-px flex-1 bg-white/15">
              <span className="absolute -top-[3px] left-0 h-[7px] w-[7px] rounded-full bg-orange-400/90 shadow-[0_0_8px_rgba(249,115,22,0.9)]" />
            </span>
            <span className="font-mono text-[10px] tracking-widest text-zinc-600">00:00</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${PLACEHOLDER_RATIO} w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_0_60px_rgba(249,115,22,0.12)]`}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        src={slot.src}
        poster={slot.poster}
        aria-label={slot.label}
        muted
        loop
        playsInline
        preload="metadata"
        disablePictureInPicture
      />
    </div>
  );
}
