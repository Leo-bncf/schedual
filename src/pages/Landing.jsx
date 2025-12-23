import React from 'react';
import LandingHeader from '../components/landing/LandingHeader';
import HeroSection from '../components/landing/HeroSection';
import InfoSection from '../components/landing/InfoSection';
import MissionSection from '../components/landing/MissionSection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import PricingSection from '../components/landing/PricingSection';
import LandingFooter from '../components/landing/LandingFooter';

export default function Landing() {
  return (
    <div className="min-h-screen relative">
      {/* Fixed background gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-blue-500 via-blue-400 to-white -z-10" />
      
      {/* Content */}
      <div className="relative z-0">
        <LandingHeader />
        <HeroSection />
        <InfoSection />
        <MissionSection />
        <HowItWorksSection />
        <PricingSection />
        <LandingFooter />
      </div>
    </div>
  );
}