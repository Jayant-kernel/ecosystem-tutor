/**
 * Semantic teaching targets: the shared vocabulary between the AI tutor's
 * highlight tools and the Monaco-backed UI.
 *
 * A target is always line/column-based — never pixels, selectors, or screen
 * coordinates — so it stays valid when the editor scrolls, resizes, or moves.
 * This module is pure (no Monaco, no DOM) so the resolution rules can be
 * reasoned about and tested in isolation. Correctness beats precision: any
 * target that cannot be resolved exactly degrades to a line highlight, and
 * anything outside the editor model is rejected outright (no pointer at all).
 */

export interface TeachingRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/** Minimal editor-model surface needed for validation. */
export interface TeachingCodeInfo {
  lineCount: number;
  lineLength: (line: number) => number;
}

export type ResolvedTeachingTarget =
  | { kind: 'range'; range: TeachingRange; label: string | null }
  | { kind: 'line'; startLine: number; endLine: number; label: string | null }
  | { kind: 'invalid'; reason: string };

/** Cap for the staggered line walk, matching the existing highlight behavior. */
export const MAX_TEACHING_WALK_LINES = 24;

function toInt(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.floor(n);
}

function cleanLabel(note: unknown): string | null {
  if (typeof note !== 'string') return null;
  const trimmed = note.trim().slice(0, 80);
  return trimmed ? trimmed : null;
}

/**
 * Resolves raw highlight-tool args against the current editor model.
 *
 * - Unknown/missing lines → invalid (never fall back to line 1: pointing at
 *   the wrong line is worse than not pointing).
 * - Ranges partly outside the model are clamped; fully outside → invalid.
 * - Columns are honored only for a single clamped line with both columns
 *   inside that line's bounds; anything else → line highlight.
 */
export function resolveTeachingTarget(
  args: Record<string, any> | null | undefined,
  code: TeachingCodeInfo,
): ResolvedTeachingTarget {
  const label = cleanLabel(args?.note);
  const rawStart = toInt(args?.startLine);
  const rawEnd = toInt(args?.endLine);
  if (rawStart === null || rawEnd === null) {
    return { kind: 'invalid', reason: 'missing line numbers' };
  }
  let startLine = Math.min(rawStart, rawEnd);
  let endLine = Math.max(rawStart, rawEnd);
  const lineCount = Math.max(1, Math.floor(code.lineCount) || 1);
  if (endLine < 1 || startLine > lineCount) {
    return { kind: 'invalid', reason: 'lines outside editor' };
  }
  startLine = Math.min(Math.max(startLine, 1), lineCount);
  endLine = Math.min(Math.max(endLine, 1), lineCount);

  const singleLine = startLine === endLine;
  const rawSc = toInt(args?.startColumn);
  const rawEc = toInt(args?.endColumn);
  if (singleLine && rawSc !== null && rawEc !== null) {
    const maxColumn = code.lineLength(startLine) + 1;
    const startColumn = Math.min(rawSc, rawEc);
    const endColumn = Math.max(rawSc, rawEc);
    if (startColumn >= 1 && endColumn > startColumn && endColumn <= maxColumn) {
      return { kind: 'range', range: { startLine, startColumn, endLine, endColumn }, label };
    }
  }
  return { kind: 'line', startLine, endLine, label };
}
/** 1-based lines for the staggered teaching walk, capped for sanity. */
export function walkLinesForTarget(target: ResolvedTeachingTarget): number[] {
  if (target.kind === 'invalid') return [];
  const lines: number[] = [];
  const end = target.kind === 'range' ? target.range.startLine : target.endLine;
  const start = target.kind === 'range' ? target.range.startLine : target.startLine;
  for (let line = start; line <= end && lines.length < MAX_TEACHING_WALK_LINES; line++) {
    lines.push(line);
  }
  return lines;
}

/** Pointer label for a walk: the model's note, or a generic fallback. */
export function labelForWalk(lines: number[], note: string | null): string {
  if (note) return note;
  return lines.length > 1
    ? `Explaining lines ${lines[0]}-${lines[lines.length - 1]}`
    : `Explaining line ${lines[0]}`;
}

/** One interactive teaching step: a single validated target plus its label. */
export interface TeachingStep {
  key: string;
  startLine: number;
  endLine: number;
  /** Exact expression column for the pointer, or null for line focus. */
  column: number | null;
  label: string;
  /** Exact range glow, or null for whole-line glow. */
  range: TeachingRange | null;
}

/**
 * Builds an interactive teaching session from a turn's resolved targets.
 * Invalid targets are dropped (their explanations still land as plain text);
 * an empty batch yields no session, so normal mode stays normal.
 */
export function createTeachingSteps(targets: ResolvedTeachingTarget[]): TeachingStep[] {
  return targets.flatMap((target, index) => {
    if (target.kind === 'invalid') return [];
    const lines = walkLinesForTarget(target);
    if (!lines.length) return [];
    return [
      {
        key: `teaching-step-${index}`,
        startLine: lines[0],
        endLine: lines[lines.length - 1],
        column: target.kind === 'range' ? target.range.startColumn : null,
        label: labelForWalk(lines, target.label),
        range: target.kind === 'range' ? target.range : null,
      },
    ];
  });
}
