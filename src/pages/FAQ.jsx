import React from 'react';
import FAQSection from '../components/landing/FAQSection';
import LandingHeader from '../components/landing/LandingHeader';
import LandingFooter from '../components/landing/LandingFooter';

export default function FAQ() {
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <FAQSection />
      <LandingFooter />
    </div>
  );
}