import React from 'react';
import { View } from '../App';
import { CinematicHero } from './cinematic-hero';
import { PostCinematicJourney } from './cinematic-hero/PostCinematicJourney';
import { ScrollStory } from './scroll-story/ScrollStory';

interface LandingPageProps {
    navigateTo: (view: View) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ navigateTo }) => {
    return (
        <div className="min-h-screen bg-background relative overflow-x-clip">
            <CinematicHero navigateTo={navigateTo} />
            <PostCinematicJourney />
            <ScrollStory navigateTo={navigateTo} />
        </div >
    );
};

export default LandingPage;
