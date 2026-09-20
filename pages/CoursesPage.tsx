import React, { useState } from 'react';
import { NavigateFn } from '../App';
import { COURSES } from '../constants';
import CourseDetailsModal from '../components/CourseDetailsModal';
import { Course } from '../types';
import { useCourseProgress } from '../hooks/useCourseProgress';

interface CoursesPageProps {
  navigateTo: NavigateFn;
  activeCourseId: string;
}

interface CoursePresentation {
  icon: string;
  iconColor: string;
  bgColor: string;
  gradient: string;
}

const COURSE_PRESENTATION: Record<string, CoursePresentation> = {
  'cloud-big-data-engineering': {
    icon: 'AWS',
    iconColor: 'text-sky-400',
    bgColor: 'bg-sky-400/10',
    gradient: 'from-sky-600 to-cyan-400'
  }
};

const DEFAULT_PRESENTATION: CoursePresentation = {
  icon: 'CO',
  iconColor: 'text-zinc-300',
  bgColor: 'bg-zinc-400/10',
  gradient: 'from-zinc-600 to-zinc-400'
};

const ActiveCourseProgress: React.FC<{ course: Course }> = ({ course }) => {
  const { progress } = useCourseProgress(course.id);
  const totalLessons = course.modules.reduce((total, module) => total + module.lessons.length, 0);
  const percentage = totalLessons ? Math.round((progress.completedLessons.length / totalLessons) * 100) : 0;

  return (
    <div className="mt-5 space-y-2">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
        <span>Course progress</span><span className="text-orange-300">{percentage}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-700" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};

const CoursesPage: React.FC<CoursesPageProps> = ({ navigateTo, activeCourseId }) => {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  // All listed courses are active enrollable courses; each renders a full card.
  const allCourses = COURSES.map((course) => ({
    ...course,
    ...(COURSE_PRESENTATION[course.id] ?? DEFAULT_PRESENTATION),
    isActive: true
  }));


  return (
    <div className="pt-24 pb-12 px-4 min-h-screen bg-[#0D0D0D] text-white selection:bg-orange-500/30 selection:text-orange-200">
      <div className="max-w-7xl mx-auto relative">
        {/* Background Ambient Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-orange-600/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>

        <header className="text-center mb-20 relative">
          <span className="inline-block px-4 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-bold uppercase tracking-wider mb-6 animate-fade-in-up">
            Level Up Your Skills
          </span>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 font-manrope tracking-tight leading-none animate-fade-in-up delay-100">
            Expand Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">Potential</span>
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed animate-fade-in-up delay-200">
            Choose a path and let our AI-powered platform guide you from your first line of code to building complex applications.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {allCourses.map((course, index) => (
            <div
              key={course.id}
              className={`group relative perspective-1000 ${!course.isActive ? 'opacity-80' : ''}`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`
                    h-full bg-zinc-900/40 border border-white/5 rounded-[2rem] p-8 flex flex-col transition-all duration-500 
                    ${course.isActive ? 'hover:-translate-y-2 hover:bg-zinc-900/60 hover:shadow-2xl hover:shadow-orange-500/10 hover:border-orange-500/20' : ''}
                    backdrop-blur-sm relative overflow-hidden
                `}>
                {/* Decorative Gradient Blob */}
                <div className={`absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br ${course.gradient} opacity-5 blur-[80px] group-hover:opacity-10 transition-opacity duration-500 rounded-full`}></div>

                <div className="flex-grow mb-8 relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${course.bgColor} ${course.iconColor} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      {course.icon}
                    </div>
                    {course.isActive ? (
                      <span className="px-3 py-1 rounded-full bg-zinc-800 border border-white/5 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        {course.level}
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-zinc-800 border border-white/5 text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                        <i className="fas fa-hammer"></i> Building
                      </span>
                    )}
                  </div>

                  <h3 className="text-2xl font-bold font-manrope mb-3 group-hover:text-white transition-colors">{course.title}</h3>
                  <p className="text-zinc-400 leading-relaxed text-sm mb-6 line-clamp-3">{course.description}</p>

                  <div className="flex items-center gap-4 text-xs font-medium text-zinc-500">
                    <span className="flex items-center gap-1.5"><i className="fas fa-clock"></i> {course.totalDuration}</span>
                    <span className="flex items-center gap-1.5"><i className="fas fa-video"></i> AI Tutor Support</span>
                  </div>
                  {course.isActive && course.id === activeCourseId && <ActiveCourseProgress course={course} />}
                </div>

                {course.isActive ? (
                  <div className="space-y-3 relative z-10">
                    <button
                      onClick={() => navigateTo('lesson', course.id)}
                      className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg hover:shadow-orange-500/25 transform hover:scale-[1.02] transition-all flex items-center justify-center group/btn"
                    >
                      {activeCourseId === course.id ? 'Continue Learning' : 'Start Learning Now'}
                      <i className="fas fa-arrow-right ml-2 group-hover/btn:translate-x-1 transition-transform"></i>
                    </button>
                    <button
                      onClick={() => setSelectedCourse(course)}
                      className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-zinc-800 text-zinc-300 border border-white/10 hover:bg-zinc-700 hover:text-white transition-all flex items-center justify-center"
                    >
                      <i className="fas fa-info-circle mr-2"></i> View Syllabus
                    </button>
                  </div>
                ) : (
                  <button disabled className="w-full py-4 rounded-xl font-bold text-sm tracking-wide bg-zinc-800 text-zinc-500 border border-white/5 cursor-not-allowed flex items-center justify-center relative z-10">
                    Join Waitlist
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Course Details Modal */}
      {selectedCourse && (
        <CourseDetailsModal
          isOpen={!!selectedCourse}
          onClose={() => setSelectedCourse(null)}
          course={selectedCourse}
          onStartCourse={() => navigateTo('lesson', selectedCourse.id)}
        />
      )}
    </div>
  );
};

export default CoursesPage;
