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
    <section className="relative min-h-screen pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden bg-white">
      {/* Blue splat effect at top */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-br from-blue-400/30 via-indigo-400/20 to-purple-400/30 rounded-full blur-3xl"></div>

      <div className="max-w-5xl mx-auto relative z-10 text-center">
        <div className="inline-block mb-6 bg-blue-100 px-6 py-3 rounded-full">
          <span className="text-blue-900 font-semibold text-lg">✨ Next Generation Schedule Creation</span>
        </div>
        
        <h1 className="text-6xl sm:text-7xl font-bold text-slate-900 leading-tight mb-8">
          The Future of IB School Scheduling
        </h1>
        
        <p className="text-2xl text-slate-600 mb-12 leading-relaxed max-w-3xl mx-auto">
          Experience next generation schedule creation powered by AI. Generate perfect, conflict-free timetables for all IB programmes in minutes, not weeks.
        </p>
        
        <Button 
          size="lg" 
          className="bg-blue-900 text-white hover:bg-blue-950 text-lg px-10 py-7 shadow-2xl text-xl"
          onClick={scrollToInfo}
        >
          Discover How It Works
          <ArrowRight className="w-6 h-6 ml-2" />
        </Button>

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
      
      {/* Smooth gradient fade to white and back to colors */}
      <div 
        className="absolute -bottom-80 left-0 right-0 h-[1000px] pointer-events-none"
        style={{ 
          background: `linear-gradient(to bottom, 
            rgba(30, 64, 175, 0) 0%,
            rgba(59, 130, 246, 0.02) 15%,
            rgba(20, 184, 166, 0.04) 25%,
            rgba(168, 85, 247, 0.07) 33%,
            rgba(147, 197, 253, 0.11) 40%,
            rgba(186, 230, 253, 0.16) 46%,
            rgba(207, 238, 254, 0.23) 51%,
            rgba(224, 242, 254, 0.32) 55%,
            rgba(236, 245, 254, 0.44) 59%,
            rgba(241, 245, 249, 0.58) 63%,
            rgba(244, 246, 250, 0.73) 67%,
            rgba(247, 248, 251, 0.86) 71%,
            rgb(248, 250, 252) 75%,
            rgba(247, 248, 251, 0.86) 79%,
            rgba(244, 246, 250, 0.73) 83%,
            rgba(236, 245, 254, 0.58) 87%,
            rgba(224, 242, 254, 0.44) 90%,
            rgba(186, 230, 253, 0.23) 92%,
            rgba(168, 85, 247, 0.16) 94%,
            rgba(20, 184, 166, 0.09) 96%,
            rgba(59, 130, 246, 0.04) 97.5%,
            rgba(30, 64, 175, 0.015) 99%,
            rgba(30, 64, 175, 0) 100%)`
        }}
      ></div>
    </section>
  );
}