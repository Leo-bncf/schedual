import React from 'react';
import LandingHeader from '../components/landing/LandingHeader';
import HeroSection from '../components/landing/HeroSection';
import DashboardPreview from '../components/landing/DashboardPreview';
import MissionSection from '../components/landing/MissionSection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import ComparisonSection from '../components/landing/ComparisonSection';
import PricingSection from '../components/landing/PricingSection';
import LandingFooter from '../components/landing/LandingFooter';
import TermsAcceptanceDialog from '../components/landing/TermsAcceptanceDialog';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <TermsAcceptanceDialog />
      <LandingHeader />
      <HeroSection />
      <DashboardPreview />
      <MissionSection />
      <HowItWorksSection />
      <ComparisonSection />
      <PricingSection />
      <LandingFooter />
    </div>
  );
}