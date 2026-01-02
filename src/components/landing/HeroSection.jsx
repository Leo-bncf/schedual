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
    <section className="relative min-h-screen pt-32 pb-60 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-300 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-sky-400 rounded-full blur-3xl animate-pulse"></div>
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
              className="bg-white text-blue-900 hover:bg-white/90 text-lg px-8 py-6 shadow-xl"
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
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-xl shadow-lg hover:shadow-xl transition-all">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">Automated Scheduling</div>
                    <div className="text-sm text-blue-100">Generate in seconds</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-teal-500 via-cyan-600 to-sky-600 rounded-xl shadow-lg hover:shadow-xl transition-all">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">Teacher & Student Rules</div>
                    <div className="text-sm text-teal-100">Constraint management</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 rounded-xl shadow-lg hover:shadow-xl transition-all">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">IB Compliance</div>
                    <div className="text-sm text-indigo-100">PYP, MYP, DP support</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Smooth gradient transition to next section */}
      <div 
        className="absolute -bottom-40 left-0 right-0 h-[800px] pointer-events-none"
        style={{ 
          background: `linear-gradient(to bottom, 
            rgba(30, 58, 138, 0) 0%,
            rgba(30, 64, 175, 0.015) 15%,
            rgba(37, 99, 235, 0.03) 25%,
            rgba(59, 130, 246, 0.05) 35%,
            rgba(96, 165, 250, 0.08) 42%,
            rgba(147, 197, 253, 0.12) 48%,
            rgba(186, 230, 253, 0.18) 54%,
            rgba(207, 238, 254, 0.25) 60%,
            rgba(224, 242, 254, 0.35) 66%,
            rgba(236, 245, 254, 0.48) 72%,
            rgba(241, 245, 249, 0.63) 78%,
            rgba(244, 246, 250, 0.78) 84%,
            rgba(247, 248, 251, 0.89) 90%,
            rgb(248, 250, 252) 100%)`
        }}
      ></div>
    </section>
  );
}