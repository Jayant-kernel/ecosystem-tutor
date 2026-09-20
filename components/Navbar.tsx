import React from 'react';
import { View } from '../App';
import ThemeToggle from './ThemeToggle';
import GuidedTourTrigger from './guided-tour/GuidedTourTrigger';

interface NavbarProps {
    navigateTo: (view: View) => void;
    currentView: View;
}

const Navbar: React.FC<NavbarProps> = ({ navigateTo, currentView }) => {
    const handleNavigation = (view: View) => {
        navigateTo(view);
    };

    return (
        <div className="fixed flex w-full z-50 pt-6 pr-4 pl-4 top-0 left-0 justify-center">
            <nav
                data-tour="nav"
                className="shadow-black/50 flex md:gap-12 md:w-auto bg-black/60 w-full max-w-5xl rounded-full pt-2 pr-2 pb-2 pl-6 shadow-2xl backdrop-blur-xl gap-x-8 gap-y-8 items-center justify-between"
                style={{
                    position: 'relative',
                    '--border-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.2))',
                    '--border-radius-before': '9999px'
                } as React.CSSProperties}
            >
                <div className="flex items-center gap-2 shrink-0 cursor-pointer" onClick={() => handleNavigation('landing')}>
                    <span className="text-base font-medium tracking-tight text-white font-sans">Ecosystem</span>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    <span data-tour="theme" className="inline-flex shrink-0">
                        <ThemeToggle className="size-8 p-1" />
                    </span>
                    <GuidedTourTrigger />
                    <button data-tour="nav-courses" onClick={() => handleNavigation('courses')} className="group inline-flex overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(255,255,255,0.1)] rounded-full pt-[1px] pr-[1px] pb-[1px] pl-[1px] relative items-center justify-center">
                        <span className="absolute inset-[-100%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_75%,#ffffff_100%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"></span>
                        <span className="transition-opacity duration-300 group-hover:opacity-0 bg-zinc-800 rounded-full absolute top-0 right-0 bottom-0 left-0"></span>
                        <span className="flex items-center justify-center gap-2 uppercase transition-colors duration-300 group-hover:text-white text-xs font-medium text-zinc-400 tracking-widest bg-gradient-to-b from-zinc-800 to-zinc-950 w-full h-full rounded-full pt-2.5 pr-6 pb-2.5 pl-6 relative shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                            <span className="relative z-10">Courses</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 transition-transform duration-300 group-hover:translate-x-0.5">
                                <path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>
                            </svg>
                        </span>
                    </button>
                </div>
            </nav>
        </div>
    );
};

export default Navbar;
