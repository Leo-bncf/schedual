import React from 'react';
import LandingHeader from '../components/landing/LandingHeader';
import HeroSection from '../components/landing/HeroSection';
import DashboardPreview from '../components/landing/DashboardPreview';
import TrustSection from '../components/landing/TrustSection';
import DemoBooking from '../components/landing/DemoBooking';
import MissionSection from '../components/landing/MissionSection';
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
      <TrustSection />
      <DemoBooking />
      <MissionSection />
      <ComparisonSection />
      <PricingSection />
      <LandingFooter />
    </div>
  );
}