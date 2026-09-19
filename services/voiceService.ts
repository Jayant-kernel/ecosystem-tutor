import { ConsoleOutput, TestResult } from '../types';

const API_BASE_URL = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '';

export interface VoiceToolCall {
    name: string;
    args: Record<string, any>;
}

export interface VoiceResult {
    sessionId: string;
    transcript: string;
    response: string;
    /** Base64-encoded audio (see note in README). */
    audio: string;
    audioMimeType: string;
    audioEncoding: 'base64';
    toolCalls: VoiceToolCall[];
}

export interface VoiceRequest {
    /** Omitted for the intro turn, where the tutor speaks first. */
    audio?: Blob;
    sessionId?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    courseTitle?: string;
    lessonTitle?: string;
    objectives?: string;
    aiMemory?: string;
    editorCode?: string;
    /** 'theory' | 'light' | 'hands-on' — gates the tutor's code tools. */
    lessonMode?: string;
    /** The lesson guide text, so the tutor can teach from the same material. */
    lessonGuide?: string;
    /** The lesson's flow chart, flattened to "step -> step -> step". */
    lessonFlows?: string;
    /** Chapters available from the beginning of this course through the current lesson. */
    learningPath?: string;
    /** The exercise the learner is currently working on. */
    lessonTask?: string;
    /** Compact semantic summary of an existing visual scene, never raw DOM or coordinates. */
    visualScene?: string;
    /** Ask the tutor to open the conversation with an offer of options. */
    intro?: boolean;
}

export interface ExecutionResult {
    output: ConsoleOutput[];
    results?: TestResult[];
}

export interface IntroRequest {
    sessionId?: string;
    lessonTitle: string;
    moduleTitle?: string;
    objectives?: string;
    openingQuestion?: string;
    lessonSummary?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    aiMemory?: string;
    editorCode?: string;
}

export interface IntroResult {
    sessionId: string;
    response: string;
    audio: string;
    audioMimeType: string;
    toolCalls: VoiceToolCall[];
}

export const voiceService = {
    /** Whether an AWS backend base URL is configured for this build. */
    isConfigured: (): boolean => Boolean(API_BASE_URL),

    /** Create a server-side conversation session id. */
    async createSession(): Promise<string> {
        if (!API_BASE_URL) throw new Error('Voice backend not configured. Set VITE_API_BASE_URL.');
        const res = await fetch(`${API_BASE_URL}/session`);
        if (!res.ok) throw new Error(`Failed to create session (${res.status})`);
        const data = await res.json();
        return data.sessionId as string;
    },

    /**
     * Send recorded audio to our backend, which runs
     * STT -> Bedrock (Claude) -> TTS. The ElevenLabs key never leaves the server.
     */
    async processVoice(request: VoiceRequest): Promise<VoiceResult> {
        if (!API_BASE_URL) throw new Error('Voice backend not configured. Set VITE_API_BASE_URL.');

        const form = new FormData();
        if (request.intro) {
            form.append('intro', 'true');
        } else if (request.audio) {
            form.append('audio', request.audio, 'audio.webm');
        }
        if (request.sessionId) form.append('sessionId', request.sessionId);
        if (request.history?.length) form.append('history', JSON.stringify(request.history));
        if (request.courseTitle) form.append('courseTitle', request.courseTitle);
        if (request.lessonTitle) form.append('lessonTitle', request.lessonTitle);
        if (request.objectives) form.append('objectives', request.objectives);
        if (request.aiMemory) form.append('aiMemory', request.aiMemory);
        if (request.editorCode) form.append('editorCode', request.editorCode);
        if (request.lessonMode) form.append('lessonMode', request.lessonMode);
        if (request.lessonGuide) form.append('lessonGuide', request.lessonGuide);
        if (request.lessonFlows) form.append('lessonFlows', request.lessonFlows);
        if (request.learningPath) form.append('learningPath', request.learningPath);
        if (request.lessonTask) form.append('lessonTask', request.lessonTask);
        if (request.visualScene) form.append('visualScene', request.visualScene);

        const res = await fetch(`${API_BASE_URL}/voice`, { method: 'POST', body: form });
        if (!res.ok) {
            let message = `Voice request failed (${res.status})`;
            try {
                const body = await res.json();
                if (body?.error?.message) message = body.error.message;
            } catch {
                /* keep default message */
            }
            throw new Error(message);
        }
        return (await res.json()) as VoiceResult;
    },

    /**
     * Ask the tutor to introduce a chapter (text-in, no microphone needed).
     * Runs the same tutor + TTS pipeline as voice, minus STT.
     */
    async requestIntro(request: IntroRequest): Promise<IntroResult> {
        if (!API_BASE_URL) throw new Error('Voice backend not configured. Set VITE_API_BASE_URL.');
        const res = await fetch(`${API_BASE_URL}/intro`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(request),
        });
        if (!res.ok) {
            let message = `Intro request failed (${res.status})`;
            try {
                const body = await res.json();
                if (body?.error?.message) message = body.error.message;
            } catch {
                /* keep default message */
            }
            throw new Error(message);
        }
        return (await res.json()) as IntroResult;
    },

    /** Execute learner code in the server-side sandbox. */
    async executeCode(code: string, tests?: string[]): Promise<ExecutionResult> {
        if (!API_BASE_URL) throw new Error('Execution backend not configured.');
        const res = await fetch(`${API_BASE_URL}/execute`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ code, tests }),
        });
        if (!res.ok) throw new Error(`Execution failed (${res.status})`);
        return (await res.json()) as ExecutionResult;
    },
};

/** Decode a base64 audio payload into a Blob for playback. */
export function base64ToBlob(base64: string, mimeType: string): Blob {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType || 'audio/mpeg' });
}
