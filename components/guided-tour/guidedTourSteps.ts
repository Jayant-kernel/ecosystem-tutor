import type { GuidedTourStep } from './guidedTourTypes';

/**
 * Canonical step catalog. Steps whose `[data-tour]` target is not present in
 * the current view are skipped at runtime, so the same tour adapts to the
 * landing page, the course catalog, and the lesson view.
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
    id: 'courses',
    target: 'courses',
    title: 'Pick your path',
    description:
      'Each card is a complete learning path with lessons, practice, and AI tutor support baked in.',
    placement: 'top',
  },
  {
    id: 'course-card',
    target: 'course-card',
    title: 'Start learning',
    description:
      'One click opens the lesson view. If you have progress, this button becomes Continue Learning right where you left off.',
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
    id: 'voice-tutor',
    target: 'voice-tutor',
    title: 'Talk to your AI tutor',
    description:
      'Tap the orb and ask out loud. The tutor hears you, explains the lesson, and can even write and highlight code as it teaches.',
    placement: 'left',
  },
  {
    id: 'code-editor',
    target: 'code-editor',
    title: 'Write real code',
    description:
      'This is your workspace. Edit, run, and test your code here — the tutor sees what you write and helps you debug it.',
    placement: 'right',
  },
  {
    id: 'reference-guide',
    target: 'reference-guide',
    title: 'Reference guide',
    description:
      'Every concept from the course, searchable in one place. Perfect when you need a quick refresher mid-lesson.',
    placement: 'bottom',
  },
];
