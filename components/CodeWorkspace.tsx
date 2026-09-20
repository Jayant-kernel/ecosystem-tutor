
import React, { useEffect, useState } from 'react';
import EditorPanel from './EditorPanel';
import ConsolePanel from './ConsolePanel';
import ExercisePanel from './ExercisePanel';
import CodeTutorPointer from './CodeTutorPointer';
import type { TeachingRange } from './teachingTargets';
import { ConsoleOutput, Exercise, TestResult } from '../types';

interface CodeWorkspaceProps {
    code: string;
    onCodeChange: (value: string | undefined) => void;
    output: ConsoleOutput[];
    exercises: Exercise[];
    onRunTests: () => TestResult[];
    onRunCode: () => void;
    onResetCode: () => void;
    /** Lines the tutor is currently explaining. */
    highlightLines?: number[];
    /** Exact ranges the tutor is explaining (subset of highlightLines). */
    highlightRanges?: TeachingRange[];
    onMountEditor?: (editor: any, monaco: any) => void;
    /** Bumped by the parent when the tutor runs code, so the console tab takes over. */
    consoleTabSignal?: number;
    tutorFocusLine?: number | null;
    tutorFocusColumn?: number | null;
    tutorFocusLabel?: string;
}

type Tab = 'console' | 'exercises';

const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({
    code,
    onCodeChange,
    output,
    exercises,
    onRunTests,
    onRunCode,
    onResetCode,
    highlightLines,
    highlightRanges,
    onMountEditor,
    consoleTabSignal = 0,
    tutorFocusLine = null,
    tutorFocusColumn = null,
    tutorFocusLabel
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('console');
    const [editor, setEditor] = useState<any>(null);

    // When the AI tutor takes over the console, bring its tab to the front.
    useEffect(() => {
        if (consoleTabSignal > 0) setActiveTab('console');
    }, [consoleTabSignal]);

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="flex-[2] min-h-0 bg-zinc-900/40 backdrop-blur-md rounded-[1.5rem] border border-white/5 overflow-hidden shadow-xl flex flex-col relative group">
                {/* Editor Header decoration */}
                <div className="h-1 w-full bg-gradient-to-r from-orange-500/20 to-purple-500/20"></div>
                <div className="flex-grow relative">
                    <EditorPanel code={code} onCodeChange={onCodeChange} highlightLines={highlightLines} highlightRanges={highlightRanges} onMountEditor={(mountedEditor, monaco) => { setEditor(mountedEditor); onMountEditor?.(mountedEditor, monaco); }} />
                    <CodeTutorPointer editor={editor} line={tutorFocusLine} column={tutorFocusColumn} label={tutorFocusLabel} />
                </div>
            </div>

            <div className="flex-[3] min-h-0 flex flex-col bg-zinc-900/40 backdrop-blur-md rounded-[1.5rem] border border-white/5 overflow-hidden shadow-xl">
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/20 shrink-0">
                    <div className="flex gap-4">
                        <button
                            onClick={() => setActiveTab('console')}
                            className={`pb-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'console' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <i className="fas fa-terminal mr-2"></i> Console
                        </button>
                        <button
                            onClick={() => setActiveTab('exercises')}
                            className={`pb-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'exercises' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <i className="fas fa-dumbbell mr-2"></i> Exercises
                            {exercises.length > 0 && <span className="ml-2 bg-zinc-800 text-[10px] px-1.5 py-0.5 rounded-full text-zinc-400 border border-white/10">{exercises.length}</span>}
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onResetCode}
                            className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-white hover:bg-white/10 transition-colors uppercase tracking-wider"
                            title="Reset Code"
                        >
                            <i className="fas fa-undo"></i>
                            <span className="hidden sm:inline">Reset</span>
                        </button>
                        <button
                            onClick={onRunCode}
                            className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white px-5 py-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-all shadow-lg shadow-orange-500/20 transform hover:scale-105"
                            title="Run Code"
                        >
                            <i className="fas fa-play"></i>
                            <span className="hidden sm:inline">Run Code</span>
                        </button>
                    </div>
                </div>

                <div className="flex-grow relative bg-black/20">
                    {activeTab === 'console' ? (
                        <ConsolePanel output={output} />
                    ) : (
                        <ExercisePanel exercises={exercises} onRunTests={onRunTests} />
                    )}
                </div>
            </div>
        </div>
    );
};

// Memoized: the editor is expensive (Monaco) and must not re-render when
// unrelated state such as the live transcript changes.
export default React.memo(CodeWorkspace);
