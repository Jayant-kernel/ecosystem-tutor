import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import TeachingNode, { type TeachingNodeData } from './TeachingNode';
import VisualTutorPointer, { type HandPhase } from './VisualTutorPointer';
import { VisualPlaybackEngine } from './VisualPlaybackEngine';
import { visualReducer } from './visualReducer';
import { computeVisualLayout, type VisualPosition } from './layout';
import {
  EMPTY_VISUAL_SCENE,
  type VisualPlan,
  type VisualSceneState,
  type VisualStep,
} from './visualTypes';

interface Props {
  plan: VisualPlan;
  followUpSteps?: VisualStep[];
  onClose: () => void;
  onSceneChange?: (scene: VisualSceneState) => void;
}

const nodeTypes = { teaching: TeachingNode };

/** The internal staging point the hand departs from when picking a new node. */
const STAGING_POSITION: VisualPosition = { x: 40, y: 40 };

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The visual teaching canvas. React Flow is the learner's real canvas; the
 * playback engine reveals nodes/edges step by step while the virtual hand
 * travels between the actual rendered DOM rectangles.
 */
function VisualTutorCanvasInner({ plan, followUpSteps = [], onClose, onSceneChange }: Props) {
  const [scene, dispatch] = useReducer(visualReducer, EMPTY_VISUAL_SCENE);
  const engineRef = useRef<VisualPlaybackEngine | null>(null);
  const appliedFollowUps = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hand, setHand] = useState<HandPhase>({ kind: 'idle' });
  const [handEffect, setHandEffect] = useState<'grab' | 'point'>('point');
  // Resolved by <VisualTutorPointer onArrive> when the current travel ends.
  const arriveResolver = useRef<(() => void) | null>(null);
  const { fitView } = useReactFlow();

  const positions = useMemo(() => computeVisualLayout(plan), [plan]);

  /** Wait for React to commit freshly revealed nodes before measuring/fitting. */
  const nextFrames = useCallback(
    (count = 2) =>
      new Promise<void>((resolve) => {
        const tick = (left: number) => {
          if (left <= 0) resolve();
          else requestAnimationFrame(() => tick(left - 1));
        };
        tick(count);
      }),
    [],
  );

  /**
   * Keep every revealed node on screen as the diagram grows, so the hand and
   * the nodes it points at are never clipped outside the canvas.
   */
  const frameRevealed = useCallback(
    async (animated: boolean) => {
      await nextFrames();
      try {
        fitView({ padding: 0.35, duration: animated ? 280 : 0 });
      } catch {
        /* canvas torn down mid-frame — ignore */
      }
      if (animated) await new Promise<void>((resolve) => setTimeout(resolve, 320));
    },
    [fitView, nextFrames],
  );

  // React Flow model: only revealed nodes/edges are mounted. An edge never
  // appears before both of its endpoint nodes are visible.
  const nodes = useMemo<Node<TeachingNodeData>[]>(
    () =>
      plan.nodes
        .filter((node) => scene.visibleNodeIds.includes(node.id))
        .map((node) => {
          const pos = positions[node.id] ?? { x: 0, y: 0 };
          const focused = scene.activeNodeId === node.id;
          return {
            id: node.id,
            type: 'teaching' as const,
            position: { x: pos.x, y: pos.y },
            draggable: false,
            deletable: false,
            connectable: false,
            data: {
              label: node.label,
              detail: node.detail,
              type: node.type,
              active: focused,
              dimmed: scene.dimmed && !focused,
              pulse: scene.pulsingNodeId === node.id,
              annotation: scene.annotations.find((item) => item.target === node.id)?.text,
            },
          };
        }),
    [plan.nodes, positions, scene.visibleNodeIds, scene.activeNodeId, scene.dimmed, scene.pulsingNodeId, scene.annotations],
  );

  const edges = useMemo<Edge[]>(
    () =>
      plan.edges
        .filter((edge) => {
          if (!scene.visibleEdgeIds.includes(edge.id)) return false;
          return scene.visibleNodeIds.includes(edge.from) && scene.visibleNodeIds.includes(edge.to);
        })
        .map((edge) => ({
          id: edge.id,
          source: edge.from,
          target: edge.to,
          label: edge.label,
          deletable: false,
          selectable: false,
          style: { stroke: '#fb923c', strokeWidth: 2 },
          labelStyle: { fill: '#fdba74', fontSize: 10, fontWeight: 700 },
          labelBgStyle: { fill: '#101010', fillOpacity: 0.85 },
        })),
    [plan.edges, scene.visibleEdgeIds, scene.visibleNodeIds],
  );

  // The same short cue lives near the active block and here as a stable
  // classroom-style subtitle, so learners do not have to chase a small node
  // label while the camera and hand are moving.
  const teachingCue = useMemo(() => {
    const active = scene.activeNodeId
      ? scene.annotations.find((item) => item.target === scene.activeNodeId)
      : undefined;
    return active ?? scene.annotations[scene.annotations.length - 1] ?? null;
  }, [scene.activeNodeId, scene.annotations]);

  /** Resolve a semantic node id to container-relative pixel coordinates. */
  const measureNode = useCallback((nodeId: string): VisualPosition | null => {
    const container = containerRef.current;
    if (!container) return null;
    const el = container.querySelector<HTMLElement>(`[data-visual-node-id="${CSS.escape(nodeId)}"]`);
    if (!el) return null;
    const nodeRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    return {
      x: nodeRect.left - containerRect.left + nodeRect.width / 2,
      y: nodeRect.top - containerRect.top + nodeRect.height / 2,
    };
  }, []);

  /** Send the hand somewhere; resolves on arrival (instant under reduced motion). */
  const travel = useCallback(
    (to: VisualPosition, effect: 'grab' | 'point'): Promise<void> =>
      new Promise((resolve) => {
        if (prefersReducedMotion()) {
          setHand({ kind: 'visible', at: to });
          resolve();
          return;
        }
        arriveResolver.current = resolve;
        setHandEffect(effect);
        setHand({ kind: 'travel', to });
      }),
    [],
  );

  /**
   * Travel to a revealed node's real DOM rectangle, retrying across a few
   * frames because the node mounts in the same tick the step dispatches.
   */
  const travelToNode = useCallback(
    async (nodeId: string, effect: 'grab' | 'point' = 'point'): Promise<void> => {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const target = measureNode(nodeId);
        if (target) {
          await travel(target, effect);
          return;
        }
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
    },
    [measureNode, travel],
  );

  const travelToStaging = useCallback(() => travel(STAGING_POSITION, 'point'), [travel]);

  // Steps are async: revealNode waits for the hand's travel, revealEdge waits
  // for the source→target travel. The engine serialises them. Edge endpoint
  // readiness is enforced by the reducer, so this closure never needs fresh
  // scene state for correctness.
  const runStep = useCallback(
    async (step: VisualStep, nextIndex: number) => {
      switch (step.type) {
        case 'revealNode': {
          if (!step.target) return;
          // 1. hand picks from the teaching palette…
          await travelToStaging();
          // 2. …the reveal mounts the React Flow node, the camera frames it,
          // and the hand glides to its real rectangle with a drop effect.
          dispatch({ type: 'step', step, index: nextIndex });
          await frameRevealed(!prefersReducedMotion());
          await travelToNode(step.target, 'grab');
          return;
        }
        case 'revealEdge': {
          const edge = plan.edges.find((item) => item.id === step.target);
          if (!edge) return;
          await travelToNode(edge.from, 'point');
          await travelToNode(edge.to, 'point');
          dispatch({ type: 'step', step, index: nextIndex });
          return;
        }
        case 'focus':
        case 'highlightNode':
        case 'pulse': {
          if (!step.target) return;
          dispatch({ type: 'step', step, index: nextIndex });
          await travelToNode(step.target, 'point');
          return;
        }
        case 'annotate':
        case 'dimOthers':
        case 'clearFocus':
          dispatch({ type: 'step', step, index: nextIndex });
          return;
        case 'wait': {
          dispatch({ type: 'step', step, index: nextIndex });
          // `wait` is intentional teaching pacing from the validated plan.
          // Keep it bounded just like the schema so a model can never stall
          // the lesson for an excessive amount of time.
          const delay = Math.max(0, Math.min(6000, step.durationMs ?? 1200));
          if (delay) await new Promise<void>((resolve) => window.setTimeout(resolve, delay));
          return;
        }
        case 'finish':
          dispatch({ type: 'step', step, index: nextIndex });
          // Final framing, then park the hand so it never covers the diagram.
          await frameRevealed(!prefersReducedMotion());
          setHand({ kind: 'idle' });
          return;
      }
    },
    [plan.edges, travelToNode, travelToStaging, frameRevealed],
  );

  const cancelEngine = useCallback(() => {
    engineRef.current?.cancel();
    engineRef.current = null;
    arriveResolver.current = null;
    setHand({ kind: 'idle' });
  }, []);

  useEffect(() => {
    const instance = new VisualPlaybackEngine(
      (index) => runStep(plan.steps[index], index),
      () => dispatch({ type: 'complete' }),
    );
    engineRef.current = instance;
    dispatch({ type: 'load', plan });

    if (prefersReducedMotion()) {
      // Reduced motion: apply every step's final state immediately. Teaching
      // never depends on animation, and the hand stays parked.
      plan.steps.forEach((step, index) => dispatch({ type: 'step', step, index }));
      dispatch({ type: 'complete' });
      setHand({ kind: 'idle' });
      // Frame once the committed nodes exist.
      let cancelled = false;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!cancelled) {
            try {
              fitView({ padding: 0.35, duration: 0 });
            } catch {
              /* unmounted — ignore */
            }
          }
        }),
      );
      return () => {
        cancelled = true;
        instance.cancel();
      };
    }

    instance.play(plan.steps.length);
    return () => instance.cancel();
    // runStep intentionally excluded: a new plan identity re-runs this effect,
    // and within a run the engine serialises steps so closures stay fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // Follow-ups animate through the same engine instead of appearing instantly.
  useEffect(() => {
    const fresh = followUpSteps.slice(appliedFollowUps.current);
    if (!fresh.length) return;
    appliedFollowUps.current = followUpSteps.length;
    if (prefersReducedMotion()) {
      let index = scene.activeStep;
      fresh.forEach((step) => dispatch({ type: 'step', step, index: ++index }));
      dispatch({ type: 'complete' });
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          try {
            fitView({ padding: 0.35, duration: 0 });
          } catch {
            /* unmounted — ignore */
          }
        }),
      );
      return;
    }

    const instance = new VisualPlaybackEngine(
      (i) => runStep(fresh[i], scene.activeStep + i + 1),
      () => dispatch({ type: 'complete' }),
    );
    engineRef.current?.cancel();
    engineRef.current = instance;
    instance.play(fresh.length);
    return () => instance.cancel();
    // scene.activeStep intentionally excluded (see runStep note above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUpSteps]);

  useEffect(() => {
    onSceneChange?.(scene);
  }, [onSceneChange, scene]);

  // Cancel everything when leaving the visual view (Back to code / unmount).
  useEffect(() => cancelEngine, [cancelEngine]);

  return (
    <section className="visual-tutor-canvas" aria-label="Live visual teaching canvas" data-visual-canvas tabIndex={-1}>
      <div className="visual-tutor-canvas__topbar">
        <div>
          <p className="visual-tutor-canvas__eyebrow">Tutor-controlled visual mode</p>
          <h2>{plan.title}</h2>
        </div>
        <div className="visual-tutor-canvas__tools">
          <button className="visual-tutor-canvas__close" onClick={onClose}>
            Back to code
          </button>
        </div>
      </div>

      <div ref={containerRef} className="visual-tutor-canvas__flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          edgesFocusable={false}
          fitView
          fitViewOptions={{ padding: 0.35 }}
          minZoom={0.4}
          maxZoom={1.6}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#2a2a31" />
          <Controls position="bottom-right" showInteractive={false} />
        </ReactFlow>

        {/* Teaching hand overlay — visual only, never intercepts input. */}
        <VisualTutorPointer
          hand={hand}
          effect={handEffect}
          onArrive={() => {
            const resolve = arriveResolver.current;
            arriveResolver.current = null;
            setHand((current) =>
              current.kind === 'travel' ? { kind: 'visible', at: current.to } : current,
            );
            resolve?.();
          }}
        />
      </div>

      <div className="visual-tutor-canvas__status">
        <span className={scene.status === 'interactive' ? 'is-ready' : ''} />
        {scene.status === 'interactive' ? 'Diagram ready to explore' : 'Building the explanation live…'}
      </div>
      {teachingCue && scene.status !== 'interactive' && (
        <div className="visual-tutor-canvas__cue" aria-live="polite">
          <span>Now</span>
          {teachingCue.text}
        </div>
      )}
    </section>
  );
}

/** React Flow needs a measured parent; the provider wrapper guarantees that. */
export default function VisualTutorCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <VisualTutorCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
