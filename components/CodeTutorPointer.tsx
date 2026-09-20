import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import VirtualTeachingHand from './VirtualTeachingHand';

interface Props { editor: any; line: number | null; label?: string; column?: number | null; }

export default function CodeTutorPointer({ editor, line, label, column }: Props) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ left: 10, top: 10, visible: false });
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        const update = () => {
            const root = rootRef.current;
            const node = editor?.getDomNode?.();
            if (!root || !node || !line || line < 1) { setPosition((current) => ({ ...current, visible: false })); return; }
            // Column-aware when the tutor named an exact expression; otherwise
            // the line start. An unresolvable position hides the pointer rather
            // than guessing — a missing pointer beats a wrong one.
            const targetColumn = column && column >= 1 ? Math.floor(column) : 1;
            const visible = editor.getScrolledVisiblePosition?.({ lineNumber: line, column: targetColumn });
            if (!visible) { setPosition((current) => ({ ...current, visible: false })); return; }
            const rootRect = root.getBoundingClientRect();
            const editorRect = node.getBoundingClientRect();
            setPosition({ left: editorRect.left - rootRect.left + Math.max(4, visible.left - 34), top: editorRect.top - rootRect.top + visible.top + visible.height / 2, visible: true });
        };
        update();
        const disposables = [editor?.onDidScrollChange?.(update), editor?.onDidLayoutChange?.(update)].filter(Boolean);
        window.addEventListener('resize', update);
        return () => { disposables.forEach((disposable: any) => disposable.dispose?.()); window.removeEventListener('resize', update); };
    }, [editor, line, column]);

    return (
        <div ref={rootRef} className="code-tutor-pointer-layer" aria-hidden="true">
            <motion.div className="code-tutor-pointer" initial={false} animate={{ left: position.left, top: position.top, opacity: position.visible ? 1 : 0 }} transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 150, damping: 20, mass: .65 }}>
                <VirtualTeachingHand size={38} />
                <span className="code-tutor-pointer__label">{label || `Line ${line}`}</span>
                <span className="code-tutor-pointer__halo" />
            </motion.div>
        </div>
    );
}
