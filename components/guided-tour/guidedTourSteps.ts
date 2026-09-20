import type { GuidedTourStep } from './guidedTourTypes';

/**
 * Canonical site-wide walkthrough, ordered as a progressive journey:
 * global navigation → course discovery → entering a course → lesson →
 * code → AI tutor → notes → visual teaching → reference → completion.
 *
 * Two step kinds:
 * - `next` (passive): the user reads and clicks Next. Used where no
 *   interaction is needed, or where forcing one would be destructive
 *   (resetting code, completing a lesson, opening the mic).
 * - `click` (interactive): the user MUST click the highlighted target.
 *   Next is replaced by an instruction; the tour advances when the real
 *   target click is observed and the app responds (including navigation).
 *
 * Steps whose `[data-tour]` target is not present in the current view are
 * skipped at runtime, so the same tour adapts to the landing page, the
 * course catalog, the syllabus modal, the reference guide, and the lesson
 * view — and survives navigation between them.
 */
export const TOUR_STEPS: readonly GuidedTourStep[] = [
  {
    id: 'nav',
    target: 'nav',
    title: 'Find your way around',
    description:
      'The navbar is always within reach. Jump back to the landing experience or head straight to your courses.',
    placement: 'bottom',
    interaction: 'next',
  },
  {
    id: 'nav-courses',
    target: 'nav-courses',
    title: 'Explore courses',
    description:
      "Let's start by exploring the courses available in Ecosystem. Click Courses to continue.",
    placement: 'bottom',
    interaction: 'click',
  },
  {
    id: 'theme',
    target: 'theme',
    title: 'Light or dark',
    description:
      'Switch between light and dark mode. Go ahead — click it to feel the difference. Your choice is remembered.',
    placement: 'bottom',
    interaction: 'click',
  },
  {
    id: 'courses-introduction',
    target: 'courses-introduction',
    title: 'Explore your courses',
    description:
      'Browse structured learning paths and choose what you want to learn next — from first principles to advanced systems.',
    placement: 'bottom',
    interaction: 'next',
  },
  {
    id: 'courses',
    target: 'courses',
    title: 'Pick your path',
    description:
      'Each card is a complete learning path with lessons, practice, and AI tutor support baked in.',
    placement: 'bottom',
    interaction: 'next',
  },
  {
    id: 'dynamic-course',
    target: 'dynamic-course',
    title: 'Stay current',
    description:
      'Courses marked Dynamic track the ecosystem as it changes — new tools, replacements, and deprecations — instead of freezing in time.',
    placement: 'left',
    interaction: 'next',
  },
  {
    id: 'course-progress',
    target: 'course-progress',
    title: 'Track your progress',
    description:
      'Your completed lessons show up here as a percentage. Pick up any course exactly where you left it.',
    placement: 'top',
    interaction: 'next',
  },
  {
    id: 'view-syllabus',
    target: 'view-syllabus',
    title: 'Preview the syllabus',
    description:
      'Before you commit, look inside: outcomes, prerequisites, and every module. Click View Syllabus to open it.',
    placement: 'top',
    interaction: 'click',
  },
  {
    id: 'syllabus-start',
    target: 'syllabus-start',
    title: 'Start learning',
    description:
      'This is the full syllabus. When you are ready, click Start Learning Now to enter the course for real.',
    placement: 'left',
    interaction: 'click',
  },
  {
    id: 'course-card',
    target: 'course-card',
    title: 'Or jump straight in',
    description:
      'Changed your mind about the syllabus? Click here to open the lesson view directly — it resumes where you left off.',
    placement: 'top',
    interaction: 'click',
  },
  {
    id: 'modules',
    target: 'modules',
    title: 'Course modules',
    description:
      'This button opens the course roadmap: every module, lesson, and practice set in order. Use it to jump anywhere, anytime.',
    placement: 'right',
    interaction: 'next',
  },
  {
    id: 'lesson-item',
    target: 'lesson-item',
    title: 'You are here',
    description:
      'The roadmap marks your current lesson. Pick any lesson to open it — your progress is saved as you go.',
    placement: 'right',
    interaction: 'next',
  },
  {
    id: 'code-editor',
    target: 'code-editor',
    title: 'Write real code',
    description:
      'Here is where you write and modify the code. The tutor sees what you write and helps you debug it.',
    placement: 'left',
    interaction: 'next',
  },
  {
    id: 'run-code',
    target: 'run-code',
    title: 'Run your code',
    description:
      'Execute what you wrote and see the result in the console below. Click Run Code to try it right now.',
    placement: 'left',
    interaction: 'click',
  },
  {
    id: 'reset-code',
    target: 'reset-code',
    title: 'Start over safely',
    description:
      'Made a mess? Reset restores the lesson’s starter code so you can try again from a clean slate.',
    placement: 'top',
    interaction: 'next',
  },
  {
    id: 'exercises',
    target: 'exercises',
    title: 'Prove it with exercises',
    description:
      'Graded checks live under the Exercises tab. Click it to see how your solution is tested.',
    placement: 'left',
    interaction: 'click',
  },
  {
    id: 'ai-tutor',
    target: 'ai-tutor',
    title: 'Ask your AI tutor',
    description:
      'This tab is your tutor’s home: conversation, voice, and visual explanations. Click it to open the tutor panel.',
    placement: 'right',
    interaction: 'click',
  },
  {
    id: 'voice-tutor',
    target: 'voice-tutor',
    title: 'Talk out loud',
    description:
      'Tap the orb whenever you are ready to speak. The tutor hears you, explains the lesson, and can write and highlight code as it teaches.',
    placement: 'right',
    interaction: 'next',
  },
  {
    id: 'notes',
    target: 'notes',
    title: 'Keep your notes',
    description:
      'Save important ideas per lesson — they persist across visits when you are signed in. Click Notes to open your notebook.',
    placement: 'right',
    interaction: 'click',
  },
  {
    id: 'visual-teaching',
    target: 'visual-teaching',
    title: 'See it visually',
    description:
      'When the tutor draws a diagram, flip between Code and Visual here to step through the data flow. Click Visual to see the teaching canvas.',
    placement: 'left',
    interaction: 'click',
  },
  {
    id: 'reference-guide',
    target: 'reference-guide',
    title: 'Reference guide',
    description:
      'Every concept from the course, searchable in one place. Perfect when you need a quick refresher mid-lesson.',
    placement: 'bottom',
    interaction: 'next',
  },
  {
    id: 'reference-search',
    target: 'reference-search',
    title: 'Search any concept',
    description:
      'Type a topic, lesson, or module to instantly find every explanation of it across the whole course.',
    placement: 'bottom',
    interaction: 'next',
  },
  {
    id: 'complete-lesson',
    target: 'complete-lesson',
    title: 'Complete the lesson',
    description:
      'When you finish a lesson for real, mark it complete here to bank your progress and unlock what is next.',
    placement: 'top',
    interaction: 'next',
  },
];
