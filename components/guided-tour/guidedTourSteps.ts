import type { GuidedTourStep } from './guidedTourTypes';

/**
 * Canonical site-wide step catalog, ordered as a progressive walkthrough:
 * global navigation → course discovery → course structure → lesson →
 * code → AI tutor → notes → visual teaching → reference → completion.
 *
 * Steps whose `[data-tour]` target is not present in the current view are
 * skipped at runtime, so the same tour adapts to the landing page, the
 * course catalog, the reference guide, and the lesson view.
 */
export const TOUR_STEPS: readonly GuidedTourStep[] = [
  {
    id: 'nav',
    target: 'nav',
    title: 'Find your way around',
    description:
      'The navbar is always within reach. Jump back to the landing experience or head straight to your courses.',
    placement: 'bottom',
  },
  {
    id: 'nav-courses',
    target: 'nav-courses',
    title: 'Browse courses',
    description:
      'This button takes you to the catalog, where every course lives with its syllabus, progress, and start button.',
    placement: 'bottom',
  },
  {
    id: 'theme',
    target: 'theme',
    title: 'Light or dark',
    description:
      'Switch between light and dark mode. Your choice is remembered for your next visit.',
    placement: 'bottom',
  },
  {
    id: 'courses-introduction',
    target: 'courses-introduction',
    title: 'Explore your courses',
    description:
      'Browse structured learning paths and choose what you want to learn next — from first principles to advanced systems.',
    placement: 'bottom',
  },
  {
    id: 'courses',
    target: 'courses',
    title: 'Pick your path',
    description:
      'Each card is a complete learning path with lessons, practice, and AI tutor support baked in.',
    placement: 'bottom',
  },
  {
    id: 'course-card',
    target: 'course-card',
    title: 'Start learning',
    description:
      'One click opens the lesson view. If you already have progress, this button becomes Continue Learning right where you left off.',
    placement: 'top',
  },
  {
    id: 'view-syllabus',
    target: 'view-syllabus',
    title: 'Preview the syllabus',
    description:
      'Open the full syllabus first — outcomes, prerequisites, and every module — so you know exactly what you are signing up for.',
    placement: 'top',
  },
  {
    id: 'dynamic-course',
    target: 'dynamic-course',
    title: 'Stay current',
    description:
      'Courses marked Dynamic track the ecosystem as it changes — new tools, replacements, and deprecations — instead of freezing in time.',
    placement: 'left',
  },
  {
    id: 'course-progress',
    target: 'course-progress',
    title: 'Track your progress',
    description:
      'Your completed lessons show up here as a percentage. Pick up any course exactly where you left it.',
    placement: 'top',
  },
  {
    id: 'modules',
    target: 'modules',
    title: 'Course modules',
    description:
      'This opens the course roadmap: every module, lesson, and practice set in order. Jump anywhere, anytime.',
    placement: 'right',
  },
  {
    id: 'ai-tutor',
    target: 'ai-tutor',
    title: 'Ask your AI tutor',
    description:
      'Switch to the AI Tutor tab to talk or type with your tutor. Ask questions, request hints, or ask for a diagram of anything.',
    placement: 'right',
  },
  {
    id: 'voice-tutor',
    target: 'voice-tutor',
    title: 'Talk out loud',
    description:
      'Tap the orb and speak. The tutor hears you, explains the lesson, and can write and highlight code as it teaches.',
    placement: 'right',
  },
  {
    id: 'code-editor',
    target: 'code-editor',
    title: 'Write real code',
    description:
      'This is your workspace. Edit, run, and test your code here — the tutor sees what you write and helps you debug it.',
    placement: 'left',
  },
  {
    id: 'run-code',
    target: 'run-code',
    title: 'Run your code',
    description:
      'Execute what you wrote and see the output in the console below. Fast feedback is how debugging clicks.',
    placement: 'left',
  },
  {
    id: 'reset-code',
    target: 'reset-code',
    title: 'Start over safely',
    description:
      'Made a mess? Reset restores the lesson’s starter code so you can try again from a clean slate.',
    placement: 'top',
  },
  {
    id: 'exercises',
    target: 'exercises',
    title: 'Prove it with exercises',
    description:
      'The Exercises tab holds graded checks for this lesson. Run the tests to prove your solution actually works.',
    placement: 'left',
  },
  {
    id: 'notes',
    target: 'notes',
    title: 'Keep your notes',
    description:
      'Save important ideas, explanations, and discoveries per lesson. Your notes persist across visits when you are signed in.',
    placement: 'right',
  },
  {
    id: 'visual-teaching',
    target: 'visual-teaching',
    title: 'See it visually',
    description:
      'When the tutor draws a diagram, switch between Code and Visual here to step through the data flow the tutor is explaining.',
    placement: 'left',
  },
  {
    id: 'reference-guide',
    target: 'reference-guide',
    title: 'Reference guide',
    description:
      'Every concept from the course, searchable in one place. Perfect when you need a quick refresher mid-lesson.',
    placement: 'bottom',
  },
  {
    id: 'reference-search',
    target: 'reference-search',
    title: 'Search any concept',
    description:
      'Type a topic, lesson, or module to instantly find every explanation of it across the whole course.',
    placement: 'bottom',
  },
  {
    id: 'complete-lesson',
    target: 'complete-lesson',
    title: 'Complete the lesson',
    description:
      'Finished? Mark the lesson complete to bank your progress and unlock the next step of your path.',
    placement: 'top',
  },
];
