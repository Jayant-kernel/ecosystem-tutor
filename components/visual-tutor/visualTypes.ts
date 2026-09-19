export const VISUAL_NODE_TYPES = ['client', 'gateway', 'compute', 'database', 'queue', 'storage', 'service', 'user'] as const;
export const VISUAL_ACTION_TYPES = [
  'revealNode', 'revealEdge', 'focus', 'highlightNode', 'pulse', 'annotate', 'dimOthers', 'clearFocus', 'wait', 'finish',
] as const;

export type VisualNodeType = typeof VISUAL_NODE_TYPES[number];
export type VisualActionType = typeof VISUAL_ACTION_TYPES[number];
export type VisualStatus = 'idle' | 'offered' | 'playing' | 'paused' | 'interactive' | 'completed' | 'error';

export interface VisualNode { id: string; label: string; type: VisualNodeType; detail?: string; }
export interface VisualEdge { id: string; from: string; to: string; label?: string; }
export interface VisualStep { type: VisualActionType; target?: string; text?: string; durationMs?: number; }
export interface VisualPlan { title: string; nodes: VisualNode[]; edges: VisualEdge[]; steps: VisualStep[]; }
export interface VisualAnnotation { target: string; text: string; }
export interface VisualSceneState {
  status: VisualStatus;
  plan: VisualPlan | null;
  activeStep: number;
  visibleNodeIds: string[];
  visibleEdgeIds: string[];
  activeNodeId: string | null;
  pointerTargetId: string | null;
  dimmed: boolean;
  annotations: VisualAnnotation[];
  /** Node currently playing a pulse animation (transient, not sticky). */
  pulsingNodeId: string | null;
  error: string | null;
}

export type VisualAction =
  | { type: 'load'; plan: VisualPlan }
  | { type: 'step'; step: VisualStep; index: number }
  | { type: 'complete' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'reset' }
  | { type: 'error'; message: string };

export const EMPTY_VISUAL_SCENE: VisualSceneState = {
  status: 'idle', plan: null, activeStep: -1, visibleNodeIds: [], visibleEdgeIds: [], activeNodeId: null,
  pointerTargetId: null, dimmed: false, annotations: [], pulsingNodeId: null, error: null,
};
