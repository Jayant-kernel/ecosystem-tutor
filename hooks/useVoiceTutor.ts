import { useCallback, useEffect, useRef, useState } from 'react';
import { Course, Lesson, Progress, Transcript, TutorToolCall, TutorToolResponse } from '../types';
import { voiceService, base64ToBlob } from '../services/voiceService';
import { audioLevels, resetAudioLevels, MIC_REFERENCE, SPEAKER_REFERENCE } from '../utils/audioLevels';

const MAX_HISTORY_TURNS = 8;

/**
 * Hands-free recording: stop automatically once the learner stops speaking.
 *
 * Tuned by ear. Raise `threshold` for a noisy room, raise `silenceMs` if it cuts
 * people off mid-thought, lower it if it feels slow. Manual tap-to-stop always
 * still works, and this can be switched off from the mic panel.
 */
const HANDS_FREE = {
  /** RMS below this counts as silence (0-1). Lower = catches soft speakers. */
  threshold: 0.035,
  /** Stop after this much silence, once speech has actually started. */
  silenceMs: 1200,
  /** Ignore brief blips: require this much voiced time before arming the stop. */
  minSpeechMs: 350,
  /** Hard cap, so a noisy room can never record forever. */
  maxMs: 30000,
};

/** Trim a context string so a single lesson cannot bloat the prompt. */
const clip = (value: string | undefined, max: number): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
};

/** Flatten a lesson's flow charts into "step -> step -> step" lines. */
const lessonFlowsText = (lesson: Lesson | null): string | undefined => {
  const flows = lesson?.content?.flows;
  if (!flows?.length) return undefined;
  return flows
    .map((flow) => {
      const steps = flow.steps.map((step) => step.label).join(' -> ');
      return flow.title ? `${flow.title}: ${steps}` : steps;
    })
    .join('\n');
};

/** A compact curriculum map from lesson one through the learner's current chapter. */
const learningPathText = (course: Course | undefined, currentLesson: Lesson | null): string | undefined => {
  if (!course || !currentLesson) return undefined;
  const entries: string[] = [];
  for (let moduleIndex = 0; moduleIndex < course.modules.length; moduleIndex += 1) {
    const module = course.modules[moduleIndex];
    for (let lessonIndex = 0; lessonIndex < module.lessons.length; lessonIndex += 1) {
      const lesson = module.lessons[lessonIndex];
      const objective = lesson.objectives?.[0]?.replace(/\s+/g, ' ').trim();
      entries.push(`M${moduleIndex + 1} L${lessonIndex + 1}: ${lesson.title}${objective ? ` — ${objective}` : ''}`);
      if (lesson.id === currentLesson.id) return entries.join('\n');
    }
  }
  return undefined;
};

/** A direct request is a learner UI command, even if a hosted model misses its tool call. */
const isDirectVisualRequest = (value: string) => /\b(?:show|make|draw|build|create|explain)\b[^.]{0,56}\b(?:visual(?:ly|isation|ization)?|flow\s*chart|flowchart|diagram|architecture|data\s*flow)\b|\b(?:flow\s*chart|flowchart|diagram|visual(?:ly|isation|ization)?)\b|फ्लो\s*चार्ट|फ्लोचार्ट|डायग्राम|विजुअल|चित्र/.test(value.toLowerCase());

/**
 * Custom voice pipeline (no ElevenLabs Conversational AI Agent):
 *
 *   mic -> record -> POST /voice -> ElevenLabs STT -> Bedrock/Gemini
 *        -> ElevenLabs TTS -> play audio
 *
 * The tutor speaks first: on the first startSession of a lesson it requests an
 * intro turn, plays it, and only then opens the microphone.
 */
export const useVoiceTutor = (
  onStreamMessage: (transcript: Transcript) => void,
  onToolCall: (calls: TutorToolCall[]) => Promise<TutorToolResponse[]>,
  progress: Progress,
  currentLesson: Lesson | null,
  editorCodeRef?: React.MutableRefObject<string>,
  courseTitle?: string,
  visualSceneRef?: React.MutableRefObject<string>,
  course?: Course,
) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [handsFree, setHandsFree] = useState(true);
  const [isStopPending, setIsStopPending] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const historyRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const finishPlaybackRef = useRef<(() => void) | null>(null);
  const introPlayedRef = useRef<string | null>(null);
  // Graceful stop: finish the turn in flight, then end the session.
  const stopRequestedRef = useRef(false);
  const discardRecordingRef = useRef(false);

  // Hands-free (voice activity) plumbing.
  const handsFreeRef = useRef(handsFree);
  const isMutedRef = useRef(isMuted);
  const stopSessionRef = useRef<() => void>(() => {});
  const beginRecordingRef = useRef<() => Promise<void>>(async () => {});
  const unmountedRef = useRef(false);
  const vadRef = useRef<{
    ctx: AudioContext;
    analyser: AnalyserNode;
    raf: number;
    maxTimer: number;
    speechStartedAt: number | null;
    lastVoiceAt: number;
  } | null>(null);

  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  const onStreamRef = useRef(onStreamMessage);
  useEffect(() => { onStreamRef.current = onStreamMessage; }, [onStreamMessage]);

  const onToolCallRef = useRef(onToolCall);
  useEffect(() => { onToolCallRef.current = onToolCall; }, [onToolCall]);

  // A new lesson earns a fresh opening from the tutor.
  useEffect(() => {
    introPlayedRef.current = null;
  }, [currentLesson?.id]);

  const stopPlayback = useCallback(() => {
    const audio = audioElRef.current;
    if (audio) {
      audio.pause();
      audioElRef.current = null;
    }
    setIsPlaying(false);
    finishPlaybackRef.current?.();
    finishPlaybackRef.current = null;
  }, []);

  /** Returns the current session id, creating a backend session on first use. */
  const ensureSessionId = useCallback(async (): Promise<string> => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = await voiceService.createSession();
    }
    return sessionIdRef.current;
  }, []);

  /** Append an exchange (e.g. a chapter intro) to the local conversation history. */
  const pushHistory = useCallback((userText: string, assistantText: string) => {
    if (!userText && !assistantText) return;
    historyRef.current = [
      ...historyRef.current,
      { role: 'user' as const, content: userText },
      { role: 'assistant' as const, content: assistantText },
    ].slice(-MAX_HISTORY_TURNS);
  }, []);

  /** Start a fresh conversation (used when the learner opens another chapter). */
  const resetConversation = useCallback(() => {
    historyRef.current = [];
    sessionIdRef.current = null;
    setSessionError(null);
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  /** Resolves when playback finishes, errors, or is stopped by the learner. */
  const playAudio = useCallback((base64: string, mimeType: string) => {
    return new Promise<void>((resolve) => {
      const url = URL.createObjectURL(base64ToBlob(base64, mimeType));
      const audio = new Audio(url);
      audioElRef.current = audio;
      setIsPlaying(true);

      // Route the tutor's voice through an analyser so the orb can pulse with
      // the actual speech rather than a timed guess.
      let analyser: AnalyserNode | null = null;
      let raf = 0;
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (Ctx) {
          if (!audioContextRef.current) audioContextRef.current = new Ctx();
          const ctx = audioContextRef.current;
          if (ctx.state === 'suspended') void ctx.resume();
          const source = ctx.createMediaElementSource(audio);
          analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          source.connect(analyser);
          analyser.connect(ctx.destination);
        }
      } catch {
        analyser = null;
      }

      const samples = analyser ? new Float32Array(analyser.fftSize) : null;
      const tick = () => {
        if (analyser && samples) {
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
          audioLevels.speaker = Math.min(1, Math.sqrt(sum / samples.length) / SPEAKER_REFERENCE);
        }
        raf = requestAnimationFrame(tick);
      };
      if (analyser) raf = requestAnimationFrame(tick);

      const finish = () => {
        cancelAnimationFrame(raf);
        audioLevels.speaker = 0;
        URL.revokeObjectURL(url);
        if (audioElRef.current === audio) audioElRef.current = null;
        finishPlaybackRef.current = null;
        setIsPlaying(false);
        resolve();
      };

      finishPlaybackRef.current = finish;
      audio.onended = finish;
      audio.onerror = finish;
      audio.play().catch(finish);
    });
  }, []);

  /** Tear down the voice-activity watcher (safe to call at any time). */
  const stopVad = useCallback(() => {
    const vad = vadRef.current;
    audioLevels.mic = 0;
    if (!vad) return;
    vadRef.current = null;
    cancelAnimationFrame(vad.raf);
    window.clearTimeout(vad.maxTimer);
    void vad.ctx.close().catch(() => {});
  }, []);

  /**
   * Watch the live microphone level and end the turn when the learner pauses.
   * Falls back silently to manual tap-to-stop if Web Audio is unavailable.
   */
  const startVad = useCallback((stream: MediaStream) => {
    stopVad();
    if (!handsFreeRef.current) return;

    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;

      const ctx: AudioContext = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);

      const samples = new Float32Array(analyser.fftSize);
      const startedAt = performance.now();
      const vad = {
        ctx,
        analyser,
        raf: 0,
        maxTimer: 0,
        speechStartedAt: null as number | null,
        lastVoiceAt: startedAt,
      };
      vadRef.current = vad;

      // Safety net: never record past maxMs, even if nobody speaks.
      vad.maxTimer = window.setTimeout(() => {
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== 'inactive') stopSessionRef.current();
      }, HANDS_FREE.maxMs);

      const tick = () => {
        const current = vadRef.current;
        if (!current) return;

        current.analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
        const rms = Math.sqrt(sum / samples.length);
        const now = performance.now();

        // Feed the orb. Raw (undamped) — the orb smooths it per frame.
        audioLevels.mic = Math.min(1, rms / MIC_REFERENCE);

        // While muted we cannot hear them, so never auto-stop on silence.
        const muted = isMutedRef.current;
        if (!muted && rms >= HANDS_FREE.threshold) {
          if (current.speechStartedAt === null) current.speechStartedAt = now;
          current.lastVoiceAt = now;
        }

        const spokeLongEnough =
          current.speechStartedAt !== null &&
          current.lastVoiceAt - current.speechStartedAt >= HANDS_FREE.minSpeechMs;
        const pausedLongEnough = now - current.lastVoiceAt >= HANDS_FREE.silenceMs;

        if (!muted && spokeLongEnough && pausedLongEnough) {
          stopSessionRef.current();
          return;
        }

        current.raf = requestAnimationFrame(tick);
      };

      vad.raf = requestAnimationFrame(tick);
    } catch {
      /* No Web Audio: the learner just taps the mic to stop, as before. */
    }
  }, [stopVad]);

  const lessonContext = useCallback(() => ({
    courseTitle,
    lessonTitle: currentLesson?.title,
    objectives: currentLesson?.objectives?.join('; '),
    aiMemory: progress.aiMemory?.slice(-3).join('; '),
    lessonMode: currentLesson?.mode,
    lessonGuide: clip(currentLesson?.content?.explanations?.join('\n\n'), 3000),
    lessonFlows: clip(lessonFlowsText(currentLesson), 1200),
    learningPath: clip(learningPathText(course, currentLesson), 1800),
    lessonTask: clip(currentLesson?.content?.exercises?.[0]?.prompt, 800),
    visualScene: clip(visualSceneRef?.current, 1200),
  }), [course, courseTitle, currentLesson, progress.aiMemory, visualSceneRef]);

  const ensureSession = useCallback(async () => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = await voiceService.createSession();
    }
    return sessionIdRef.current;
  }, []);

  const sendRecording = useCallback(async (blob: Blob) => {
    if (!blob.size) {
      setSessionError('No audio was captured. Please try again.');
      return;
    }

    setIsProcessing(true);
    setSessionError(null);
    try {
      const sessionId = await ensureSession();

      const result = await voiceService.processVoice({
        audio: blob,
        sessionId,
        history: historyRef.current.slice(-MAX_HISTORY_TURNS),
        editorCode: editorCodeRef?.current,
        ...lessonContext(),
      });

      onStreamRef.current({
        user: result.transcript,
        ai: result.response,
        isFinal: true,
      });

      if (result.transcript || result.response) {
        historyRef.current = [
          ...historyRef.current,
          { role: 'user' as const, content: result.transcript },
          { role: 'assistant' as const, content: result.response },
        ].slice(-MAX_HISTORY_TURNS);
      }

      const toolCalls = result.toolCalls || [];
      if (toolCalls.length) {
        await onToolCallRef.current(
          toolCalls.map((call, index) => ({
            id: `voice-tool-${index}`,
            name: call.name,
            args: call.args || {},
          })),
        );
      }

      // The live backend normally supplies a presentVisualExplanation call.
      // This client fallback keeps direct requests working during a rolling
      // backend deployment or if an LLM replies in text without that call.
      const hasVisualCall = toolCalls.some((call) =>
        call?.name === 'presentVisualExplanation' || call?.name === 'offerVisualExplanation');
      if (isDirectVisualRequest(result.transcript) && !hasVisualCall) {
        await onToolCallRef.current([{
          id: 'voice-visual-fallback',
          name: 'offerVisualExplanation',
          args: { topic: lessonContext().lessonTitle || 'this concept' },
        }]);
      }

      if (result.audio) {
        await playAudio(result.audio, result.audioMimeType);
      }

      // Hands-free: as soon as the tutor stops speaking, hand the microphone
      // straight back. Only when the learner actually said something, so a
      // silent room cannot loop "I didn't catch that" forever. A pending stop
      // ends the session after this turn instead of reopening the mic.
      if (!stopRequestedRef.current && handsFreeRef.current && !unmountedRef.current && result.transcript) {
        await beginRecordingRef.current();
      }
    } catch (error: any) {
      setSessionError(error?.message || 'Voice request failed');
    } finally {
      setIsProcessing(false);
      if (stopRequestedRef.current) {
        stopRequestedRef.current = false;
        setIsStopPending(false);
        releaseStream();
        setIsRecording(false);
      }
    }
  }, [editorCodeRef, ensureSession, lessonContext, playAudio, releaseStream]);

  /** The tutor opens the conversation, then hands over the microphone. */
  const playIntro = useCallback(async () => {
    setIsProcessing(true);
    try {
      const sessionId = await ensureSession();
      const result = await voiceService.processVoice({
        intro: true,
        sessionId,
        ...lessonContext(),
      });

      onStreamRef.current({ user: '', ai: result.response, isFinal: true });
      historyRef.current = [
        ...historyRef.current,
        { role: 'assistant' as const, content: result.response },
      ].slice(-MAX_HISTORY_TURNS);

      if (result.audio) await playAudio(result.audio, result.audioMimeType);
    } catch (error: any) {
      setSessionError(error?.message || 'Could not start the tutor.');
    } finally {
      setIsProcessing(false);
    }
  }, [ensureSession, lessonContext, playAudio]);

  /**
   * Open the microphone and start a fresh turn. Used both for the first tap and
   * for the hands-free hand-back once the tutor has finished speaking.
   */
  const beginRecording = useCallback(async () => {
    if (!voiceService.isConfigured()) return;
    const existing = recorderRef.current;
    if (existing && existing.state !== 'inactive') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        // A stop tapped mid-recording drops that turn rather than sending it.
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          return;
        }
        void sendRecording(blob);
      };

      recorder.start();
      setIsRecording(true);
      setIsMuted(false);
      startVad(stream);
    } catch (error: any) {
      releaseStream();
      setSessionError(
        error?.name === 'NotAllowedError'
          ? 'Microphone permission denied.'
          : error?.message || 'Could not access the microphone.',
      );
    }
  }, [releaseStream, sendRecording, startVad]);

  beginRecordingRef.current = beginRecording;

  const startSession = useCallback(async () => {
    if (isRecording || isProcessing) return;

    if (!voiceService.isConfigured()) {
      setSessionError('Voice backend not configured (set VITE_API_BASE_URL).');
      return;
    }

    setSessionError(null);

    // Speak first, once per lesson, before opening the microphone.
    if (!introPlayedRef.current) {
      introPlayedRef.current = currentLesson?.id ?? 'open';
      await playIntro();
    }

    // A stop tapped during the spoken intro ends the session instead of
    // opening the microphone.
    if (stopRequestedRef.current) {
      stopRequestedRef.current = false;
      setIsStopPending(false);
      releaseStream();
      setIsRecording(false);
      return;
    }

    await beginRecording();
  }, [beginRecording, currentLesson?.id, isProcessing, isRecording, playIntro, releaseStream]);

  const stopSession = useCallback(() => {
    stopVad();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    releaseStream();
    setIsRecording(false);
  }, [releaseStream, stopVad]);

  // Let the voice-activity watcher end the turn through the normal stop path.
  useEffect(() => { stopSessionRef.current = stopSession; }, [stopSession]);

  /**
   * Graceful stop. Any in-flight turn (thinking/speaking) finishes first, then
   * the session ends instead of handing the microphone back. An idle recording
   * is dropped immediately, so stopping never plays a half-finished thought.
   */
  const requestStop = useCallback(() => {
    if (stopRequestedRef.current || isStopPending) return;
    if (isProcessing || isPlaying) {
      stopRequestedRef.current = true;
      setIsStopPending(true);
      return;
    }
    discardRecordingRef.current = true;
    stopSession();
  }, [isProcessing, isPlaying, isStopPending, stopSession]);

  const toggleHandsFree = useCallback(() => {
    const next = !handsFree;
    setHandsFree(next);
    handsFreeRef.current = next;
    const recorder = recorderRef.current;
    const recording = !!recorder && recorder.state !== 'inactive';
    if (!next) {
      stopVad();
    } else if (recording && streamRef.current) {
      startVad(streamRef.current);
    }
  }, [handsFree, startVad, stopVad]);

  const toggleMute = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const next = !isMuted;
    stream.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setIsMuted(next);
  }, [isMuted]);

  useEffect(() => () => {
    unmountedRef.current = true;
    stopVad();
    stopPlayback();
    resetAudioLevels();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    releaseStream();
  }, [releaseStream, stopPlayback, stopVad]);

  /** Play server-generated audio (e.g. a chapter intro) outside a recording. */
  const playExternalAudio = useCallback(async (base64: string, mimeType: string) => {
    setSessionError(null);
    await playAudio(base64, mimeType);
  }, [playAudio]);

  return {
    isSessionActive: isRecording,
    isConnecting: isProcessing,
    isSpeaking: isPlaying,
    isListening: isRecording,
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
    playExternalAudio,
  };
};
