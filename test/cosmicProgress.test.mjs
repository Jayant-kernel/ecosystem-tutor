import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The cosmic progress mapping is TypeScript + ESM, while `npm test` runs
 * plain node:test. Compile the two pure-logic modules to a temp dir with
 * tsc (already a devDependency) and test them as JavaScript.
 */
const compile = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'cosmic-progress-test-'));
  execSync(
    // CI installs the root dev dependencies. Refuse npx's network fallback so
    // an absent TypeScript compiler fails clearly instead of downloading the
    // unrelated `tsc` package.
    `${process.platform === 'win32' ? 'npx.cmd' : 'npx'} --no-install tsc ` +
      `${files.map((f) => `components/cinematic-hero/${f}`).join(' ')} ` +
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
const { COSMIC_REVEAL_START, COSMIC_REVEAL_END, cosmicProgress } = await import(
  'file:///' + join(dir, 'timeline.js').replace(/\\/g, '/')
);

const { emberGlow, nebulaLevel, rocksLevel, dustLevel, contrastLevel } = progress;

test('cosmic reveal window sits after the handoff lock', () => {
  assert.ok(COSMIC_REVEAL_START >= 0.86, 'reveal must start after handoff assembly');
  assert.equal(COSMIC_REVEAL_END, 1);
  assert.equal(cosmicProgress(0), 0);
  assert.equal(cosmicProgress(COSMIC_REVEAL_START), 0);
  assert.equal(cosmicProgress(COSMIC_REVEAL_END), 1);
  assert.equal(cosmicProgress(1), 1);
  // Monotonic across the whole film: reversibility depends on it.
  let prev = -1;
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const p = cosmicProgress(t);
    assert.ok(p >= prev, `not monotonic at t=${t}`);
    prev = p;
  }
});

test('ember glow whispers early and blooms by the halfway moment', () => {
  assert.equal(emberGlow(0), 0);
  assert.equal(emberGlow(1), 1);
  assert.ok(emberGlow(0.25) <= 0.001, 'nothing before p=0.25');
  const half = emberGlow(0.5);
  assert.ok(half >= 0.15 && half <= 0.3, `halfway glow should be 15-25%, got ${half}`);
});

test('environment layers stage in storyboard order without gaps', () => {
  for (const fn of [nebulaLevel, rocksLevel, dustLevel]) {
    assert.equal(fn(0), 0);
    assert.equal(fn(1), 1);
  }
  // Nebula leads, then rocks, then dust.
  assert.ok(nebulaLevel(0.5) > rocksLevel(0.5));
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
