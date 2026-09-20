import React from 'react';
import { Course } from '../types';

interface RoadmapSidebarProps {
  course: Course;
  completedLessons: string[];
  currentLessonId: string;
  onBack: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onLessonClick: (lessonId: string) => void;
  /** Opens the end-of-module practice for that module. */
  onPracticeClick: (moduleId: string) => void;
  /** Module whose practice is currently open, if any. */
  practiceModuleId: string | null;
}

const RoadmapSidebar: React.FC<RoadmapSidebarProps> = ({ course, completedLessons, currentLessonId, onBack, isOpen, setIsOpen, onLessonClick, onPracticeClick, practiceModuleId }) => {
  let globalLessonIndex = 0;

  return (
    <aside className={`fixed inset-y-0 left-0 w-4/5 max-w-xs md:w-80 bg-black/60 backdrop-blur-xl border-r border-white/5 flex flex-col z-40 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <header className="p-6 border-b border-white/5 flex items-center justify-between flex-shrink-0 h-16 bg-white/5">
        <button onClick={onBack} className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 font-bold text-xs uppercase tracking-wider group">
          <i className="fas fa-arrow-left transition-transform group-hover:-translate-x-1"></i> Courses
        </button>
        {/* Mobile close button */}
        <button onClick={() => setIsOpen(false)} className="md:hidden text-zinc-500 p-2 hover:text-white transition-colors">
          <i className="fas fa-times"></i>
        </button>
      </header>

      <div className="overflow-y-auto flex-grow custom-scrollbar p-6">
        <h2 className="text-xl font-bold mb-8 text-white font-manrope">{course.title}</h2>
        {course.modules.map((module) => (
          <div key={module.id} className="mb-8 last:mb-0">
            <h3 className="font-bold text-orange-500 mb-4 uppercase text-[10px] tracking-[0.2em] px-2 opacity-90">{module.title}</h3>
            <ul className="space-y-1 relative">
              {module.lessons.map((lesson, lessonIndex) => {
                globalLessonIndex++;
                const displayIndex = globalLessonIndex;
                const isCompleted = completedLessons.includes(lesson.id);
                const isCurrent = lesson.id === currentLessonId;
                const isLastInModule = lessonIndex === module.lessons.length - 1;

                return (
                  <li key={lesson.id} className="relative group/item">
                    {/* Connector Line */}
                    {!isLastInModule && (
                      <div className="absolute left-[23px] top-8 bottom-[-4px] w-px bg-white/5 -z-10 group-hover/item:bg-white/10 transition-colors"></div>
                    )}

                    <button
                      data-tour={isCurrent ? 'lesson-item' : undefined}
                      onClick={() => onLessonClick(lesson.id)}
                      className={`w-full flex items-center p-2 rounded-xl transition-all cursor-pointer text-left relative z-10 border border-transparent ${isCurrent ? 'bg-orange-500/10 border-orange-500/20' : 'hover:bg-white/5 hover:border-white/5'}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-[2px] mr-3 flex-shrink-0 transition-all font-bold shadow-lg
                            ${isCompleted ? 'bg-orange-500 border-orange-500 text-white shadow-orange-500/20' : isCurrent ? 'bg-[#0D0D0D] border-orange-500 text-orange-500 shadow-orange-500/20' : 'border-white/10 bg-[#0D0D0D] text-zinc-600 group-hover/item:border-white/30 group-hover/item:text-zinc-400'}`}>
                        {isCompleted ? <i className="fas fa-check text-xs"></i> : <span className="text-xs">{displayIndex}</span>}
                      </div>
                      <span className={`text-sm font-medium leading-tight ${isCurrent ? 'text-white' : 'text-zinc-500 group-hover/item:text-zinc-300'}`}>{lesson.title}</span>
                    </button>
                  </li>
                );
              })}

              {module.practice && (
                <li className="relative group/item">
                  {module.lessons.length > 0 && (
                    <div className="absolute left-[23px] top-0 h-4 w-px bg-white/5 -z-10"></div>
                  )}
                  <button
                    onClick={() => onPracticeClick(module.id)}
                    className={`w-full flex items-center p-2 rounded-xl transition-all cursor-pointer text-left relative z-10 border ${
                      practiceModuleId === module.id
                        ? 'bg-purple-500/10 border-purple-500/30'
                        : 'border-dashed border-white/10 hover:bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-[2px] mr-3 flex-shrink-0 transition-all font-bold shadow-lg ${
                        practiceModuleId === module.id
                          ? 'bg-[#0D0D0D] border-purple-500 text-purple-400 shadow-purple-500/20'
                          : 'border-white/10 bg-[#0D0D0D] text-zinc-600 group-hover/item:border-purple-500/40 group-hover/item:text-purple-400'
                      }`}
                    >
                      <i className="fas fa-dumbbell text-[10px]"></i>
                    </div>
                    <span className={`text-sm font-medium leading-tight ${practiceModuleId === module.id ? 'text-white' : 'text-zinc-500 group-hover/item:text-zinc-300'}`}>
                      Practice: {module.practice.mcqs.length + module.practice.coding.length} questions
                    </span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
};

// Memoized so it does not re-render while the AI tutor streams a response.
export default React.memo(RoadmapSidebar);
