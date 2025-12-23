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
    <section className="relative pt-32 pb-40 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-300 rounded-full blur-3xl animate-pulse"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div>
            <div className="inline-block mb-4 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
              <span className="text-white font-semibold">✨ AI-Powered Scheduling</span>
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight mb-6">
              All-in-One Automated IB Schedule Generation
            </h1>
            <p className="text-xl text-white/90 mb-8 leading-relaxed">
              Create conflict-free timetables for your IB school in minutes. 
              Manage teachers, students, and constraints effortlessly with AI-powered optimization.
            </p>
            <Button 
              size="lg" 
              className="bg-white text-indigo-600 hover:bg-white/90 text-lg px-8 py-6 shadow-xl"
              onClick={scrollToInfo}
            >
              Learn More
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 mt-12">
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
                <div className="text-3xl font-bold text-white">500+</div>
                <div className="text-sm text-white/80">Hours Saved</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
                <div className="text-3xl font-bold text-white">100%</div>
                <div className="text-sm text-white/80">Safe & Encrypted</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
                <div className="text-3xl font-bold text-white">24/7</div>
                <div className="text-sm text-white/80">Access & Support</div>
              </div>
            </div>
          </div>

          {/* Right Content - Visual */}
          <div className="relative">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/50">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg shadow-lg">
                  <Calendar className="w-6 h-6 text-white" />
                  <div>
                    <div className="font-semibold text-white">Automated Scheduling</div>
                    <div className="text-sm text-indigo-100">Generate in seconds</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg shadow-lg">
                  <Users className="w-6 h-6 text-white" />
                  <div>
                    <div className="font-semibold text-white">Teacher & Student Rules</div>
                    <div className="text-sm text-emerald-100">Constraint management</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-violet-500 to-violet-600 rounded-lg shadow-lg">
                  <BookOpen className="w-6 h-6 text-white" />
                  <div>
                    <div className="font-semibold text-white">IB Compliance</div>
                    <div className="text-sm text-violet-100">PYP, MYP, DP support</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Gradient transition to next section - animated on scroll */}
      <div 
        className="absolute -bottom-40 left-0 right-0 h-[500px] bg-gradient-to-b from-transparent via-purple-700/5 to-slate-50"
        style={{ 
          opacity: 1 - scrollProgress * 0.2,
          transition: 'opacity 0.1s ease-out'
        }}
      ></div>
      
      {/* Animated overlay that grows as you scroll */}
      <div 
        className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-50/50 to-slate-50 pointer-events-none"
        style={{ 
          opacity: scrollProgress * 0.9,
          transform: `translateY(${scrollProgress * 150}px)`,
          transition: 'opacity 0.1s ease-out, transform 0.1s ease-out'
        }}
      ></div>
    </section>
  );
}