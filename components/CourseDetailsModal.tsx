import React, { useState, useEffect } from 'react';
import { Course } from '../types';

interface CourseDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    course: Course;
    onStartCourse: () => void;
}

const CourseDetailsModal: React.FC<CourseDetailsModalProps> = ({ isOpen, onClose, course, onStartCourse }) => {
    const [activeModule, setActiveModule] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300); // Wait for animation
            document.body.style.overflow = 'unset';
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isOpen && !isVisible) return null;

    return (
        <div className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            ></div>

            {/* Slide-over Panel */}
            <div
                className={`
            relative w-full max-w-2xl bg-[#0D0D0D] h-full shadow-2xl border-l border-white/10 overflow-hidden flex flex-col transform transition-transform duration-300 ease-out
            ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
            >
                {/* Decorative Background */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-600/5 blur-[100px] rounded-full pointer-events-none"></div>

                {/* Header */}
                <div className="p-8 border-b border-white/5 relative z-10 flex-shrink-0 bg-zinc-900/50 backdrop-blur-md">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
                    >
                        <i className="fas fa-times text-xl"></i>
                    </button>

                    <div className="flex items-center gap-2 mb-4">
                        <span className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider">
                            {course.level || "Course"}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                            <i className="fas fa-clock"></i> {course.totalDuration || "Self-Paced"}
                        </span>
                    </div>

                    <h2 className="text-4xl font-bold font-manrope mb-4 text-white">{course.title}</h2>
                    <p className="text-zinc-400 leading-relaxed text-sm max-w-lg">{course.description}</p>

                    <button
                        data-tour="syllabus-start"
                        onClick={onStartCourse}
                        className="mt-6 w-full py-4 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transform hover:scale-[1.01] transition-all flex items-center justify-center group"
                    >
                        Start Learning Now
                        <i className="fas fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-grow overflow-y-auto p-8 custom-scrollbar relative z-10">
                    {/* Outcomes Section */}
                    {course.outcomes && (
                        <div className="mb-10">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <i className="fas fa-bullseye text-orange-500"></i> What You'll Learn
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                {course.outcomes.map((outcome, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-900/50 border border-white/5">
                                        <i className="fas fa-check-circle text-brand-green mt-1 flex-shrink-0"></i>
                                        <span className="text-sm text-zinc-300 leading-snug">{outcome}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Prerequisites */}
                    {course.prerequisites && (
                        <div className="mb-10">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <i className="fas fa-list-ul text-blue-400"></i> Prerequisites
                            </h3>
                            <ul className="list-disc list-inside space-y-2 text-sm text-zinc-400 ml-2">
                                {course.prerequisites.map((req, idx) => (
                                    <li key={idx}>{req}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Syllabus */}
                    <div>
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <i className="fas fa-book-open text-purple-400"></i> Course Syllabus
                        </h3>

                        <div className="space-y-4">
                            {course.modules.map((module, index) => {
                                const isActive = activeModule === module.id;
                                return (
                                    <div key={module.id} className="border border-white/5 rounded-xl overflow-hidden bg-zinc-900/30 transition-all">
                                        <button
                                            onClick={() => setActiveModule(isActive ? null : module.id)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                                                    {index + 1}
                                                </div>
                                                <span className={`font-semibold ${isActive ? 'text-white' : 'text-zinc-300'}`}>
                                                    {module.title}
                                                </span>
                                            </div>
                                            <i className={`fas fa-chevron-down text-zinc-500 transition-transform duration-300 ${isActive ? 'rotate-180' : ''}`}></i>
                                        </button>

                                        <div className={`overflow-hidden transition-[max-height] duration-500 ease-in-out ${isActive ? 'max-h-[500px]' : 'max-h-0'}`}>
                                            <div className="p-4 pt-0 border-t border-white/5 bg-black/20">
                                                <ul className="space-y-3 mt-3">
                                                    {module.lessons.map(lesson => (
                                                        <li key={lesson.id} className="flex items-center justify-between text-sm group cursor-default">
                                                            <div className="flex items-center gap-3 text-zinc-400 group-hover:text-zinc-200 transition-colors">
                                                                <i className="fas fa-play-circle text-xs opacity-50"></i>
                                                                <span>{lesson.title}</span>
                                                            </div>
                                                            <span className="text-xs text-zinc-600 font-mono">
                                                                {lesson.timeEstimateMin} min
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CourseDetailsModal;
