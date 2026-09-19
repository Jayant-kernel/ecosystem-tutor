import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Database, Globe2, Layers3, ServerCog, Table2, User, Waypoints, MessageSquare } from 'lucide-react';

export interface TeachingNodeData extends Record<string, unknown> {
  label: string;
  detail?: string;
  type: string;
  active: boolean;
  dimmed: boolean;
  pulse: boolean;
  annotation?: string;
}

export interface TeachingNodeType extends Record<'teaching', TeachingNodeData> {
  id: string;
  [key: string]: unknown;
}

const ICONS: Record<string, typeof Globe2> = {
  client: Globe2,
  gateway: Waypoints,
  compute: ServerCog,
  database: Database,
  queue: Layers3,
  storage: Table2,
  service: Layers3,
  user: User,
};

const HUES: Record<string, string> = {
  client: '#38bdf8',
  gateway: '#a78bfa',
  compute: '#f97316',
  database: '#34d399',
  queue: '#facc15',
  storage: '#22d3ee',
  service: '#f472b6',
  user: '#fb923c',
};

function TeachingNodeInner({ id, data }: { id: string; data: TeachingNodeData }) {
  const reduceMotion = useReducedMotion();
  const Icon = ICONS[data.type] ?? Layers3;
  const hue = HUES[data.type] ?? '#94a3b8';

  return (
    <motion.div
      data-visual-node-id={id}
      className={`teaching-node ${data.active ? 'is-active' : ''} ${data.dimmed ? 'is-dimmed' : ''}`}
      animate={
        data.pulse && !reduceMotion
          ? { scale: [1, 1.06, 1], boxShadow: [`0 0 0 0 ${hue}66`, `0 0 0 14px ${hue}00`, `0 0 0 0 ${hue}00`] }
          : { scale: 1 }
      }
      transition={data.pulse && !reduceMotion ? { duration: 1.15, repeat: 2, ease: 'easeInOut' } : { duration: 0.2 }}
    >
      <span className="teaching-node__ring" style={{ borderColor: hue }} />
      <span className="teaching-node__icon" style={{ background: `${hue}1f`, color: hue }}>
        <Icon size={18} />
      </span>
      <span className="teaching-node__copy">
        <strong>{data.label}</strong>
        {data.detail && <small>{data.detail}</small>}
      </span>
      <Handle type="target" position={Position.Left} className="teaching-node__handle" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="teaching-node__handle" isConnectable={false} />
      <AnimatePresence>
        {data.annotation && (
          <motion.span
            className="teaching-node__annotation"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
          >
            <MessageSquare size={10} /> {data.annotation}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Custom React Flow node used by the visual tutor's teaching canvas. */
export const TeachingNode = memo(TeachingNodeInner);

export default TeachingNode;
