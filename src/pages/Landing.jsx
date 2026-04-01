import React from 'react';
import LandingHeader from '../components/landing/LandingHeader';
import HeroSection from '../components/landing/HeroSection';
import SchedulerShowcaseSection from '../components/landing/SchedulerShowcaseSection';
import TrustSection from '../components/landing/TrustSection';
import DemoBooking from '../components/landing/DemoBooking';
import MissionSection from '../components/landing/MissionSection';
import InfoSection from '../components/landing/InfoSection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import ComparisonSection from '../components/landing/ComparisonSection';
import PricingTiersSection from '../components/landing/PricingTiersSection';
import LandingFooter from '../components/landing/LandingFooter';
import TermsAcceptanceDialog from '../components/landing/TermsAcceptanceDialog';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <TermsAcceptanceDialog />
      <LandingHeader />
      <HeroSection />
      <SchedulerShowcaseSection />
      <InfoSection />
      <HowItWorksSection />
      <TrustSection />
      <DemoBooking />
      <MissionSection />
      <ComparisonSection />
      <PricingTiersSection />
      <LandingFooter />
    </div>
  );
}