import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Users, BookOpen } from 'lucide-react';

export default function HeroSection() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const windowHeight = window.innerHeight;
      const progress = Math.min(scrollPosition / (windowHeight * 1.5), 1);
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToInfo = () => {
    const element = document.getElementById('info');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative min-h-screen pt-48 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden bg-white">
      {/* Blue splat effect at top */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-br from-blue-500/50 via-indigo-500/40 to-purple-500/50 rounded-full blur-3xl"></div>

      <div className="max-w-5xl mx-auto relative z-10 text-center">
        <h1 className="text-6xl sm:text-7xl font-bold text-slate-900 leading-tight mb-8">
          The Future of IB Scheduling
        </h1>
        
        <p className="text-2xl text-slate-600 mb-12 leading-relaxed max-w-3xl mx-auto">
          Experience next generation schedule creation powered by AI. Generate perfect, conflict-free timetables for all IB programmes in minutes, not weeks.
        </p>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-20 max-w-4xl mx-auto">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-white/50">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <div className="font-bold text-slate-900 text-lg mb-2">AI-Powered</div>
            <div className="text-sm text-slate-600">Intelligent optimization in seconds</div>
          </div>
          
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-white/50">
            <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div className="font-bold text-slate-900 text-lg mb-2">Smart Constraints</div>
            <div className="text-sm text-slate-600">Manage complex rules effortlessly</div>
          </div>
          
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-white/50">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-violet-700 rounded-xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <div className="font-bold text-slate-900 text-lg mb-2">IB Compliant</div>
            <div className="text-sm text-slate-600">Full PYP, MYP, DP support</div>
          </div>
        </div>
      </div>
    </section>
  );
}