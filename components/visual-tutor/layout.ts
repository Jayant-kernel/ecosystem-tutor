import type { VisualPlan } from './visualTypes';

export interface VisualPosition { x: number; y: number; }

/** React Flow coordinate spacing (px) between layout columns and rows. */
const COLUMN_SPACING = 300;
const ROW_SPACING = 160;
const MAX_DEPTH = 5;

/**
 * Deterministic layered layout for 2-16 educational nodes, in React Flow
 * pixel coordinates. Nodes are placed in left-to-right columns derived from a
 * BFS over the plan's edges (fallback: plan order when there are no usable
 * edges). Cycles are handled by visiting each node once. No layout dependency
 * and no model-generated coordinates.
 */
export function computeVisualLayout(plan: VisualPlan): Record<string, VisualPosition> {
  const positions: Record<string, VisualPosition> = {};
  if (!plan.nodes.length) return positions;

  const depth = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const node of plan.nodes) {
    depth.set(node.id, 0);
    outgoing.set(node.id, []);
  }
  for (const edge of plan.edges) {
    if (outgoing.has(edge.from)) outgoing.get(edge.from)!.push(edge.to);
  }

  // BFS from edge-less roots; cap depth so long chains do not overflow columns.
  const roots = plan.nodes.filter(
    (node) => !plan.edges.some((edge) => edge.to === node.id && edge.from !== node.id),
  );
  const seeds = roots.length ? roots : [plan.nodes[0]];
  const visited = new Set<string>();
  for (const seed of seeds) {
    if (visited.has(seed.id)) continue;
    visited.add(seed.id);
    const frontier: Array<{ id: string; depth: number }> = [{ id: seed.id, depth: 0 }];
    while (frontier.length) {
      const current = frontier.shift()!;
      depth.set(current.id, Math.min(current.depth, MAX_DEPTH));
      for (const next of outgoing.get(current.id) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        frontier.push({ id: next, depth: current.depth + 1 });
      }
    }
  }
  // Nodes unreachable from the seeds (disconnected graphs, cycle tails) keep a
  // stable depth that does not collide with the seeded ranks.
  for (const node of plan.nodes) {
    if (visited.has(node.id)) continue;
    depth.set(node.id, Math.min((depth.get(node.id) ?? 0) + visited.size, MAX_DEPTH));
    visited.add(node.id);
  }

  // Column -> row assignment in stable plan order.
  const columns = new Map<number, string[]>();
  for (const node of plan.nodes) {
    const col = Math.min(depth.get(node.id) ?? 0, MAX_DEPTH);
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col)!.push(node.id);
  }

  const ordered = [...columns.keys()].sort((a, b) => a - b);
  for (const col of ordered) {
    const members = columns.get(col)!;
    members.forEach((id, rowIndex) => {
      // Center each column vertically around row 0 so single-node columns sit
      // level with multi-node ones.
      const offset = (members.length - 1) / 2;
      positions[id] = { x: col * COLUMN_SPACING, y: (rowIndex - offset) * ROW_SPACING };
    });
  }

  return positions;
}

/** Deterministic fallback plan used when the model offers no usable one. */
export function buildFallbackPlan(topic: string): VisualPlan {
  const labels = ['Starting point', 'Process', 'Result'];
  const types = ['client', 'compute', 'storage'] as const;
  const nodes = labels.map((label, index) => ({
    id: `step-${index + 1}`,
    label: index === 0 && topic ? topic.slice(0, 60) : label,
    type: types[index],
    detail: index === 0 ? topic.slice(0, 120) : undefined,
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    id: `flow-${index + 1}`,
    from: nodes[index].id,
    to: node.id,
    label: 'then',
  }));
  const steps = [] as VisualPlan['steps'];
  nodes.forEach((node, index) => {
    steps.push({ type: 'revealNode', target: node.id });
    steps.push({ type: 'focus', target: node.id });
    if (index > 0) steps.push({ type: 'revealEdge', target: edges[index - 1].id });
  });
  steps.push({ type: 'clearFocus' }, { type: 'finish' });
  return { title: topic || 'Explanation', nodes, edges, steps };
}
