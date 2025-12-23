import React from 'react';
import { Heart, Lightbulb } from 'lucide-react';

export default function MissionSection() {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/30 to-transparent" />
      
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-purple-800/30 mb-8">
          <Heart className="w-4 h-4 text-rose-400" />
          <span className="text-sm font-medium text-purple-200">Made for IB Schools</span>
          <Lightbulb className="w-4 h-4 text-amber-400" />
        </div>

        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
          Our Mission
        </h2>
        <p className="text-xl text-purple-200 leading-relaxed">
          Born from witnessing the overwhelming manual work required to create IB Diploma Programme schedules, 
          we built this platform to automate the tedious and error-prone process. Our goal is to give IB 
          coordinators their time back, allowing them to focus on what truly matters: supporting students 
          and teachers.
        </p>
      </div>
    </section>
  );
}