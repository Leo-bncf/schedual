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
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <HeroSection />
      <InfoSection />
      <MissionSection />
      <HowItWorksSection />
      <PricingSection />
      <LandingFooter />
    </div>
  );
}