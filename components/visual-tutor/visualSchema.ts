import { VISUAL_ACTION_TYPES, VISUAL_NODE_TYPES, type VisualPlan, type VisualStep } from './visualTypes';

const MAX_NODES = 16;
const MAX_EDGES = 24;
const MAX_STEPS = 64;
const ID = /^[a-z][a-z0-9-]{0,47}$/;
const string = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;

export type VisualValidation = { success: true; data: VisualPlan } | { success: false; error: string };

/** Treat every visual payload from the model as untrusted data. */
export function validateVisualPlan(input: unknown): VisualValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { success: false, error: 'Visual plan must be an object.' };
  const raw = input as Record<string, unknown>;
  if (!string(raw.title, 100) || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges) || !Array.isArray(raw.steps)) {
    return { success: false, error: 'Visual plan is missing title, nodes, edges, or steps.' };
  }
  if (raw.nodes.length > MAX_NODES || raw.edges.length > MAX_EDGES || raw.steps.length > MAX_STEPS) {
    return { success: false, error: 'Visual plan exceeds safety limits.' };
  }
  const seen = new Set<string>();
  const nodes = [] as VisualPlan['nodes'];
  for (const node of raw.nodes) {
    if (!node || typeof node !== 'object') return { success: false, error: 'Invalid visual node.' };
    const value = node as Record<string, unknown>;
    if (!string(value.id, 48) || !ID.test(value.id as string) || seen.has(value.id as string) || !string(value.label, 60) || !VISUAL_NODE_TYPES.includes(value.type as never)) {
      return { success: false, error: 'Visual node has an invalid id, label, or type.' };
    }
    seen.add(value.id as string);
    nodes.push({ id: value.id as string, label: (value.label as string).trim(), type: value.type as VisualPlan['nodes'][number]['type'], detail: string(value.detail, 120) ? (value.detail as string).trim() : undefined });
  }
  const edgeIds = new Set<string>();
  const edges = [] as VisualPlan['edges'];
  for (const edge of raw.edges) {
    if (!edge || typeof edge !== 'object') return { success: false, error: 'Invalid visual edge.' };
    const value = edge as Record<string, unknown>;
    if (!string(value.id, 48) || !ID.test(value.id as string) || edgeIds.has(value.id as string) || !seen.has(value.from as string) || !seen.has(value.to as string) || value.from === value.to || (value.label !== undefined && !string(value.label, 48))) {
      return { success: false, error: 'Visual edge has an invalid id or endpoint.' };
    }
    edgeIds.add(value.id as string);
    edges.push({ id: value.id as string, from: value.from as string, to: value.to as string, label: typeof value.label === 'string' ? value.label.trim() : undefined });
  }
  const steps = [] as VisualStep[];
  for (const step of raw.steps) {
    if (!step || typeof step !== 'object') return { success: false, error: 'Invalid visual step.' };
    const value = step as Record<string, unknown>;
    if (!VISUAL_ACTION_TYPES.includes(value.type as never)) return { success: false, error: 'Unsupported visual action.' };
    const needsNode = ['revealNode', 'focus', 'highlightNode', 'pulse', 'annotate', 'dimOthers'].includes(value.type as string);
    const needsEdge = value.type === 'revealEdge';
    if ((needsNode && !seen.has(value.target as string)) || (needsEdge && !edgeIds.has(value.target as string)) || (value.target !== undefined && (!string(value.target, 48) || !ID.test(value.target as string)))) {
      return { success: false, error: 'Visual step refers to an unknown target.' };
    }
    if (value.text !== undefined && !string(value.text, 140)) return { success: false, error: 'Visual annotation is too long.' };
    const duration = Number(value.durationMs);
    if (value.durationMs !== undefined && (!Number.isFinite(duration) || duration < 0 || duration > 6000)) return { success: false, error: 'Visual timing is out of bounds.' };
    steps.push({ type: value.type as VisualStep['type'], target: value.target as string | undefined, text: typeof value.text === 'string' ? value.text.trim() : undefined, durationMs: value.durationMs === undefined ? undefined : duration });
  }
  return { success: true, data: { title: (raw.title as string).trim(), nodes, edges, steps } };
}

export function visualSceneSummary(plan: VisualPlan | null, status: string, activeNodeId: string | null) {
  if (!plan) return 'No visual scene is open.';
  return `Visual scene: ${plan.title}. Nodes: ${plan.nodes.map((node) => node.id).join(', ')}. Edges: ${plan.edges.map((edge) => edge.id).join(', ')}. State: ${status}${activeNodeId ? `; focus: ${activeNodeId}` : ''}.`;
}
