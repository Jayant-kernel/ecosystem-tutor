import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The visual-tutor logic modules are TypeScript + ESM, while `npm test` runs
 * plain node:test. Compile the three pure-logic modules to a temp dir with
 * tsc (already a devDependency) and test them as JavaScript.
 */
const compile = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'visual-tutor-test-'));
  execSync(
    `npx tsc ${files.map((f) => `components/visual-tutor/${f}`).join(' ')} ` +
      '--outDir ' + JSON.stringify(dir) + ' ' +
      '--module commonjs --moduleResolution node --target es2020 --skipLibCheck',
    { stdio: 'pipe' },
  );
  return dir;
};

// Strip `import '@xyflow/react/dist/style.css'`-style imports from the compiled
// output is unnecessary: we only compile the pure logic files below.
const dir = compile(['visualTypes.ts', 'visualReducer.ts', 'layout.ts']);

const { visualReducer } = await import(
  'file:///' + join(dir, 'visualReducer.js').replace(/\\/g, '/')
);
const { computeVisualLayout, buildFallbackPlan } = await import(
  'file:///' + join(dir, 'layout.js').replace(/\\/g, '/')
);
const { EMPTY_VISUAL_SCENE } = await import(
  'file:///' + join(dir, 'visualTypes.js').replace(/\\/g, '/')
);
const PLAN = {
  title: 'Kafka pipeline',
  nodes: [
    { id: 'producer', label: 'Producer', type: 'client' },
    { id: 'kafka', label: 'Kafka', type: 'queue' },
    { id: 'spark', label: 'Spark', type: 'compute' },
  ],
  edges: [
    { id: 'producer-kafka', from: 'producer', to: 'kafka', label: 'publishes' },
    { id: 'kafka-spark', from: 'kafka', to: 'spark', label: 'streams' },
  ],
  steps: [
    { type: 'revealNode', target: 'producer' },
    { type: 'revealNode', target: 'kafka' },
    { type: 'revealEdge', target: 'producer-kafka' },
    { type: 'pulse', target: 'kafka' },
    { type: 'annotate', target: 'kafka', text: 'ingest point' },
    { type: 'dimOthers', target: 'kafka' },
    { type: 'clearFocus' },
    { type: 'finish' },
  ],
};

test('visualReducer reveals nodes and edges incrementally', () => {
  let state = { ...EMPTY_VISUAL_SCENE, plan: PLAN };
  state = visualReducer(state, { type: 'load', plan: PLAN });
  assert.equal(state.status, 'playing');
  state = visualReducer(state, { type: 'step', index: 0, step: PLAN.steps[0] });
  assert.deepEqual(state.visibleNodeIds, ['producer']);
  state = visualReducer(state, { type: 'step', index: 1, step: PLAN.steps[1] });
  assert.deepEqual(state.visibleNodeIds, ['producer', 'kafka']);
  state = visualReducer(state, { type: 'step', index: 2, step: PLAN.steps[2] });
  assert.deepEqual(state.visibleEdgeIds, ['producer-kafka']);
});

test('visualReducer never reveals an edge before both endpoints are visible', () => {
  let state = { ...EMPTY_VISUAL_SCENE, plan: PLAN };
  state = visualReducer(state, { type: 'load', plan: PLAN });
  state = visualReducer(state, { type: 'step', index: 0, step: { type: 'revealNode', target: 'producer' } });
  state = visualReducer(state, { type: 'step', index: 1, step: { type: 'revealEdge', target: 'producer-kafka' } });
  assert.deepEqual(state.visibleEdgeIds, []);
  state = visualReducer(state, { type: 'step', index: 2, step: { type: 'revealNode', target: 'kafka' } });
  state = visualReducer(state, { type: 'step', index: 3, step: { type: 'revealEdge', target: 'producer-kafka' } });
  assert.deepEqual(state.visibleEdgeIds, ['producer-kafka']);
});

test('visualReducer revealNode never duplicates an id', () => {
  let state = { ...EMPTY_VISUAL_SCENE, plan: PLAN };
  state = visualReducer(state, { type: 'step', index: 0, step: PLAN.steps[0] });
  state = visualReducer(state, { type: 'step', index: 1, step: PLAN.steps[0] });
  assert.deepEqual(state.visibleNodeIds, ['producer']);
});

test('visualReducer pulse sets a transient pulsing node and clears on completion', () => {
  let state = { ...EMPTY_VISUAL_SCENE, plan: PLAN };
  state = visualReducer(state, { type: 'step', index: 3, step: { type: 'pulse', target: 'kafka' } });
  assert.equal(state.pulsingNodeId, 'kafka');
  state = visualReducer(state, { type: 'complete' });
  assert.equal(state.pulsingNodeId, null);
  assert.equal(state.status, 'interactive');
});

test('visualReducer annotate stores one annotation per target and clearFocus resets emphasis', () => {
  let state = { ...EMPTY_VISUAL_SCENE, plan: PLAN };
  state = visualReducer(state, { type: 'step', index: 4, step: { type: 'annotate', target: 'kafka', text: 'ingest point' } });
  state = visualReducer(state, { type: 'step', index: 5, step: { type: 'annotate', target: 'kafka', text: 'updated' } });
  assert.deepEqual(state.annotations, [{ target: 'kafka', text: 'updated' }]);
  state = visualReducer(state, { type: 'step', index: 5, step: { type: 'dimOthers', target: 'kafka' } });
  assert.equal(state.dimmed, true);
  assert.equal(state.activeNodeId, 'kafka');
  state = visualReducer(state, { type: 'step', index: 6, step: { type: 'clearFocus' } });
  assert.equal(state.dimmed, false);
  assert.equal(state.activeNodeId, null);
});

test('computeVisualLayout places a linear pipeline left to right in plan order', () => {
  const positions = computeVisualLayout(PLAN);
  assert.equal(positions.producer.x < positions.kafka.x, true);
  assert.equal(positions.kafka.x < positions.spark.x, true);
  assert.ok(Number.isFinite(positions.producer.x) && Number.isFinite(positions.producer.y));
});

test('computeVisualLayout is deterministic and handles 16 nodes', () => {
  const big = {
    title: 'mesh',
    nodes: Array.from({ length: 16 }, (_, i) => ({ id: `n${i}`, label: `N${i}`, type: 'service' })),
    edges: Array.from({ length: 15 }, (_, i) => ({ id: `e${i}`, from: `n${i}`, to: `n${i + 1}` })),
    steps: [],
  };
  const a = computeVisualLayout(big);
  const b = computeVisualLayout(big);
  assert.deepEqual(a, b);
  assert.equal(Object.keys(a).length, 16);
  for (const node of big.nodes) {
    assert.ok(Number.isFinite(a[node.id].x) && Number.isFinite(a[node.id].y));
  }
});

test('computeVisualLayout survives cycles and empty plans', () => {
  const cyclic = {
    title: 'cycle',
    nodes: [
      { id: 'a', label: 'A', type: 'service' },
      { id: 'b', label: 'B', type: 'service' },
{ id: 'c', label: 'C', type: 'service' },
    ],
    edges: [
      { id: 'ab', from: 'a', to: 'b' },
      { id: 'bc', from: 'b', to: 'c' },
      { id: 'ca', from: 'c', to: 'a' },
    ],
    steps: [],
  };
  const positions = computeVisualLayout(cyclic);
  assert.equal(Object.keys(positions).length, 3);
  assert.deepEqual(computeVisualLayout({ title: 'empty', nodes: [], edges: [], steps: [] }), {});
});

test('buildFallbackPlan produces a valid revealable 3-step chain', () => {
  const plan = buildFallbackPlan('Kafka streaming');
  assert.equal(plan.nodes.length, 3);
  assert.equal(plan.edges.length, 2);
  for (const step of plan.steps) {
    if (step.type === 'revealNode') assert.ok(plan.nodes.some((n) => n.id === step.target));
    if (step.type === 'revealEdge') assert.ok(plan.edges.some((e) => e.id === step.target));
  }
});

test('cleanup temp compile dir', () => {
  rmSync(dir, { recursive: true, force: true });
  assert.ok(true);
});
