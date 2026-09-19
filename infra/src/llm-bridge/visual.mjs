const ID = /^[a-z][a-z0-9-]{0,47}$/;
const NODE_TYPES = new Set(['client', 'gateway', 'compute', 'database', 'queue', 'storage', 'service', 'user']);
const ACTION_TYPES = new Set(['revealNode', 'revealEdge', 'focus', 'highlightNode', 'pulse', 'annotate', 'dimOthers', 'clearFocus', 'wait', 'finish']);
const FALLBACK_NODE_TYPES = ['client', 'gateway', 'compute', 'database', 'storage', 'service'];
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;

/** Matches an explicit learner request, not a tentative visual suggestion from the tutor. */
export function isDirectVisualRequest(value) {
  return /\b(?:show|make|draw|build|create|explain)\b[^.]{0,56}\b(?:visual(?:ly|isation|ization)?|flow\s*chart|flowchart|diagram|architecture|data\s*flow)\b|\b(?:flow\s*chart|flowchart|diagram|visual(?:ly|isation|ization)?)\b|फ्लो\s*चार्ट|फ्लोचार्ट|डायग्राम|विजुअल|चित्र/.test(String(value || '').toLowerCase());
}

const compact = (value, max) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
const teachingCue = (label, detail) => {
  const words = `${label}: ${detail || 'the next important idea in this lesson.'}`
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  // A short caption is easier to follow while the hand is moving. Keep the
  // learner-facing message small without inventing filler merely to hit a count.
  return words.slice(0, 12).join(' ').slice(0, 140);
};

/**
 * Produce a deterministic lesson/journey diagram only when a provider omitted
 * a required visual tool call. The learner's available path is preferred, so
 * this is a useful teaching canvas rather than an empty placeholder.
 */
export function buildDirectVisualPlan(context = {}) {
  const parsedJourney = String(context.learningPath || '').split(/\r?\n/).map((line) => {
    const match = line.trim().match(/^M(\d+)\s+L(\d+):\s*(.+?)(?:\s+—\s*(.+))?$/);
    return match ? {
      module: match[1],
      lesson: match[2],
      label: compact(`M${match[1]}.${match[2]} ${match[3]}`, 60),
      detail: compact(match[4] || `Key idea from ${match[3]}.`, 120),
    } : null;
  }).filter(Boolean);
  const journeyEntries = parsedJourney.length <= 16 ? parsedJourney : [...new Map(
    parsedJourney.map((entry) => [entry.module, {
      label: `Module ${entry.module}`,
      detail: `Covers the learning path through chapter ${entry.lesson}.`,
    }]),
  ).values()].slice(0, 16);
  const lines = String(context.lessonFlows || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const lessonFlow = lines.find((line) => line.includes('->')) || '';
  const colon = lessonFlow.indexOf(':');
  const flowTitle = colon >= 0 ? compact(lessonFlow.slice(0, colon), 100) : '';
  const labels = (colon >= 0 ? lessonFlow.slice(colon + 1) : lessonFlow)
    .split(/\s*->\s*/)
    .map((label) => compact(label, 60))
    .filter(Boolean)
    .slice(0, 6);
  const topic = compact(context.lessonTitle, 100) || 'Visual explanation';
  const sourceSteps = journeyEntries.length >= 2
    ? journeyEntries
    : (labels.length >= 2 ? labels.map((label) => ({ label, detail: `How ${label} fits into ${topic}.` })) : [
      { label: topic, detail: `Start with ${topic}.` },
      { label: 'Core idea', detail: `The central idea in ${topic}.` },
      { label: 'Result', detail: `The outcome of ${topic}.` },
    ]);
  const nodes = sourceSteps.map((step, index) => ({
    id: `step-${index + 1}`,
    label: step.label,
    type: FALLBACK_NODE_TYPES[index % FALLBACK_NODE_TYPES.length],
    detail: step.detail,
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    id: `flow-${index + 1}`,
    from: nodes[index].id,
    to: node.id,
    label: 'then',
  }));
  const steps = [];
  // Detailed teaching fits safely within the validated 64-step budget for ten
  // blocks. Larger journeys retain the same reveal → cue → pause rhythm, with
  // fewer decorative actions so the canvas remains valid rather than silently
  // failing to open.
  const detailedPlayback = nodes.length <= 10;
  nodes.forEach((node, index) => {
    steps.push({ type: 'revealNode', target: node.id });
    if (detailedPlayback) steps.push({ type: 'focus', target: node.id });
    steps.push({ type: 'annotate', target: node.id, text: teachingCue(node.label, node.detail) });
    if (detailedPlayback) steps.push({ type: 'pulse', target: node.id });
    steps.push({ type: 'wait', durationMs: 3200 });
    if (index > 0) steps.push({ type: 'revealEdge', target: edges[index - 1].id });
  });
  if (detailedPlayback) steps.push({ type: 'clearFocus' });
  steps.push({ type: 'finish' });
  return { title: journeyEntries.length >= 2 ? compact(`Learning journey to ${topic}`, 100) : flowTitle || `${topic} flow`, nodes, edges, steps };
}

/** Server-side guard before untrusted model output reaches the browser. */
export function validateVisualPlan(input) {
  if (!input || typeof input !== 'object' || !text(input.title, 100) || !Array.isArray(input.nodes) || !Array.isArray(input.edges) || !Array.isArray(input.steps)) return false;
  if (input.nodes.length > 16 || input.edges.length > 24 || input.steps.length > 64) return false;
  const nodes = new Set();
  for (const node of input.nodes) {
    if (!node || !text(node.id, 48) || !ID.test(node.id) || nodes.has(node.id) || !text(node.label, 60) || !NODE_TYPES.has(node.type)) return false;
    nodes.add(node.id);
  }
  const edges = new Set();
  for (const edge of input.edges) {
    if (!edge || !text(edge.id, 48) || !ID.test(edge.id) || edges.has(edge.id) || !nodes.has(edge.from) || !nodes.has(edge.to) || edge.from === edge.to || (edge.label !== undefined && !text(edge.label, 48))) return false;
    edges.add(edge.id);
  }
  for (const step of input.steps) {
    if (!step || !ACTION_TYPES.has(step.type)) return false;
    const nodeAction = ['revealNode', 'focus', 'highlightNode', 'pulse', 'annotate', 'dimOthers'].includes(step.type);
    const edgeAction = step.type === 'revealEdge';
    // Optional targets (wait/finish/clearFocus) still must be well-formed ids
    // when present — mirrors the frontend schema in visualSchema.ts.
    if ((nodeAction && !nodes.has(step.target)) || (edgeAction && !edges.has(step.target)) || (step.target !== undefined && (!text(step.target, 48) || !ID.test(step.target)))) return false;
    if (step.text !== undefined && !text(step.text, 140)) return false;
    if (step.durationMs !== undefined && (!Number.isFinite(step.durationMs) || step.durationMs < 0 || step.durationMs > 6000)) return false;
  }
  return true;
}

export function sanitizeVisualToolCalls(calls = []) {
  return calls.filter((call) => {
    if (call?.name === 'presentVisualExplanation') return validateVisualPlan(call.args);
    if (call?.name === 'offerVisualExplanation') return text(call.args?.topic, 100) && (call.args?.reason === undefined || text(call.args.reason, 160));
    if (call?.name === 'updateVisualExplanation') return Array.isArray(call.args?.actions) && call.args.actions.length <= 12 && call.args.actions.every((step) => step && ACTION_TYPES.has(step.type) && (step.target === undefined || (text(step.target, 48) && ID.test(step.target))) && (step.text === undefined || text(step.text, 140)));
    return true;
  });
}

/**
 * Tool use is probabilistic for every supported LLM. A direct learner request
 * is not: it is a UI command. Preserve a valid model plan when present, and
 * supply a safe lesson-derived plan only if the provider returned none.
 */
export function ensureDirectVisualPlan(calls = [], transcript = '', context = {}) {
  if (!isDirectVisualRequest(transcript) || calls.some((call) => call?.name === 'presentVisualExplanation')) return calls;
  return [...calls, { name: 'presentVisualExplanation', args: buildDirectVisualPlan(context) }];
}
