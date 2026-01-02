import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Users, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';

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
    <section className="relative min-h-screen pt-64 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden bg-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap');
      `}</style>
      {/* Blue splat effect at top */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1400px] h-[700px] bg-gradient-to-br from-sky-400/60 via-cyan-500/50 to-blue-500/60 rounded-full blur-3xl"></div>
      <div className="absolute -top-20 left-1/3 w-[800px] h-[800px] bg-gradient-to-bl from-purple-500/55 via-fuchsia-500/50 to-violet-500/55 rounded-full blur-3xl"></div>
      <div className="absolute top-10 right-1/4 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-400/45 via-sky-500/50 to-blue-400/45 rounded-full blur-3xl"></div>

      <div className="max-w-5xl mx-auto relative z-10 text-center">
        <motion.h1 
          initial={{ opacity: 0, y: 80, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ opacity: 1 - scrollProgress * 0.8, transform: `translateY(${scrollProgress * -50}px) scale(${1 - scrollProgress * 0.1})`, fontFamily: "'Poppins', 'Space Grotesk', sans-serif" }}
          className="text-6xl sm:text-7xl font-semibold text-slate-900 leading-tight mb-8 tracking-wide"
        >
          The Future of IB Scheduling
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{ opacity: 1 - scrollProgress * 0.8, transform: `translateY(${scrollProgress * -40}px)`, fontFamily: "'Poppins', 'Inter', sans-serif" }}
          className="text-xl text-slate-800 mb-12 leading-relaxed max-w-3xl mx-auto font-normal tracking-wide"
        >
          Experience next generation schedule creation powered by AI. Generate perfect, conflict-free timetables for all IB programmes in minutes, not weeks.
        </motion.p>

        {/* Feature Cards */}
        <motion.div 
          className="grid md:grid-cols-3 gap-6 mt-20 max-w-4xl mx-auto"
          style={{ opacity: 1 - scrollProgress * 1.2, transform: `translateY(${scrollProgress * -30}px) scale(${1 - scrollProgress * 0.15})` }}
        >
          <div 
            className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border-2 border-transparent hover:border-cyan-500 transition-all duration-500 hover:shadow-[0_0_0_2px_rgb(6,182,212),0_0_20px_rgba(6,182,212,0.3)]"
          >
            <div className="w-14 h-14 bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <div className="font-bold text-slate-900 text-lg mb-2">AI-Powered</div>
            <div className="text-sm text-slate-700">Intelligent optimization in seconds</div>
          </div>

            <div 
            className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border-2 border-transparent hover:border-fuchsia-500 transition-all duration-500 hover:shadow-[0_0_0_2px_rgb(217,70,239),0_0_20px_rgba(217,70,239,0.3)]"
          >
            <div className="w-14 h-14 bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div className="font-bold text-slate-900 text-lg mb-2">Smart Constraints</div>
            <div className="text-sm text-slate-700">Manage complex rules effortlessly</div>
          </div>

            <div 
            className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border-2 border-transparent hover:border-blue-500 transition-all duration-500 hover:shadow-[0_0_0_2px_rgb(59,130,246),0_0_20px_rgba(59,130,246,0.3)]"
          >
            <div className="w-14 h-14 bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <div className="font-bold text-slate-900 text-lg mb-2">IB Compliant</div>
            <div className="text-sm text-slate-700">Full PYP, MYP, DP support</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}