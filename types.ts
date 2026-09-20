
export interface Message {
    id: string;
    sender: 'user' | 'ai';
    text: string;
}

export enum InteractionMode {
    Chat = 'CHAT',
    Voice = 'VOICE',
}

export interface Progress {
    completedLessons: string[];
    currentLessonId: string;
    aiMemory: string[];
}

// New strictly typed Firestore models
export interface UserProfile {
    uid: string;
    name: string;
    email: string;
    createdAt: string;
}

export interface CourseProgress {
    completedLessonIds: string[];
    currentLessonId: string | null;
    aiMemory?: string[];
    updatedAt?: any; // generic for Firestore Timestamp or Date
}

export interface UserNotes {
    content: string;
    updatedAt?: any;
}

export interface LessonNote {
    lessonId: string;
    lessonTitle: string;
    content: string;
    updatedAt?: any;
}

export interface Transcript {
    user: string;
    ai: string;
    isFinal: boolean;
}

// --- Voice tutor tool-calling (provider-agnostic) ---
export interface TutorToolCall {
    id: string;
    name: string;
    args: Record<string, any>;
}

export interface TutorToolResponse {
    id: string;
    name: string;
    response: { result?: any; error?: string };
}

export interface ConsoleOutput {
    type: 'log' | 'error' | 'warn' | 'info';
    message: string;
}

export interface TestResult {
    test: string;
    passed: boolean;
    error?: string;
}

// --- Auth Types ---
export interface User {
    id: string;
    email: string;
    name: string;
}

// --- Standardized Curriculum Types ---
export interface Demo {
    code: string;
    explainByLine: boolean;
}

export interface Question {
    type: 'recall' | 'apply' | 'predict' | 'mcq' | 'output' | 'code';
    prompt: string;
    choices?: string[];
    answer?: string;
}

export interface DebuggingChallenge {
    buggyCode: string;
    hints: string[];
    solution: string;
}

export interface Exercise {
    prompt: string;
    tests: string[];
}

export interface Assessment {
    questions: Question[];
    passCriteria: {
        minCorrect: number;
    };
}

export interface LessonContent {
    explanations: string[];
    demos: Demo[];
    oralQuestions: Question[];
    debugging: DebuggingChallenge[];
    exercises: Exercise[];
    assessment: Assessment;
    /** Optional flow charts rendered in the Guide tab, where a sequence matters. */
    flows?: Flow[];
}

export interface FlowStep {
    label: string;
    detail?: string;
}

export interface Flow {
    title?: string;
    /** "vertical" (default) reads as a timeline; "horizontal" reads as a chain. */
    direction?: 'horizontal' | 'vertical';
    steps: FlowStep[];
}

export interface MemoryUpdates {
    conceptsMastered: string[];
    mistakeWatchlist: string[];
}

export interface Lesson {
    id: string;
    title: string;
    objectives: string[];
    prerequisites: string[];
    timeEstimateMin: number;
    content: LessonContent;
    memoryUpdates: MemoryUpdates;
    nextLesson?: string | null;
    /**
     * How this lesson should be taught.
     * - theory:     concept/judgement. No editor, no console.
     * - light:      a few guided lines; hints available immediately.
     * - hands-on:   full coding loop with tests.
     */
    mode?: LessonMode;
    /**
     * Change metadata for lessons in the Dynamic Course. Omitted by every
     * stable-course lesson. See DynamicLessonMeta.
     */
    dynamic?: DynamicLessonMeta;
}

export type LessonMode = 'theory' | 'light' | 'hands-on';

// --- Dynamic-course change metadata ---------------------------------------
// The Dynamic Course tracks a moving ecosystem instead of a fixed stack, so
// each of its lessons carries change metadata. Every field is OPTIONAL:
// stable courses simply omit `dynamic`. A future update pipeline
// (sources → change detection → AI proposal → review → course update) can
// add, refresh, deprecate, or replace individual lessons by reading and
// writing exactly these fields — never by rewriting the whole course.

/** What kind of ecosystem change a dynamic lesson describes. */
export type DynamicChangeCategory =
  | 'new'         // newly introduced technology or service
  | 'emerging'    // gaining traction, worth watching, not yet default
  | 'updated'     // major version / API / behavior change in something taught
  | 'alternative' // better/faster/simpler replacement for an older approach
  | 'deprecated'; // on the way out — what to migrate to instead

export interface DynamicLessonMeta {
  category: DynamicChangeCategory;
  /** Technology or service the lesson tracks (e.g. "serverless GPUs"). */
  technology?: string;
  /** Version the lesson was written against, when applicable. */
  version?: string;
  /** ISO date (YYYY-MM) the technology/change first appeared. */
  introducedAt?: string;
  /** ISO date (YYYY-MM) this lesson's content was last updated. */
  lastUpdatedAt?: string;
  /** ISO date (YYYY-MM) this lesson was last reviewed for accuracy. */
  lastReviewedAt?: string;
  /** IDs of lessons/topics this lesson replaces or offers an alternative to. */
  supersedes?: string[];
}

export interface Module {
    id: string;
    title: string;
    lessons: Lesson[];
    practice?: ModulePractice;
}

// --- Module Practice (end-of-module MCQ + coding drills) ---

export type PracticeDifficulty = 'easy' | 'medium';

export interface PracticeMcq {
    id: string;
    prompt: string;
    choices: string[];
    answer: string;
    explanation: string;
}

export interface PracticeCoding {
    id: string;
    title: string;
    difficulty: PracticeDifficulty;
    prompt: string;
    starterCode: string;
    tests: string[];
    /** Progressive hints, revealed one at a time. */
    hints: string[];
    /** Where the animated arrow should point when a hint is shown. */
    target: { label: string; line: number };
    /** Steps revealed one by one by the animated explanation. */
    explanation: string[];
    solution: string;
}

export interface ModulePractice {
    moduleId: string;
    title: string;
    mcqs: PracticeMcq[];
    coding: PracticeCoding[];
}

export interface Course {
    id: string;
    title: string;
    description: string;
    outcomes?: string[];
    prerequisites?: string[];
    level?: string;
    totalDuration?: string;
    modules: Module[];
    /**
     * Marks a continuously-updated course (the Dynamic Course). Lets cards,
     * dashboards, and any future update pipeline distinguish evolving
     * content from the stable core curriculum without ID sniffing.
     */
    isDynamic?: boolean;
    /** ISO date (YYYY-MM) a dynamic course's content was last refreshed. */
    lastUpdated?: string;
}

export interface RawCurriculumDatabase {
    course: {
        id: string;
        name: string;
        description: string;
        modules: Module[];
    };
}
