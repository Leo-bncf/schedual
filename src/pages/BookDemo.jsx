import React from 'react';
import LandingHeader from '../components/landing/LandingHeader';
import LandingFooter from '../components/landing/LandingFooter';
import DemoBooking from '../components/landing/DemoBooking';

export default function BookDemo() {
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <main className="pt-36 pb-20">
        <section className="max-w-4xl mx-auto px-6 text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-900 mb-4">Book a demo</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mb-6">See how Schedual could work for your school.</h1>
          <p className="text-lg text-slate-600 leading-8 max-w-2xl mx-auto">
            Book a demo to walk through the platform, ask questions, and see how setup, scheduling, and school operations fit together.
          </p>
        </section>
        <div className="max-w-6xl mx-auto px-6">
          <DemoBooking />
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}