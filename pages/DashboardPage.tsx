import React, { useState } from 'react';
import { NavigateFn } from '../App';
import { Course } from '../types';
import { useCourseProgress } from '../hooks/useCourseProgress';
import CourseDetailsModal from '../components/CourseDetailsModal';

interface DashboardPageProps {
  navigateTo: NavigateFn;
  activeCourse: Course;
}

const COURSE_ICONS: Record<string, string> = {
  'cloud-big-data-engineering': 'fas fa-cloud text-sky-400'
};

const DashboardPage: React.FC<DashboardPageProps> = ({ navigateTo, activeCourse }) => {
  const { progress } = useCourseProgress(activeCourse.id);
  const [showDetails, setShowDetails] = useState(false);

  const totalLessons = activeCourse.modules.reduce((acc, module) => acc + module.lessons.length, 0);
  const completedLessonsCount = progress.completedLessons.length;
  const progressPercentage = totalLessons > 0 ? (completedLessonsCount / totalLessons) * 100 : 0;

  return (
    <div className="pt-24 md:pt-28 pb-12 px-6 min-h-screen bg-[#0D0D0D] text-white font-sans selection:bg-orange-500/30 selection:text-orange-200">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Enhanced Course Card */}
        <div className="group relative bg-zinc-900/40 border border-white/5 rounded-[2.5rem] p-8 hover:bg-zinc-900/60 transition-all duration-500 overflow-hidden backdrop-blur-sm">
          {/* Background Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[100px] rounded-full group-hover:bg-orange-500/10 transition-all"></div>

          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
            {/* Icon/Thumbnail */}
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-zinc-800/80 border border-white/5 flex items-center justify-center flex-shrink-0 shadow-xl group-hover:scale-105 transition-transform duration-500">
              <i className={`${COURSE_ICONS[activeCourse.id] ?? 'fas fa-graduation-cap text-orange-400'} text-5xl`}></i>
            </div>

            {/* Content */}
            <div className="flex-grow w-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-2xl font-bold text-white font-manrope">{activeCourse.title}</h3>
                    <span className="bg-zinc-800 border border-white/10 text-xs font-bold px-2 py-0.5 rounded text-gray-400 uppercase">{activeCourse.level || 'Course'}</span>
                  </div>
                  <p className="text-zinc-500 text-sm">{activeCourse.description}</p>
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-3xl font-bold text-white font-manrope">{Math.round(progressPercentage)}%</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide">Complete</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-zinc-800 rounded-full h-2 mb-6 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-orange-600 to-orange-400 h-full rounded-full transition-all duration-1000 ease-out relative"
                  style={{ width: `${Math.max(progressPercentage, 5)}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-4">
                <button onClick={() => navigateTo('lesson', activeCourse.id)} className="bg-white text-black hover:bg-orange-500 hover:text-white transition-colors px-6 py-3 rounded-xl font-bold text-sm tracking-wide flex items-center gap-2 group/btn">
                  {progressPercentage > 0 ? 'Continue Lesson' : 'Start Course'}
                  <i className="fas fa-arrow-right transform group-hover/btn:translate-x-1 transition-transform"></i>
                </button>
                <button
                  onClick={() => setShowDetails(true)}
                  className="px-4 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white transition-colors text-sm font-bold"
                >
                  <i className="fas fa-list-ul mr-2"></i> Details
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      <CourseDetailsModal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        course={activeCourse}
        onStartCourse={() => {
          setShowDetails(false);
          navigateTo('lesson', activeCourse.id);
        }}
      />
    </div>
  );
};

export default DashboardPage;
