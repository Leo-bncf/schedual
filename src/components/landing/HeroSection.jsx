import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowDown, Calendar, Users, BookOpen, Target, Clock, Zap, Shield } from 'lucide-react';

export default function HeroSection() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      const maxScroll = 500;
      setScrollProgress(Math.min(scrolled / maxScroll, 1));
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
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated Background Elements */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          transform: `translateY(${scrollProgress * 50}px)`,
        }}
      >
        <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-600/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-violet-600/30 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Main Heading */}
        <div className="mb-8 animate-fadeIn">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 mb-6 leading-tight">
            AI-Powered <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">IB Diploma</span> Schedule Builder
          </h1>
          <p className="text-xl sm:text-2xl text-slate-700 max-w-3xl mx-auto">
            Intelligent scheduling for IB World Schools. Automated timetabling that respects constraints, optimizes resources, and saves countless hours.
          </p>
        </div>

        {/* CTA Button */}
        <Button 
          size="lg"
          onClick={scrollToInfo}
          className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-lg px-8 py-6 shadow-xl hover:shadow-2xl transition-all"
        >
          Learn More
          <ArrowDown className="ml-2 w-5 h-5" />
        </Button>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-16">
          <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-purple-300/50">
            <Clock className="w-8 h-8 text-indigo-600 mx-auto mb-3" />
            <div className="text-3xl font-bold text-slate-900">100+</div>
            <div className="text-slate-700">Hours Saved</div>
          </div>
          <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-purple-300/50">
            <Zap className="w-8 h-8 text-violet-600 mx-auto mb-3" />
            <div className="text-3xl font-bold text-slate-900">AI-Powered</div>
            <div className="text-slate-700">Smart Optimization</div>
          </div>
          <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-purple-300/50">
            <Shield className="w-8 h-8 text-indigo-600 mx-auto mb-3" />
            <div className="text-3xl font-bold text-slate-900">Safe & Encrypted</div>
            <div className="text-slate-700">Secure Data</div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
          {[
            { icon: <Calendar className="w-6 h-6" />, text: 'Auto-Scheduling' },
            { icon: <Users className="w-6 h-6" />, text: 'Teacher Management' },
            { icon: <BookOpen className="w-6 h-6" />, text: 'IB Compliance' },
            { icon: <Target className="w-6 h-6" />, text: 'Conflict Resolution' },
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-3 text-slate-700">
              <div className="text-indigo-600">{feature.icon}</div>
              <span className="font-medium">{feature.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}