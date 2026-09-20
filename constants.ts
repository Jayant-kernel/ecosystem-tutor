
import { Course, Progress } from './types';
import { CLOUD_BIG_DATA_COURSE } from './cloudBigDataCurriculum';
import { DYNAMIC_CLOUD_COURSE } from './dynamicCourseCurriculum';

// Re-export both courses so the rest of the app can treat every course
// uniformly. The stable core course and its continuously-updated dynamic
// counterpart stay independent: separate IDs, separate progress.
export { CLOUD_BIG_DATA_COURSE, DYNAMIC_CLOUD_COURSE };

export const COURSES: Course[] = [CLOUD_BIG_DATA_COURSE, DYNAMIC_CLOUD_COURSE];

export const DEFAULT_COURSE_ID = CLOUD_BIG_DATA_COURSE.id;

export const getCourseById = (courseId: string | undefined): Course =>
  COURSES.find((course) => course.id === courseId) ?? CLOUD_BIG_DATA_COURSE;

/**
 * Courses that can be opened without signing in.
 * Every course is currently public so guests/judges can try the platform immediately.
 */
export const PUBLIC_COURSE_IDS: string[] = COURSES.map((course) => course.id);

export const isCoursePublic = (courseId: string | undefined): boolean =>
  !!courseId && PUBLIC_COURSE_IDS.includes(courseId);


export const getInitialProgress = (course: Course): Progress => ({
  completedLessons: [],
  // Default to the first lesson of the first module for THIS course
  currentLessonId: course.modules[0]?.lessons[0]?.id ?? '',
  aiMemory: ['User is a complete beginner.'],
});

export const INITIAL_PROGRESS: Progress = getInitialProgress(CLOUD_BIG_DATA_COURSE);
