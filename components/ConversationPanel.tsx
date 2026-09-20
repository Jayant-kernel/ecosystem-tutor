
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Transcript, Lesson } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useUserNotes } from '../hooks/useUserNotes';
import FlowDiagram from './FlowDiagram';
import TutorOrb from './tutor-orb/TutorOrb';
import type { OrbState } from './tutor-orb/types';

interface ConversationPanelProps {
    isSessionActive: boolean;
    isConnecting: boolean;
    isListening: boolean;
    isSpeaking: boolean;
    isMuted: boolean;
    handsFree: boolean;
    toggleHandsFree: () => void;
    startSession: () => void;
    stopSession: () => void;
    requestStop: () => void;
    isStopPending: boolean;
    toggleMute: () => void;
    transcript: Transcript;
    sessionError: string | null;
    currentLesson: Lesson | null;
    onRequestIntro: (() => void) | null;
    introLoading: boolean;
}

const ConversationPanel: React.FC<ConversationPanelProps> = ({
    isSessionActive,
    isConnecting,
    isListening,
    isSpeaking,
    isMuted,
    handsFree,
    toggleHandsFree,
    startSession,
    stopSession,
    requestStop,
    isStopPending,
    toggleMute,
    transcript,
    sessionError,
    currentLesson,
    onRequestIntro,
    introLoading
}) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'guide' | 'tutor' | 'notes'>('guide');
    const [showSavedNotes, setShowSavedNotes] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [customFileName, setCustomFileName] = useState('');
    const { notes, updateNotes, isLoading: isNotesLoading, isSaving, savedNotes } = useUserNotes(
        currentLesson?.id,
        currentLesson?.title
    );

    // Function to save notes as a file
    const handleSaveToFile = () => {
        if (!notes.trim()) return;

        const fileName = customFileName.trim() || currentLesson?.title || 'my-notes';
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_');
        const blob = new Blob([notes], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${sanitizedFileName}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setShowSaveModal(false);
        setCustomFileName('');
    };

    // Keyboard shortcut for Mute (Alt + M)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.code === 'KeyM' && isSessionActive) {
                e.preventDefault();
                toggleMute();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSessionActive, toggleMute]);

    const canStop = isSessionActive || isConnecting || isSpeaking || isStopPending;

    const handleMicClick = () => {
        if (canStop) {
            requestStop();
        } else {
            startSession();
        }
    };

    // The orb's state is derived from the existing session flags — the orb
    // itself owns no voice logic.
    const orbState: OrbState = sessionError
        ? 'error'
        : isConnecting
            ? 'thinking'
            : isSpeaking
                ? 'speaking'
                : isSessionActive
                    ? 'listening'
                    : 'idle';

    const getStatusText = () => {
        if (sessionError) return sessionError;
        if (isStopPending) return 'Finishing this turn, then stopping...';
        if (isConnecting) return 'Connecting...';
        if (isSessionActive) {
            if (isMuted) return 'Mic Muted (Alt+M)';
            if (isSpeaking) return 'AI Speaking (Auto-Muted)';
            if (isListening) return handsFree ? 'Listening... (hands-free)' : 'Listening...';
            return 'Session Active';
        }
        return 'Tap to Start';
    }

    return (
        <div className="bg-zinc-900/40 backdrop-blur-md rounded-[1.5rem] flex flex-col h-full border border-white/5 overflow-hidden shadow-xl relative group">
            {/* Ambient Glow */}
            <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-orange-500/5 to-transparent pointer-events-none"></div>

            <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/20 flex-shrink-0 z-10">
                <div className="flex bg-black/40 rounded-lg p-1 border border-white/5 w-full">
                    <button
                        onClick={() => setActiveTab('guide')}
                        className={`flex-1 px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'guide' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        Guide
                    </button>
                    <button
                        data-tour="ai-tutor"
                        onClick={() => setActiveTab('tutor')}
                        className={`flex-1 px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'tutor' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        AI Tutor
                    </button>
                    <button
                        data-tour="notes"
                        onClick={() => setActiveTab('notes')}
                        className={`flex-1 px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'notes' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        Notes
                        {isSaving && <i className="fas fa-sync fa-spin opacity-50 text-[10px]"></i>}
                    </button>
                </div>
            </header>

            <div className="flex-grow flex flex-col min-h-0 relative z-10">
                {activeTab === 'guide' && (
                    <div className="flex-grow p-6 overflow-y-auto custom-scrollbar">
                        <h2 className="text-2xl font-bold font-manrope text-white mb-6">{currentLesson?.title || 'Loading...'}</h2>

                        {currentLesson?.content.explanations ? (
                            <div className="space-y-6">
                                {currentLesson.content.explanations.map((text, idx) => (
                                    <div key={idx} className="prose prose-invert prose-p:text-zinc-300 prose-headings:text-white max-w-none">
                                        <p className="leading-relaxed text-sm md:text-base">{text}</p>
                                    </div>
                                ))}

                                {currentLesson.content.flows?.map((flow, idx) => (
                                    <FlowDiagram key={idx} flow={flow} />
                                ))}

                                <div className="mt-8 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                                    <h4 className="text-sm font-bold text-orange-400 mb-2 flex items-center gap-2">
                                        <i className="fas fa-lightbulb"></i> AI Tip
                                    </h4>
                                    <p className="text-xs text-orange-200/70">
                                        Stuck? Switch to the "AI Tutor" tab and ask for a hint! The AI knows exactly where you are in the lesson.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
                                <i className="fas fa-book-open text-4xl opacity-20"></i>
                                <p>Select a lesson to view contents</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'tutor' && (
                    <div className="flex-grow flex flex-col min-h-0">
                        {/* Transcription Area with Glass Effect */}
                        <div className="flex-grow p-4 overflow-y-auto min-h-0 space-y-4 custom-scrollbar flex flex-col">
                            {transcript.user && (
                                <div className="self-end max-w-[85%]">
                                    <div className="bg-orange-500 text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-lg shadow-orange-500/10 text-sm">
                                        {transcript.user}
                                    </div>
                                </div>
                            )}

                            {transcript.ai && (
                                <div className="self-start max-w-[85%] flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg border border-white/10">
                                        <i className="fas fa-robot text-xs text-white"></i>
                                    </div>
                                    <div className="bg-zinc-800/80 border border-white/5 backdrop-blur-sm text-zinc-200 px-4 py-3 rounded-2xl rounded-tl-sm shadow-lg text-sm leading-relaxed">
                                        {transcript.ai}
                                    </div>
                                </div>
                            )}

                            {/* Empty State / Welcome */}
                            {!transcript.user && !transcript.ai && (
                                <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-60">
                                    <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                                        <i className="fas fa-microphone-alt text-2xl text-zinc-500"></i>
                                    </div>
                                    <h3 className="text-zinc-300 font-bold mb-2">Voice Interface</h3>
                                    <p className="text-xs text-zinc-500 max-w-xs">Tap the microphone below to start talking to your AI Tutor.</p>
                                    {currentLesson && onRequestIntro && (
                                        <button
                                            onClick={onRequestIntro}
                                            disabled={introLoading}
                                            className="mt-4 px-4 py-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-bold hover:bg-orange-500/25 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait opacity-100"
                                        >
                                            {introLoading
                                                ? <i className="fas fa-spinner fa-spin"></i>
                                                : <i className="fas fa-play"></i>}
                                            {introLoading
                                                ? 'Introducing chapter…'
                                                : `Introduce "${currentLesson.title}"`}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Live Indicator */}
                            {isSessionActive && (transcript.user || transcript.ai) && (
                                <div className="text-center text-[10px] text-zinc-600 mt-2 font-mono">
                                    {isListening ? 'Listening...' : isSpeaking ? 'Speaking...' : 'Ready'}
                                </div>
                            )}
                        </div>

                        {/* Voice controls: the orb replaces the microphone button. */}
                        <div data-tour="voice-tutor" className="p-4 border-t border-white/5 bg-black/20 flex-shrink-0">
                            <div className="flex flex-col items-center gap-3">
                                <TutorOrb state={orbState} onToggle={handleMicClick} size={196} />

                                <p className="max-w-[260px] text-center text-[10px] font-medium uppercase leading-relaxed tracking-widest text-zinc-500">
                                    {getStatusText()}
                                </p>

                                <div className="flex items-center justify-center gap-2">
                                    <button
                                        onClick={requestStop}
                                        disabled={!canStop}
                                        title="Stop after the tutor finishes this turn"
                                        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-40 ${
                                            isStopPending
                                                ? 'border-red-500/40 bg-red-500/10 text-red-300'
                                                : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-red-500/10 hover:text-red-300'
                                        }`}
                                    >
                                        <i className={`fas ${isStopPending ? 'fa-spinner fa-spin' : 'fa-stop'}`}></i>
                                        {isStopPending ? 'Stopping' : 'Stop'}
                                    </button>

                                    <button
                                        onClick={toggleMute}
                                        disabled={!isSessionActive}
                                        title="Mute (Alt+M)"
                                        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-40 ${
                                            isMuted
                                                ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                                                : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
                                        }`}
                                    >
                                        <motion.span
                                            key={isMuted ? 'muted' : 'unmuted'}
                                            initial={{ scale: 0.5, rotate: isMuted ? -90 : 90, opacity: 0 }}
                                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                                            transition={{ duration: 0.25, ease: 'easeOut' }}
                                            className="flex items-center justify-center"
                                        >
                                            <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                                        </motion.span>
                                        {isMuted ? 'Muted' : 'Mute'}
                                    </button>

                                    <button
                                        onClick={toggleHandsFree}
                                        title="Hands-free: stops listening when you pause, and reopens the mic when the tutor finishes speaking"
                                        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                                            handsFree
                                                ? 'border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20'
                                                : 'border-white/10 bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300'
                                        }`}
                                    >
                                        <i className={`fas ${handsFree ? 'fa-wand-magic-sparkles' : 'fa-hand-pointer'}`}></i>
                                        Hands-free {handsFree ? 'on' : 'off'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'notes' && (
                    <div className="flex-grow p-4 flex flex-col min-h-0">
                        {/* Header with current lesson and toggle */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex-1">
                                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Notes for:</h4>
                                <p className="text-sm text-white font-medium truncate">
                                    {currentLesson?.title || 'Select a lesson'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowSavedNotes(!showSavedNotes)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${showSavedNotes
                                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                    : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10'
                                    }`}
                            >
                                <i className="fas fa-folder-open"></i>
                                Saved ({savedNotes.length})
                            </button>
                        </div>

                        {/* Saved Notes Panel */}
                        {showSavedNotes && savedNotes.length > 0 && (
                            <div className="mb-3 p-3 bg-black/30 rounded-xl border border-white/5 max-h-40 overflow-y-auto custom-scrollbar">
                                <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">All Saved Notes</h5>
                                <div className="space-y-1">
                                    {savedNotes.map((note) => (
                                        <div
                                            key={note.lessonId}
                                            className={`p-2 rounded-lg text-xs cursor-pointer transition-all ${note.lessonId === currentLesson?.id
                                                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/20'
                                                : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-transparent'
                                                }`}
                                        >
                                            <p className="font-medium truncate">{note.lessonTitle}</p>
                                            <p className="text-[10px] text-zinc-600 mt-0.5">
                                                {note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : ''}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {showSavedNotes && savedNotes.length === 0 && (
                            <div className="mb-3 p-4 bg-black/30 rounded-xl border border-white/5 text-center">
                                <i className="fas fa-sticky-note text-2xl text-zinc-600 mb-2"></i>
                                <p className="text-xs text-zinc-500">No saved notes yet. Start writing!</p>
                            </div>
                        )}

                        {/* Text Area */}
                        <textarea
                            className="flex-grow w-full bg-zinc-900/50 border border-white/10 rounded-xl p-4 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 resize-none transition-all"
                            placeholder={currentLesson ? "Type your notes for this lesson... (Auto-saved)" : "Select a lesson to start taking notes"}
                            value={notes}
                            onChange={(e) => updateNotes(e.target.value)}
                            disabled={!currentLesson}
                        ></textarea>

                        {/* Footer with status and Save button */}
                        <div className="flex items-center justify-between mt-2">
                            <p className="text-[10px] text-zinc-600">
                                {!currentLesson ? 'No lesson selected' : isSaving ? 'Saving...' : notes ? 'Saved to cloud' : 'Start typing...'}
                            </p>
                            <button
                                onClick={() => {
                                    setCustomFileName(currentLesson?.title || '');
                                    setShowSaveModal(true);
                                }}
                                disabled={!notes.trim()}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${notes.trim()
                                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/20'
                                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                    }`}
                            >
                                <i className="fas fa-download"></i>
                                Save to File
                            </button>
                        </div>
                    </div>
                )}

                {/* Save to File Modal */}
                {showSaveModal && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <i className="fas fa-file-export text-orange-500"></i>
                                Save Notes to File
                            </h3>

                            <div className="mb-4">
                                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2 block">File Name</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={customFileName}
                                        onChange={(e) => setCustomFileName(e.target.value)}
                                        placeholder="Enter file name..."
                                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/50"
                                        autoFocus
                                    />
                                    <span className="text-zinc-500 text-sm">.txt</span>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowSaveModal(false);
                                        setCustomFileName('');
                                    }}
                                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 transition-all text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveToFile}
                                    className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 transition-all text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    <i className="fas fa-save"></i>
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConversationPanel;
