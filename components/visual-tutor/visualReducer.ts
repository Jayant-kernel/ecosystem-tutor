import { EMPTY_VISUAL_SCENE, type VisualAction, type VisualSceneState } from './visualTypes';

export function visualReducer(state: VisualSceneState, action: VisualAction): VisualSceneState {
  if (action.type === 'reset') return EMPTY_VISUAL_SCENE;
  if (action.type === 'error') return { ...state, status: 'error', error: action.message };
  if (action.type === 'load') return { ...EMPTY_VISUAL_SCENE, status: 'playing', plan: action.plan };
  if (action.type === 'pause') return { ...state, status: 'paused' };
  if (action.type === 'resume') return { ...state, status: 'playing' };
  if (action.type === 'complete') return { ...state, status: 'interactive', activeStep: state.plan?.steps.length ?? state.activeStep, pulsingNodeId: null };
  const step = action.step;
  const include = (values: string[], id?: string) => id && !values.includes(id) ? [...values, id] : values;
  const annotation = step.type === 'annotate' && step.target && step.text
    ? [...state.annotations.filter((item) => item.target !== step.target), { target: step.target, text: step.text }]
    : state.annotations;
  const focusesNode = ['focus', 'highlightNode', 'pulse', 'dimOthers'].includes(step.type);
  // An edge must never appear before both of its endpoint nodes are visible,
  // even if a reveal step arrives out of order.
  const edgeReady =
    step.type !== 'revealEdge' ||
    (state.plan?.edges.some(
      (edge) =>
        edge.id === step.target &&
        state.visibleNodeIds.includes(edge.from) &&
        state.visibleNodeIds.includes(edge.to),
    ) ??
      false);
  return {
    ...state,
    activeStep: action.index,
    visibleNodeIds: step.type === 'revealNode' ? include(state.visibleNodeIds, step.target) : state.visibleNodeIds,
    visibleEdgeIds:
      step.type === 'revealEdge' && edgeReady ? include(state.visibleEdgeIds, step.target) : state.visibleEdgeIds,
    activeNodeId: focusesNode ? step.target || state.activeNodeId : step.type === 'clearFocus' ? null : state.activeNodeId,
    pointerTargetId: ['focus', 'highlightNode', 'pulse'].includes(step.type) ? step.target || state.pointerTargetId : step.type === 'clearFocus' ? null : state.pointerTargetId,
    dimmed: step.type === 'dimOthers' ? true : step.type === 'clearFocus' ? false : state.dimmed,
    // A pulse is a beat, not a state: it clears itself once the pulse node
    // changes so the animation does not loop forever on the same node.
    pulsingNodeId: step.type === 'pulse' ? step.target ?? state.pulsingNodeId : state.pulsingNodeId,
    annotations: annotation,
  };
}
