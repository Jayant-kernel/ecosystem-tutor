
import React from 'react';

interface LearningFooterProps {
    onComplete: () => void;
    isCompleting?: boolean;
}

const LearningFooter: React.FC<LearningFooterProps> = ({ onComplete, isCompleting = false }) => {
    return (
        <footer className="h-auto md:h-20 p-4 border-t border-white/5 bg-zinc-900/40 backdrop-blur-md flex-shrink-0 flex items-center justify-end z-20">
            <button
                data-tour="complete-lesson"
                onClick={onComplete}
                disabled={isCompleting}
                className={`
                    px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-orange-600 to-orange-500 text-white 
                    shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transform hover:scale-[1.02] active:scale-[0.98] 
                    transition-all flex items-center whitespace-nowrap gap-2
                    ${isCompleting ? 'opacity-70 cursor-not-allowed grayscale' : ''}
                `}
            >
                {isCompleting ? (
                    <><i className="fas fa-spinner fa-spin"></i> Saving Progress...</>
                ) : (
                    <>Complete Lesson <i className="fas fa-arrow-right ml-1"></i></>
                )}
            </button>
        </footer>
    );
};

export default LearningFooter;
