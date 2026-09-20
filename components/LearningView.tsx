
import React, { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { Course, Lesson, Transcript, ConsoleOutput, TestResult, TutorToolCall, TutorToolResponse } from '../types';
import { resolveTeachingTarget, walkLinesForTarget, labelForWalk, createTeachingSteps, MAX_TEACHING_WALK_LINES } from './teachingTargets';
import type { TeachingStep } from './teachingTargets';
import TeachingPanel from './TeachingPanel';
import RoadmapSidebar from './RoadmapSidebar';
import { useCourseProgress } from '../hooks/useCourseProgress';
import { useVoiceTutor } from '../hooks/useVoiceTutor';
import { useLearningActivity } from '../hooks/useLearningActivity';
import LearningHeader from './LearningHeader';
import ConversationPanel from './ConversationPanel';
import CodeWorkspace from './CodeWorkspace';
import LearningFooter from './LearningFooter';
import PracticeView from './PracticeView';
// Lazy: keeps @xyflow/react (the visual tutor canvas) out of the main bundle.
const VisualTutorCanvas = React.lazy(() => import('./visual-tutor/VisualTutorCanvas'));
import VisualOfferCard from './visual-tutor/VisualOfferCard';
import { validateVisualPlan, visualSceneSummary } from './visual-tutor/visualSchema';
import { visualReducer } from './visual-tutor/visualReducer';
import { EMPTY_VISUAL_SCENE } from './visual-tutor/visualTypes';
import type { VisualNode, VisualPlan, VisualSceneState, VisualStep } from './visual-tutor/visualTypes';
import { executeCodeSafely, executeTests } from '../utils/codeExecutor';
import { voiceService } from '../services/voiceService';
import { View } from '../App';

interface LearningViewProps {
    course: Course;
    navigateTo: (view: View) => void;
}

/** A direct request opens Visual Mode; tentative tutor suggestions still ask first. */
const isDirectVisualRequest = (value: string) => /\b(?:show|make|draw|build|create|explain)\b[^.]{0,56}\b(?:visual(?:ly|isation|ization)?|flow\s*chart|flowchart|diagram|architecture|data\s*flow)\b|\b(?:flow\s*chart|flowchart|diagram|visual(?:ly|isation|ization)?)\b|फ्लो\s*चार्ट|फ्लोचार्ट|डायग्राम|विजुअल|चित्र/.test(value.toLowerCase());
/** "This chapter" stays local; a plain flowchart request means the journey so far. */
const isCurrentChapterVisualRequest = (value: string) => /\b(?:this|current|only)\s+(?:chapter|lesson|topic|concept|flowchart|diagram)\b|\b(?:chapter|lesson)\s+(?:only|alone)\b/.test(value.toLowerCase());
const FALLBACK_NODE_TYPES: VisualNode['type'][] = ['client', 'gateway', 'compute', 'database', 'storage', 'service'];
const teachingCue = (label: string, detail?: string) => `${label}: ${detail || 'the next important idea in this lesson.'}`
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 12)
    .join(' ')
    .slice(0, 140);

const learningJourneySteps = (course: Course, currentLesson: Lesson | null) => {
    if (!currentLesson) return [];
    const steps: Array<{ label: string; detail: string }> = [];
    let foundCurrentLesson = false;
    for (let moduleIndex = 0; moduleIndex < course.modules.length && !foundCurrentLesson; moduleIndex += 1) {
        const module = course.modules[moduleIndex];
        for (let lessonIndex = 0; lessonIndex < module.lessons.length; lessonIndex += 1) {
            const lesson = module.lessons[lessonIndex];
            steps.push({
                label: `M${moduleIndex + 1}.${lessonIndex + 1} ${lesson.title}`.slice(0, 60),
                detail: (lesson.objectives?.[0] || `Key idea from ${lesson.title}`).slice(0, 120),
            });
            if (lesson.id === currentLesson.id) {
                foundCurrentLesson = true;
                break;
            }
        }
    }
    if (!foundCurrentLesson) return [];
    if (steps.length <= 16) return steps;
    const moduleSummaries: Array<{ label: string; detail: string }> = [];
    for (let moduleIndex = 0; moduleIndex < course.modules.length; moduleIndex += 1) {
        const module = course.modules[moduleIndex];
        const currentIndex = module.lessons.findIndex((lesson) => lesson.id === currentLesson.id);
        const included = currentIndex >= 0 ? currentIndex + 1 : module.lessons.length;
        moduleSummaries.push({
            label: `Module ${moduleIndex + 1}: ${module.title}`.slice(0, 60),
            detail: `Chapters 1–${included}: ${module.lessons.slice(0, included).map((lesson) => lesson.title).join(', ')}`.slice(0, 120),
        });
        if (currentIndex >= 0) return moduleSummaries;
    }
    return moduleSummaries;
};

/** Guarantees a live teaching canvas even if a model offers visual mode without a plan. */
const buildDirectVisualPlan = (lesson: Lesson | null, topic: string, journeySteps: Array<{ label: string; detail: string }> = []): VisualPlan => {
    const flow = lesson?.content.flows?.find((candidate) => candidate.steps.length >= 2);
    const sourceSteps = journeySteps.length >= 2 ? journeySteps.slice(0, 16) : flow?.steps?.slice(0, 6) || [
        { label: 'Starting point', detail: topic },
        { label: 'Process', detail: 'The important transformation happens here.' },
        { label: 'Result', detail: 'The learner can now see the outcome.' },
    ];
    const nodes: VisualNode[] = sourceSteps.map((step, index) => ({
        id: `step-${index + 1}`,
        label: step.label.slice(0, 60),
        detail: (step.detail || (index === 0 ? topic : 'Next step in the flow.')).slice(0, 120),
        type: FALLBACK_NODE_TYPES[index % FALLBACK_NODE_TYPES.length],
    }));
    const edges = nodes.slice(1).map((node, index) => ({ id: `flow-${index + 1}`, from: nodes[index].id, to: node.id, label: 'then' }));
    const steps: VisualStep[] = [];
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
    return { title: journeySteps.length >= 2 ? `Learning journey to ${topic}`.slice(0, 100) : flow?.title || topic, nodes, edges, steps };
};

/** Workspace 3D shuffle: one editor+console card lifts, hovers and sinks while
 * the React Flow card rises from the back of the deck. */
const CODE_LAYER_VARIANTS: Variants = {
    // Hold briefly for the rim-light, lift toward the learner, then let the
    // card deliberately recede behind the visual canvas.
    visible: { opacity: [0, 1, 1, 1], y: [24, 16, -18, 0], scale: [0.94, 0.975, 1.016, 1], rotateX: [-8, -4, 5, 0], rotateZ: [-0.8, -0.35, 0.24, 0], pointerEvents: 'auto' },
    hidden: { opacity: [1, 1, 1, 0.02], y: [0, 0, -42, 28], scale: [1, 1, 1.035, 0.91], rotateX: [0, 0, 12, -10], rotateZ: [0, 0, -0.65, 0.65], pointerEvents: 'none' },
};
const VISUAL_LAYER_VARIANTS: Variants = {
    initial: { opacity: 0.12, y: 34, scale: 0.925, rotateX: 10, rotateZ: 0.55 },
    animate: { opacity: [0.12, 0.22, 0.84, 1], y: [34, 28, -10, 0], scale: [0.925, 0.925, 1.02, 1], rotateX: [10, 9, -4, 0], rotateZ: [0.55, 0.45, -0.2, 0] },
    exit: { opacity: [1, 1, 0.82, 0], y: [0, -10, 26, 34], scale: [1, 1.02, 0.94, 0.925], rotateX: [0, 5, -8, -10], rotateZ: [0, 0.22, -0.42, -0.55] },
};

const LearningView: React.FC<LearningViewProps> = ({ course, navigateTo }) => {    const { progress, updateProgress, completeLesson } = useCourseProgress(course.id);
    const { startTracking, stopTracking } = useLearningActivity();
    const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
    const [isCompleting, setIsCompleting] = useState(false);
    const [practiceModuleId, setPracticeModuleId] = useState<string | null>(null);

    // Start tracking time when component mounts, stop when unmounts
    useEffect(() => {
        startTracking();
        return () => {
            stopTracking();
        };
    }, [startTracking, stopTracking]);

    // Initialize sidebar closed on mobile, open on desktop
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);

    const [editorCode, setEditorCode] = useState('// Your AI tutor will write code here...');
    const [consoleOutput, setConsoleOutput] = useState<ConsoleOutput[]>([]);
    const [transcript, setTranscript] = useState<Transcript>({ user: '', ai: '', isFinal: false });
    const latestLearnerRequestRef = useRef('');

    // Refs to access latest state in async tool callbacks
    const editorCodeRef = useRef(editorCode);
    useEffect(() => { editorCodeRef.current = editorCode; }, [editorCode]);

    // Monaco editor instance (captured on mount) for tutor line highlights.
    const editorApiRef = useRef<{ editor: any; monaco: any } | null>(null);
    const highlightDecoRef = useRef<string[]>([]);
    const pendingHighlightRef = useRef<{ startLine: number; endLine: number } | null>(null);
    const isTypingRef = useRef(false);
    const [highlight, setHighlight] = useState<{ startLine: number; endLine: number; revision: number } | null>(null);
    // Bumped when the tutor runs code so the console tab takes over.
    const [consoleTabSignal, setConsoleTabSignal] = useState(0);
    const [visualPlan, setVisualPlan] = useState<VisualPlan | null>(null);
    const [pendingVisualPlan, setPendingVisualPlan] = useState<VisualPlan | null>(null);
    const [visualOffer, setVisualOffer] = useState<{ topic: string; reason?: string } | null>(null);
    const [workspaceMode, setWorkspaceMode] = useState<'code' | 'visual'>('code');
    const [visualScene, setVisualScene] = useState<VisualSceneState>(EMPTY_VISUAL_SCENE);
    const [followUpVisualSteps, setFollowUpVisualSteps] = useState<VisualStep[]>([]);
    const visualSummaryRef = useRef('No visual scene is open.');
    useEffect(() => { visualSummaryRef.current = visualSceneSummary(visualPlan, visualScene.status, visualScene.activeNodeId); }, [visualPlan, visualScene.activeNodeId, visualScene.status]);

    const clearHighlight = useCallback(() => {
        pendingHighlightRef.current = null;
        setHighlight(null);
        const api = editorApiRef.current;
        if (api && highlightDecoRef.current.length) {
            try {
                highlightDecoRef.current = api.editor.deltaDecorations(highlightDecoRef.current, []);
            } catch {
                /* editor torn down — ignore */
            }
        }
    }, []);

    const applyHighlight = useCallback((startLine: number, endLine: number) => {
        let s = Math.max(1, Math.floor(Number(startLine)) || 1);
        let e = Math.max(1, Math.floor(Number(endLine)) || 1);
        if (s > e) { const t = s; s = e; e = t; }
        pendingHighlightRef.current = { startLine: s, endLine: e };
        setHighlight((prev) => ({ startLine: s, endLine: e, revision: (prev?.revision ?? 0) + 1 }));
        const api = editorApiRef.current;
        if (!api) return;
        try {
            const { editor, monaco } = api;
            const model = editor.getModel();
            const lineCount = model ? model.getLineCount() : e;
            const cs = Math.min(s, Math.max(1, lineCount));
            const ce = Math.min(e, Math.max(1, lineCount));
            highlightDecoRef.current = editor.deltaDecorations(highlightDecoRef.current, [{
                range: new monaco.Range(cs, 1, ce, model ? model.getLineMaxColumn(ce) : 1),
                options: {
                    isWholeLine: true,
                    className: 'tutor-highlight-line',
                    overviewRuler: { color: 'rgba(249,115,22,0.9)', position: monaco.editor.OverviewRulerLane.Right },
                },
            }]);
            editor.revealLinesInCenter(cs, ce);
        } catch {
            /* editor not ready — pending highlight re-applies when typing finishes */
        }
    }, []);

    const handleMountEditor = useCallback((editor: any, monaco: any) => {
        editorApiRef.current = { editor, monaco };
        // Re-apply any active highlight (e.g. after a remount).
        const pending = pendingHighlightRef.current;
        if (pending) applyHighlight(pending.startLine, pending.endLine);
    }, [applyHighlight]);

    // Handle window resize to auto-manage sidebar state
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setIsSidebarOpen(true);
            } else {
                setIsSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const typeCode = (code: string, onDone?: () => void) => {
        isTypingRef.current = true;
        setTimeout(() => {
            let i = 0;
            const interval = setInterval(() => {
                if (i < code.length) {
                    setEditorCode(prev => code.substring(0, i + 1));
                    i++;
                } else {
                    clearInterval(interval);
                    isTypingRef.current = false;
                    // Re-apply any highlight the tutor requested while typing.
                    const pending = pendingHighlightRef.current;
                    if (pending) applyHighlight(pending.startLine, pending.endLine);
                    onDone?.();
                }
            }, 15);
        }, 50);
    };

    const handleRunCode = useCallback(async () => {
        setConsoleOutput([]);
        const code = editorCodeRef.current;

        // Prefer the AWS Lambda sandbox; fall back to in-browser execution when
        // no backend is configured (e.g. local dev without VITE_API_BASE_URL).
        if (voiceService.isConfigured()) {
            try {
                const { output } = await voiceService.executeCode(code);
                setConsoleOutput(output || []);
                return;
            } catch (error) {
                console.warn('Remote execution failed, falling back to local:', error);
            }
        }

        executeCodeSafely(code, (output) => {
            setConsoleOutput(prev => [...prev, output]);
        });
    }, []);

    const handleResetCode = useCallback(() => {
        setEditorCode('// Code has been reset.');
        setConsoleOutput([]);
    }, []);

    // --- Tutor line highlighting (array-based, staggered) ------------------------------
    // Kept alongside the range-based Monaco decoration highlight below so the
    // `highlightCode` tool keeps working while `highlightLines` drives the editor.
    const [highlightedLines, setHighlightedLines] = useState<number[]>([]);
    const [tutorFocusLine, setTutorFocusLine] = useState<number | null>(null);
    const [tutorFocusColumn, setTutorFocusColumn] = useState<number | null>(null);
    const [tutorFocusLabel, setTutorFocusLabel] = useState<string | null>(null);
    const [teachingRanges, setTeachingRanges] = useState<import('./teachingTargets').TeachingRange[]>([]);
    const highlightTimersRef = useRef<number[]>([]);

    const clearHighlightTimers = useCallback(() => {
        highlightTimersRef.current.forEach((id) => window.clearTimeout(id));
        highlightTimersRef.current = [];
        setTutorFocusLine(null);
        setTutorFocusColumn(null);
        setTutorFocusLabel(null);
    }, []);

    /** Move the teaching hand through each requested line while the active line glows. */
    const applyHighlightLines = useCallback((lines: number[], delayMs: number, opts?: { column?: number | null; label?: string | null }) => {
        const ordered = [...new Set(lines.map((line) => Math.floor(Number(line))).filter((line) => line > 0))].slice(0, 24);
        if (!ordered.length) return;
        const show = window.setTimeout(() => {
            ordered.forEach((line, index) => {
                const step = window.setTimeout(() => {
                    setHighlightedLines([line]);
                    setTutorFocusLine(line);
                    setTutorFocusColumn(opts?.column ?? null);
                    setTutorFocusLabel(opts?.label ?? null);
                }, index * 1750);
                highlightTimersRef.current.push(step);
            });
            const clear = window.setTimeout(() => {
                setHighlightedLines([]);
                setTutorFocusLine(null);
                setTutorFocusColumn(null);
                setTutorFocusLabel(null);
                setTeachingRanges([]);
            }, ordered.length * 1750 + 900);
            highlightTimersRef.current.push(clear);
        }, delayMs);
        highlightTimersRef.current.push(show);
    }, []);

    // --- Interactive teaching sessions (Phase 3) --------------------------------
    // Built on the Phase 2 semantic targets: a turn's highlightLines calls
    // become navigable steps, and the current step is the single source of
    // truth for pointer + highlight. Local state only — a session lives and
    // dies with the interaction, never persisted.
    const [teachingSession, setTeachingSession] = useState<{ steps: TeachingStep[]; current: number } | null>(null);

    /** Display exactly one step: previous teaching visuals are replaced, never stacked. */
    const showTeachingStep = useCallback((steps: TeachingStep[], index: number) => {
        const step = steps[index];
        if (!step) return;
        clearHighlightTimers();
        const lines: number[] = [];
        for (let line = step.startLine; line <= step.endLine && lines.length < MAX_TEACHING_WALK_LINES; line++) {
            lines.push(line);
        }
        setHighlightedLines(lines);
        setTutorFocusLine(lines[0] ?? null);
        setTutorFocusColumn(step.column);
        setTutorFocusLabel(step.label);
        setTeachingRanges(step.range ? [step.range] : []);
        setTeachingSession({ steps, current: index });
    }, [clearHighlightTimers]);

    /** Leave teaching mode: visuals and state go away, code is untouched. */
    const closeTeachingSession = useCallback(() => {
        clearHighlightTimers();
        setHighlightedLines([]);
        setTeachingRanges([]);
        setTeachingSession(null);
    }, [clearHighlightTimers]);

    const goTeachingStep = useCallback((delta: number) => {
        if (!teachingSession) return;
        const next = Math.min(teachingSession.steps.length - 1, Math.max(0, teachingSession.current + delta));
        if (next === teachingSession.current) return;
        showTeachingStep(teachingSession.steps, next);
    }, [teachingSession, showTeachingStep]);

    /** Re-present the current step (pointer + highlight + label + reveal). No audio replay. */
    const replayTeachingStep = useCallback(() => {
        if (!teachingSession) return;
        showTeachingStep(teachingSession.steps, teachingSession.current);
    }, [teachingSession, showTeachingStep]);

    /** Editor-model surface for validating teaching targets, with a code-string fallback. */
    const getTeachingCodeInfo = useCallback(() => {
        const codeText: string = editorCodeRef.current || '';
        const codeLines = codeText.split('\n');
        let liveModel: any = null;
        try { liveModel = editorApiRef.current?.editor?.getModel?.() || null; } catch { liveModel = null; }
        return {
            lineCount: (() => { try { return liveModel?.getLineCount?.() ?? codeLines.length; } catch { return codeLines.length; } })(),
            lineLength: (line: number) => {
                try { if (liveModel?.getLineLength) return liveModel.getLineLength(line); } catch { /* fall through */ }
                return codeLines[line - 1]?.length ?? 0;
            },
        };
    }, []);

    // A new lesson starts with a clean editor.
    useEffect(() => {
        clearHighlightTimers();
        closeTeachingSession();
        setHighlightedLines([]);
        setTeachingRanges([]);
        return clearHighlightTimers;
    }, [currentLesson?.id, clearHighlightTimers, closeTeachingSession]);

    const handleRunTests = useCallback((): TestResult[] => {
        if (!currentLesson || !currentLesson.content.exercises || currentLesson.content.exercises.length === 0) {
            return [];
        }
        return executeTests(editorCode, currentLesson.content.exercises[0].tests);
    }, [editorCode, currentLesson]);

    // Memoize the flattened list of lessons for easier navigation lookup
    const allLessons = useMemo(() => course.modules.flatMap(m => m.lessons), [course]);

    // Stable references so memoized children (Monaco editor, sidebar) do not
    // re-render when the transcript streams in.
    const exercises = useMemo(() => currentLesson?.content.exercises ?? [], [currentLesson]);
    const handleCodeChange = useCallback((val?: string) => {
        setEditorCode(val || '');
        // Manual edits invalidate any tutor highlight (programmatic typing is
        // guarded by isTypingRef) — and any teaching session built on the old
        // lines, whose targets would now resolve stale.
        if (!isTypingRef.current) {
            clearHighlight();
            closeTeachingSession();
        }
    }, [clearHighlight, closeTeachingSession]);
    const handleBackToCourses = useCallback(() => navigateTo('courses'), [navigateTo]);

    const [showXPModal, setShowXPModal] = useState(false);
    const [xpGained, setXpGained] = useState(0);

    const handleCompleteLesson = useCallback(async () => {
        if (!currentLesson || isCompleting) return;

        setIsCompleting(true);
        try {
            const currentIndex = allLessons.findIndex(l => l.id === currentLesson.id);
            let nextLessonId = currentLesson.id;

            if (currentIndex !== -1 && currentIndex < allLessons.length - 1) {
                nextLessonId = allLessons[currentIndex + 1].id;
            }

            await completeLesson(currentLesson.id, nextLessonId);
            setXpGained(50); // Example XP value for lesson completion
            setShowXPModal(true);

            // Delay navigation/updates until modal is closed or after short delay if automatic
            // For now, we'll keep the modal open until user dimisses it or continues

            if (nextLessonId === currentLesson.id && currentIndex === allLessons.length - 1) {
                // Course Completion logic handled in modal or subsequent check
            }
        } catch (error) {
            console.error("Failed to complete lesson:", error);
        } finally {
            setIsCompleting(false);
        }
    }, [currentLesson, isCompleting, allLessons, completeLesson]);

    const closeXPModal = () => {
        setShowXPModal(false);
        const currentIndex = allLessons.findIndex(l => l?.id === currentLesson?.id);
        if (currentIndex !== -1 && currentIndex === allLessons.length - 1) {
            navigateTo('courses');
        }
    };

    const handleToolCall = useCallback(async (functionCalls: TutorToolCall[]): Promise<TutorToolResponse[]> => {
        const responses: TutorToolResponse[] = [];
        let highlightStep = 0;
        // Stagger sequential teaching targets within one turn so the hand
        // finishes each region before moving to the next (1750ms per walked
        // line plus a beat to let the explanation land).
        let teachingDelayMs = 0;
        // writeCode first: fresh code invalidates any old highlight. Only wait
        // for typing to finish when later calls in the same batch need the
        // final code (e.g. executeCode); otherwise keep audio latency low.
        const writeCall = functionCalls.find((fc) => fc.name === 'writeCode');
        const offerCall = functionCalls.find((fc) => fc.name === 'offerVisualExplanation');
        // Tool calls arrive just after the transcript, so this uses the learner's
        // actual words rather than trusting the model to label its own intent.
        const openVisualImmediately = isDirectVisualRequest(latestLearnerRequestRef.current);
        const wantsLearningJourney = openVisualImmediately && !isCurrentChapterVisualRequest(latestLearnerRequestRef.current);
        const needsSettledCode = functionCalls.some((fc) =>
            fc.name === 'executeCode' ||
            (fc.name === 'controlApp' && (fc.args?.action as string) === 'run_code')
        );
        if (writeCall) {
            const code = (writeCall.args?.code as string) || '';
            clearHighlight();
            closeTeachingSession();
            clearHighlightTimers();
            setHighlightedLines([]);
            setTeachingRanges([]);
            pendingHighlightRef.current = null;
            setEditorCode('');
            if (needsSettledCode) {
                await new Promise<void>((resolve) => typeCode(code, resolve));
            } else {
                typeCode(code);
            }
            responses.push({ id: writeCall.id, name: writeCall.name, response: { result: "Code written successfully." } });
        }
        // A turn's highlightLines calls become an interactive teaching session —
        // unless the turn also writes code, in which case the legacy staggered
        // chunk walk below keeps normal demo mode normal. Invalid targets
        // resolve to plain explanations (responses below), never to a pointer.
        const claimedTeachingCalls = new Set<TutorToolCall>();
        if (!writeCall) {
            const candidates = functionCalls.filter((fc) => fc.name === 'highlightLines');
            if (candidates.length) {
                const codeInfo = getTeachingCodeInfo();
                const resolvedList = candidates.map((fc) => ({ fc, target: resolveTeachingTarget(fc.args, codeInfo) }));
                for (const { fc } of resolvedList.filter((r) => r.target.kind === 'invalid')) {
                    claimedTeachingCalls.add(fc);
                    responses.push({ id: fc.id, name: fc.name, response: { result: 'Target outside the editor; explaining without a highlight.' } });
                }
                const steps = createTeachingSteps(resolvedList.map((r) => r.target));
                if (steps.length) {
                    clearHighlight();
                    showTeachingStep(steps, 0);
                    let claimed = 0;
                    for (const { fc, target } of resolvedList) {
                        if (target.kind === 'invalid') continue;
                        const step = steps[claimed];
                        claimed += 1;
                        claimedTeachingCalls.add(fc);
                        responses.push({
                            id: fc.id,
                            name: fc.name,
                            response: {
                                result: step.range
                                    ? `Line ${step.startLine} highlighted (columns ${step.range.startColumn}-${step.range.endColumn}).`
                                    : `Lines ${step.startLine}-${step.endLine} highlighted.`,
                            },
                        });
                    }
                }
            }
        }
        for (const fc of functionCalls) {
            if (fc.name === 'writeCode' || claimedTeachingCalls.has(fc)) continue;
            switch (fc.name) {
                case 'highlightCode': {
                    const raw = fc.args?.lines;
                    const lines = Array.isArray(raw)
                        ? (raw as unknown[]).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
                        : [];
                    if (lines.length) {
                        // Let the editor finish typing before pointing at a line.
                        applyHighlightLines(lines, 1200 + highlightStep * 1500);
                        highlightStep += 1;
                    }
                    responses.push({ id: fc.id, name: fc.name, response: { result: "Lines highlighted." } });
                    break;
                }
                case 'highlightLines': {
                    // Legacy demo walk (turns that also write code): same
                    // validation as teaching targets, staggered as before.
                    const resolved = resolveTeachingTarget(fc.args, getTeachingCodeInfo());
                    if (resolved.kind === 'invalid') {
                        responses.push({ id: fc.id, name: fc.name, response: { result: 'Target outside the editor; explaining without a highlight.' } });
                        break;
                    }
                    const walk = walkLinesForTarget(resolved);
                    const label = labelForWalk(walk, resolved.label);
                    const column = resolved.kind === 'range' ? resolved.range.startColumn : null;
                    clearHighlight();
                    setTeachingRanges(resolved.kind === 'range' ? [resolved.range] : []);
                    applyHighlightLines(walk, teachingDelayMs, { column, label });
                    teachingDelayMs += walk.length * 1750 + 1000;
                    responses.push({
                        id: fc.id,
                        name: fc.name,
                        response: {
                            result: resolved.kind === 'range'
                                ? `Line ${resolved.range.startLine} highlighted (columns ${resolved.range.startColumn}-${resolved.range.endColumn}).`
                                : `Lines ${walk[0]}-${walk[walk.length - 1]} highlighted.`,
                        },
                    });
                    break;
                }
                case 'executeCode':
                    await handleRunCode();
                    setConsoleTabSignal((n) => n + 1);
                    responses.push({ id: fc.id, name: fc.name, response: { result: "Code executed." } });
                    break;
                case 'readCode':
                    responses.push({ id: fc.id, name: fc.name, response: { result: editorCodeRef.current } });
                    break;
                case 'controlApp':
                    const action = fc.args?.action as string;
                    let resultMsg = `Action ${action} triggered.`;
                    if (action === 'run_code') {
                        await handleRunCode();
                        setConsoleTabSignal((n) => n + 1);
                    } else if (action === 'reset_code') {
                        handleResetCode();
                    } else if (action === 'next_lesson') {
                        handleCompleteLesson();
                        resultMsg = "Moving to next lesson.";
                    }
                    responses.push({ id: fc.id, name: fc.name, response: { result: resultMsg } });
                    break;
                case 'offerVisualExplanation': {
                    const topic = typeof fc.args?.topic === 'string' ? fc.args.topic.trim().slice(0, 100) : 'this concept';
                    const reason = typeof fc.args?.reason === 'string' ? fc.args.reason.trim().slice(0, 160) : undefined;
                    if (openVisualImmediately) {
                        const fallbackPlan = buildDirectVisualPlan(currentLesson, topic || 'this concept', wantsLearningJourney ? learningJourneySteps(course, currentLesson) : []);
                        setPendingVisualPlan(fallbackPlan);
                        setVisualPlan(fallbackPlan);
                        setVisualOffer(null);
                        setFollowUpVisualSteps([]);
                        setWorkspaceMode('visual');
                    } else setVisualOffer({ topic: topic || 'this concept', reason });
                    responses.push({ id: fc.id, name: fc.name, response: { result: openVisualImmediately ? 'Direct visual request detected; opening live canvas.' : 'Visual explanation offer shown.' } });
                    break;
                }
                case 'presentVisualExplanation': {
                    const checked = validateVisualPlan(fc.args);
                    if (!checked.success) {
                        responses.push({ id: fc.id, name: fc.name, response: { error: checked.error } });
                        break;
                    }
                    // A plain direct request is deliberately deterministic: it
                    // maps every chapter the learner has reached, even if an
                    // older hosted backend returns a current-lesson-only plan.
                    const plan = wantsLearningJourney
                        ? buildDirectVisualPlan(currentLesson, currentLesson?.title || checked.data.title, learningJourneySteps(course, currentLesson))
                        : checked.data;
                    setPendingVisualPlan(plan);
                    // Direct requests never wait behind the offer card. That lets phrases
                    // like "make a flow chart" transition the editor straight into the
                    // live canvas while tentative suggestions still preserve learner choice.
                    if (!offerCall || openVisualImmediately) {
                        setVisualPlan(plan);
                        setVisualOffer(null);
                        setFollowUpVisualSteps([]);
                        setWorkspaceMode('visual');
                    }
                    responses.push({ id: fc.id, name: fc.name, response: { result: 'Validated visual plan is ready.' } });
                    break;
                }
                case 'updateVisualExplanation': {
                    if (!visualPlan) { responses.push({ id: fc.id, name: fc.name, response: { error: 'No visual scene is open.' } }); break; }
                    const candidate = validateVisualPlan({ ...visualPlan, steps: fc.args?.actions });
                    if (!candidate.success) { responses.push({ id: fc.id, name: fc.name, response: { error: candidate.error } }); break; }
                    candidate.data.steps.forEach((step, index) => setVisualScene((current) => visualReducer(current, { type: 'step', step, index: current.activeStep + index + 1 })));
                    setFollowUpVisualSteps((steps) => [...steps, ...candidate.data.steps]);
                    responses.push({ id: fc.id, name: fc.name, response: { result: 'Visual scene updated.' } });
                    break;
                }
            }
        }
        return responses;
    }, [applyHighlight, applyHighlightLines, clearHighlight, clearHighlightTimers, closeTeachingSession, course, getTeachingCodeInfo, showTeachingStep, currentLesson, handleRunCode, handleResetCode, handleCompleteLesson, visualPlan, visualScene.activeStep]);

    const onStreamMessage = useCallback((newTranscript: Transcript) => {
        latestLearnerRequestRef.current = newTranscript.user || '';
        setTranscript(newTranscript);
    }, []);

    useEffect(() => {
        const firstLesson = allLessons[0];
        if (!firstLesson) {
            setCurrentLesson(null);
            return;
        }

        const lesson = allLessons.find(l => l.id === progress.currentLessonId);
        if (lesson) {
            setCurrentLesson(lesson);
            return;
        }

        // The stored lesson id does not belong to this course (e.g. the learner
        // switched courses). Self-heal by opening this course's first lesson.
        setCurrentLesson(firstLesson);
        if (progress.currentLessonId !== firstLesson.id) {
            updateProgress({ currentLessonId: firstLesson.id });
        }
    }, [progress.currentLessonId, allLessons, updateProgress]);

    const {
        isSessionActive,
        isConnecting,
        isSpeaking,
        isListening,
        isMuted,
        handsFree,
        toggleHandsFree,
        startSession,
        stopSession,
        requestStop,
        isStopPending,
        toggleMute,
        sessionError,
        ensureSessionId,
        pushHistory,
        resetConversation,
        playExternalAudio
    } = useVoiceTutor(onStreamMessage, handleToolCall, progress, currentLesson, editorCodeRef, course.title, visualSummaryRef, course);

    // Parent module of the open chapter (for the tutor's greeting).
    const currentModule = useMemo(() => {
        if (!currentLesson) return null;
        return course.modules.find((m) => m.lessons.some((l) => l.id === currentLesson.id)) ?? null;
    }, [course.modules, currentLesson]);

    // Chapter intro state, keyed by lesson.
    const [introState, setIntroState] = useState<{ lessonId: string; loading: boolean } | null>(null);

    // A new chapter means a fresh conversation so the tutor greets THIS chapter.
    const currentLessonId = currentLesson?.id;
    useEffect(() => {
        setTranscript({ user: '', ai: '', isFinal: false });
        resetConversation();
        setIntroState(null);
        setVisualOffer(null);
        setPendingVisualPlan(null);
        setVisualPlan(null);
        setWorkspaceMode('code');
        setVisualScene(EMPTY_VISUAL_SCENE);
        setFollowUpVisualSteps([]);
    }, [currentLessonId, resetConversation]);

    const handleRequestIntro = useCallback(async () => {
        if (!currentLesson || introState?.loading) return;
        if (!voiceService.isConfigured()) {
            setTranscript({
                user: '',
                ai: 'Voice backend is not configured. Set VITE_API_BASE_URL to enable the tutor voice.',
                isFinal: true,
            });
            return;
        }
        setIntroState({ lessonId: currentLesson.id, loading: true });
        try {
            const sessionId = await ensureSessionId();
            const result = await voiceService.requestIntro({
                sessionId,
                lessonTitle: currentLesson.title,
                moduleTitle: currentModule?.title,
                objectives: currentLesson.objectives?.join('; '),
                openingQuestion: currentLesson.content.oralQuestions?.[0]?.prompt,
                lessonSummary: currentLesson.content.explanations?.[0],
                aiMemory: progress.aiMemory?.slice(-3).join('; '),
                editorCode: editorCodeRef.current,
            });
            if (result.toolCalls?.length) {
                await handleToolCall(result.toolCalls.map((call, index) => ({
                    id: `intro-tool-${index}`,
                    name: call.name,
                    args: call.args || {},
                })));
            }
            setTranscript({ user: '', ai: result.response, isFinal: true });
            pushHistory(`[Opened chapter ${currentLesson.title}]`, result.response);
            await playExternalAudio(result.audio, result.audioMimeType);
            setIntroState({ lessonId: currentLesson.id, loading: false });
        } catch (error: any) {
            setIntroState({ lessonId: currentLesson.id, loading: false });
            setTranscript({
                user: '',
                ai: `Sorry, I could not introduce this chapter: ${error?.message || error}`,
                isFinal: true,
            });
        }
    }, [currentLesson, currentModule, editorCodeRef, ensureSessionId, handleToolCall, introState?.loading, playExternalAudio, progress.aiMemory, pushHistory]);

    const handleLessonClick = useCallback(async (lessonId: string) => {
        await updateProgress({ currentLessonId: lessonId });
        setPracticeModuleId(null);
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    }, [updateProgress]);

    const handlePracticeClick = useCallback((moduleId: string) => {
        setPracticeModuleId(moduleId);
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    }, []);

    // End-of-module practice replaces the lesson workspace while it is open.
    const practiceModule = useMemo(
        () => course.modules.find((m) => m.id === practiceModuleId && m.practice),
        [course, practiceModuleId]
    );

    // Concept lessons have no editor and no console.
    const isTheory = currentLesson?.mode === 'theory';
    const showVisual = Boolean(visualPlan && workspaceMode === 'visual');
    const acceptVisualOffer = () => {
        if (!pendingVisualPlan) return;
        setVisualPlan(pendingVisualPlan);
        setVisualOffer(null);
        setFollowUpVisualSteps([]);
        setWorkspaceMode('visual');
    };

    // --- Visual/code workspace transition ----------------------------------
    // The hidden code workspace stays mounted (Monaco content, console output
    // and tabs preserved) but is removed from tab order and assistive tech.
    // `inert` is set as a DOM property so this works on React 18 as well.
    const reduceMotion = useReducedMotion();
    const rightPaneRef = useRef<HTMLDivElement | null>(null);
    const codeLayerRef = useRef<HTMLDivElement | null>(null);
    const transition = { duration: reduceMotion ? 0 : 3.5, times: [0, 0.2, 0.66, 1], ease: 'easeInOut' as const };
    useEffect(() => {
        const el = codeLayerRef.current as (HTMLDivElement & { inert?: boolean }) | null;
        if (el) el.inert = showVisual;
    }, [showVisual]);

    // Move focus across the transition: into the canvas on open, back to the
    // workspace switch on close. Runs only on actual transitions (never on
    // mount, so ordinary page loads keep their natural focus). The canvas
    // chunk loads lazily, so retry until the target exists (or give up
    // quietly). Focus moves at most once so later user navigation is never
    // yanked back.
    const prevShowVisualRef = useRef<boolean | null>(null);
    useEffect(() => {
        const pane = rightPaneRef.current;
        const transitioned = prevShowVisualRef.current !== null && prevShowVisualRef.current !== showVisual;
        prevShowVisualRef.current = showVisual;
        if (!pane || !transitioned) return;
        const query = () => showVisual
            ? pane.querySelector<HTMLElement>('.visual-tutor-canvas__close') ??
              pane.querySelector<HTMLElement>('[data-visual-canvas]')
            : pane.querySelector<HTMLElement>('.visual-workspace-switch [role="tab"]');
        let done = false;
        const tryFocus = () => {
            if (done) return true;
            const target = query();
            if (!target) return false;
            target.focus({ preventScroll: true });
            done = true;
            return true;
        };
        if (tryFocus()) return;
        let attempts = 0;
        const timer = window.setInterval(() => {
            attempts += 1;
            if (tryFocus() || attempts >= 12) window.clearInterval(timer);
        }, reduceMotion ? 100 : 250);
        return () => window.clearInterval(timer);
    }, [showVisual, reduceMotion]);

    if (practiceModule?.practice) {
        return (
            <PracticeView
                practice={practiceModule.practice}
                moduleTitle={practiceModule.title}
                onBack={() => setPracticeModuleId(null)}
            />
        );
    }

    return (
        <div className="fixed inset-0 bg-[#0D0D0D] text-gray-200 font-sans flex overflow-hidden selection:bg-orange-500/30 selection:text-orange-200">
            {/* Background Ambience */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-600/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>

            {/* Mobile Sidebar Backdrop */}
            {isSidebarOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/80 z-30 backdrop-blur-sm transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <RoadmapSidebar
                course={course}
                completedLessons={progress.completedLessons}
                currentLessonId={progress.currentLessonId}
                onBack={handleBackToCourses}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                onLessonClick={handleLessonClick}
                onPracticeClick={handlePracticeClick}
                practiceModuleId={practiceModuleId}
            />

            <main className={`flex flex-col flex-grow relative h-full transition-all duration-300 ${isSidebarOpen ? 'md:ml-80' : ''} w-full`}>
                <LearningHeader
                    lessonTitle={currentLesson?.title || 'Loading...'}
                    courseTitle={course.title}
                    toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    isSidebarOpen={isSidebarOpen}
                    navigateTo={navigateTo}
                />

                <div className={`flex-grow flex flex-col gap-6 p-4 md:p-6 overflow-hidden min-h-0 relative z-10 ${(!isTheory || showVisual) ? 'md:grid md:grid-cols-5' : ''}`}>
                    <div className={`${isTheory ? (showVisual ? 'h-[38%] md:h-full md:col-span-2' : 'flex-1') : 'h-[38%] md:h-full md:col-span-2'} min-h-0 flex-shrink-0 animate-fade-in-up flex flex-col`}>
                        <div className="flex-1 min-h-0">
                            <ConversationPanel
                                isSessionActive={isSessionActive}
                                isConnecting={isConnecting}
                                isListening={isListening}
                                isSpeaking={isSpeaking}
                                isMuted={isMuted}
                                handsFree={handsFree}
                                toggleHandsFree={toggleHandsFree}
                                startSession={startSession}
                                stopSession={stopSession}
                                requestStop={requestStop}
                                isStopPending={isStopPending}
                                toggleMute={toggleMute}
                                transcript={transcript}
                                sessionError={sessionError}
                                currentLesson={currentLesson}
                                onRequestIntro={currentLesson ? handleRequestIntro : null}
                                introLoading={introState?.loading ?? false}
                            />
                        </div>
                    </div>
                    {(!isTheory || showVisual) && (
                        <div ref={rightPaneRef} className="workspace-card-deck flex-1 md:h-full min-h-0 animate-fade-in-up delay-100 md:col-span-3 relative">
                            {!isTheory && <>
                                {visualPlan && <div className="visual-workspace-switch" role="tablist"><button role="tab" aria-selected={workspaceMode === 'code'} onClick={() => setWorkspaceMode('code')}>Code</button><button role="tab" aria-selected={workspaceMode === 'visual'} onClick={() => setWorkspaceMode('visual')}>Visual</button></div>}
                                {/* Always mounted: Monaco content, console output and tabs survive visual mode. */}
                                <motion.div
                                    ref={codeLayerRef}
                                    data-code-layer
                                    className="absolute inset-0"
                                    style={{ transformPerspective: 1400, transformStyle: 'preserve-3d', transformOrigin: '50% 44%', zIndex: 2 }}
                                    initial={false}
                                    animate={showVisual ? 'hidden' : 'visible'}
                                    variants={CODE_LAYER_VARIANTS}
                                    transition={transition}
                                    aria-hidden={showVisual || undefined}
                                >
                                    <div className={`workspace-card workspace-card--code${showVisual ? ' is-shuffling-out' : ''}`}>
                                        <CodeWorkspace code={editorCode} onCodeChange={handleCodeChange} output={consoleOutput} exercises={exercises} onRunTests={handleRunTests} onRunCode={handleRunCode} onResetCode={handleResetCode} highlightLines={highlightedLines} highlightRanges={teachingRanges} onMountEditor={handleMountEditor} consoleTabSignal={consoleTabSignal} tutorFocusLine={tutorFocusLine} tutorFocusColumn={tutorFocusColumn} tutorFocusLabel={tutorFocusLabel ?? (tutorFocusLine ? `Explaining line ${tutorFocusLine}` : undefined)} />
                                    </div>
                                </motion.div>
                            </>}
                            <AnimatePresence>
                                {showVisual && visualPlan && (
                                    <motion.div
                                        key="visual-canvas"
                                        data-visual-layer
                                        className="absolute inset-0"
                                        style={{ transformPerspective: 1400, transformStyle: 'preserve-3d', transformOrigin: '50% 44%', zIndex: 1 }}
                                        variants={VISUAL_LAYER_VARIANTS}
                                        initial="initial"
                                        animate="animate"
                                        exit="exit"
                                        transition={transition}
                                    >
                                        <div className="workspace-card workspace-card--visual">
                                            <Suspense fallback={null}><VisualTutorCanvas plan={visualPlan} followUpSteps={followUpVisualSteps} onClose={() => setWorkspaceMode('code')} onSceneChange={setVisualScene} /></Suspense>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            {visualOffer && <div className="absolute inset-x-3 bottom-3 z-30"><VisualOfferCard topic={visualOffer.topic} reason={visualOffer.reason} onAccept={acceptVisualOffer} onDismiss={() => setVisualOffer(null)} /></div>}
                            {teachingSession && !showVisual && (
                                <div className="absolute bottom-3 right-3 z-30">
                                    <TeachingPanel
                                        step={teachingSession.current}
                                        total={teachingSession.steps.length}
                                        label={teachingSession.steps[teachingSession.current]?.label ?? ''}
                                        onPrev={() => goTeachingStep(-1)}
                                        onNext={() => {
                                            if (teachingSession.current >= teachingSession.steps.length - 1) closeTeachingSession();
                                            else goTeachingStep(1);
                                        }}
                                        onReplay={replayTeachingStep}
                                        onClose={closeTeachingSession}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <LearningFooter
                    onComplete={handleCompleteLesson}
                    isCompleting={isCompleting}
                />
            </main>

            {/* Level Up / Success Modal */}
            {showXPModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={closeXPModal}></div>
                    <div className="relative bg-[#0D0D0D] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl transform scale-100 animate-bounce-in overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-orange-500/10 to-purple-500/10 pointer-events-none"></div>

                        <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(249,115,22,0.6)] animate-pulse">
                            <i className="fas fa-trophy text-3xl text-white"></i>
                        </div>

                        <h2 className="text-3xl font-bold text-white mb-2 font-manrope">Lesson Complete!</h2>
                        <p className="text-zinc-400 mb-8">You're making great progress.</p>

                        <div className="flex items-center justify-center gap-2 text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-8">
                            +{xpGained} <span className="text-lg text-zinc-500 font-medium">XP</span>
                        </div>

                        <button
                            onClick={closeXPModal}
                            className="w-full py-3.5 rounded-xl font-bold bg-white text-black hover:bg-orange-500 hover:text-white transition-all shadow-lg"
                        >
                            Continue Learning
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LearningView;
