import React, { useState } from 'react';
import { View } from '../App';
import { CLOUD_BIG_DATA_COURSE } from '../constants';

interface ExplanationsPageProps {
  navigateTo: (view: View) => void;
}

const ExplanationsPage: React.FC<ExplanationsPageProps> = ({ navigateTo }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const allExplanations = CLOUD_BIG_DATA_COURSE.modules.flatMap(module => 
    module.lessons.flatMap(lesson => 
        lesson.content.explanations.map((text, index) => ({
            id: `${lesson.id}-expl-${index}`,
            moduleTitle: module.title,
            lessonTitle: lesson.title,
            text: text
        }))
    )
  );

  const filteredExplanations = allExplanations.filter(item => 
      item.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.lessonTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.moduleTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pt-24 pb-12 px-4 min-h-screen bg-[#0D0D0D]">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
            <button 
                onClick={() => navigateTo('lesson')} 
                className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 mb-4"
            >
                <i className="fas fa-arrow-left"></i> Back to Lesson
            </button>
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
                Course <span className="text-brand-green">Explanations</span>
            </h1>
            <p className="text-gray-400 text-lg">
                A complete glossary of all concepts covered in the {CLOUD_BIG_DATA_COURSE.title} course.
            </p>
        </header>

        <div className="mb-8 relative">
            <i className="fas fa-search absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <input 
                type="text"
                placeholder="Search for a topic or concept..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#181818] border border-[#262626] rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-brand-green transition-colors"
            />
        </div>
        
        <div className="space-y-6">
            {filteredExplanations.length > 0 ? (
                filteredExplanations.map((item) => (
                    <div key={item.id} className="dark-card rounded-xl p-6 hover:border-gray-700 transition-colors">
                        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-3">
                            <span className="text-brand-green text-sm font-semibold px-2 py-1 bg-[#B9FF66]/10 rounded-md w-fit">
                                {item.lessonTitle}
                            </span>
                            <span className="text-gray-500 text-xs hidden md:inline">•</span>
                            <span className="text-gray-500 text-xs">
                                {item.moduleTitle}
                            </span>
                        </div>
                        <p className="text-gray-200 leading-relaxed text-lg">
                            {item.text}
                        </p>
                    </div>
                ))
            ) : (
                <div className="text-center py-12 text-gray-500">
                    <i className="fas fa-search text-4xl mb-4 opacity-50"></i>
                    <p className="text-xl">No explanations found for "{searchTerm}"</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ExplanationsPage;