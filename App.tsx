
import React, { Suspense, useState, useCallback, useRef } from 'react';
import LandingPage from './components/CourseSelection';
import LearningView from './components/LearningView';
import { DEFAULT_COURSE_ID, getCourseById } from './constants';
import CoursesPage from './pages/CoursesPage';
import ExplanationsPage from './pages/ExplanationsPage';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { GuidedTourProvider } from './components/guided-tour/GuidedTourContext';
import GuidedTour from './components/guided-tour/GuidedTour';
import GuidedTourPrompt from './components/guided-tour/GuidedTourPrompt';

export type View = 'landing' | 'courses' | 'lesson' | 'explanations';

/** Navigate to a view, optionally switching the active course first. */
export type NavigateFn = (view: View, courseId?: string) => void;

const MainApp: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('landing');
  const [activeCourseId, setActiveCourseId] = useState<string>(DEFAULT_COURSE_ID);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const activeCourse = getCourseById(activeCourseId);

  // Plain view switch: no transition, no overlay.
  const navigateTo = useCallback<NavigateFn>((view, courseId) => {
    const targetCourseId = courseId ?? activeCourseId;
    if (courseId) {
      setActiveCourseId(courseId);
    }
    setCurrentView(view);
    window.scrollTo(0, 0);
  }, [activeCourseId]);

  const renderContent = () => {
    switch (currentView) {
      case 'landing':
        return <LandingPage navigateTo={navigateTo} />;
      case 'courses':
        return <CoursesPage navigateTo={navigateTo} activeCourseId={activeCourseId} />;
      case 'lesson':
        return <LearningView course={activeCourse} navigateTo={navigateTo} />;
      case 'explanations':
        return <ExplanationsPage navigateTo={navigateTo} />;
      default:
        return <LandingPage navigateTo={navigateTo} />;
    }
  };

  // Views that don't need standard Nav/Footer
  if (currentView === 'lesson') {
    return <div ref={contentRef}>{renderContent()}</div>;
  }

  return (
    <div ref={contentRef}>
      <Navbar navigateTo={navigateTo} currentView={currentView} />
      <main>{renderContent()}</main>
      <Footer />
    </div>
  );
};

// Debug-only laptop rig lab. Gated on a query flag so the default app is untouched.
const showLaptopLab =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('laptop-debug') === '1';
const LaptopLab = React.lazy(() => import('./components/cinematic-hero/laptop-lab/LaptopLab'));

const App: React.FC = () => {
    return (
        <ThemeProvider>
            <AuthProvider>
                <GuidedTourProvider>
                    <MainApp />
                    <GuidedTour />
                    <GuidedTourPrompt />
                    {showLaptopLab ? (
                    <Suspense fallback={null}>
                        <LaptopLab />
                    </Suspense>
                ) : null}
                </GuidedTourProvider>
            </AuthProvider>
        </ThemeProvider>
    );
};

export default App;
