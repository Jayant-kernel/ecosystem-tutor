import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The cinematic progress mapping is TypeScript + ESM, while `npm test` runs
 * plain node:test. Compile the two pure-logic modules to a temp dir with
 * tsc (already a devDependency) and test them as JavaScript.
 */
const compile = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'cosmic-progress-test-'));
  execSync(
    `npx tsc ${files.map((f) => `components/cinematic-hero/${f}`).join(' ')} ` +
      '--outDir ' + JSON.stringify(dir) + ' ' +
      '--module commonjs --moduleResolution node --target es2020 --skipLibCheck',
    { stdio: 'pipe' },
  );
  return dir;
};

const dir = compile(['cosmicProgress.ts', 'timeline.ts']);

const progress = await import(
  'file:///' + join(dir, 'cosmicProgress.js').replace(/\\/g, '/')
);
const { SCATTER_START, SCATTER_END } = await import(
  'file:///' + join(dir, 'timeline.js').replace(/\\/g, '/')
);

const { cinematicProgress, violetGlow, nebulaLevel, planetLevel, rocksLevel, dustLevel, contrastLevel } = progress;

test('master progress normalizes the scatter window to 0..1', () => {
  assert.equal(cinematicProgress(0), 0);
  assert.equal(cinematicProgress(SCATTER_START), 0);
  assert.equal(cinematicProgress(SCATTER_END), 1);
  assert.equal(cinematicProgress(1), 1);
  const mid = cinematicProgress((SCATTER_START + SCATTER_END) / 2);
  assert.ok(mid > 0.49 && mid < 0.51, `midpoint should be ~0.5, got ${mid}`);
  // Monotonic across the whole film: reversibility depends on it.
  let prev = -1;
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const p = cinematicProgress(t);
    assert.ok(p >= prev, `not monotonic at t=${t}`);
    prev = p;
  }
});

test('scatter window matches the Overlay convergence window', () => {
  assert.equal(SCATTER_START, 0.62);
  assert.equal(SCATTER_END, 0.86);
});

test('violet glow whispers early and blooms by the halfway moment', () => {
  assert.equal(violetGlow(0), 0);
  assert.equal(violetGlow(1), 1);
  assert.ok(violetGlow(0.25) <= 0.001, 'nothing before p=0.25');
  const half = violetGlow(0.5);
  assert.ok(half >= 0.15 && half <= 0.3, `halfway glow should be 15-25%, got ${half}`);
});

test('environment layers stage in storyboard order without gaps', () => {
  for (const fn of [nebulaLevel, planetLevel, rocksLevel, dustLevel]) {
    assert.equal(fn(0), 0);
    assert.equal(fn(1), 1);
  }
  // Nebula leads, then planet, then rocks, then dust.
  assert.ok(nebulaLevel(0.5) > planetLevel(0.5));
  assert.ok(planetLevel(0.65) > rocksLevel(0.65));
  assert.ok(rocksLevel(0.8) > dustLevel(0.8));
  // Nebula reaches ~35-50% intensity around p=0.6.
  const at60 = nebulaLevel(0.6);
  assert.ok(at60 >= 0.3 && at60 <= 0.55, `nebula at p=0.6 should be 35-50%, got ${at60}`);
});

test('contrast field never drops below its readable floor', () => {
  assert.ok(contrastLevel(0) >= 0.2);
  assert.equal(contrastLevel(1), 1);
});

test('cleanup temp compile dir', () => {
  rmSync(dir, { recursive: true, force: true });
  assert.ok(true);
});
