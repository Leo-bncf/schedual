import React, { useEffect, useState } from 'react';
import { Calendar, Users, BookOpen, Building2, ShieldCheck, FileSpreadsheet, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: Calendar,
    title: 'Tier-based school access',
    description: 'Each school operates under clear Starter, Standard, or Pro rules.',
  },
  {
    icon: Users,
    title: 'Admin limits enforced',
    description: 'Admin account access follows the tier assigned to the school.',
  },
  {
    icon: BookOpen,
    title: 'Auto generation + manual edits',
    description: 'Schools can generate schedules automatically and fine-tune them manually.',
  },
  {
    icon: Building2,
    title: 'Built for real schools',
    description: 'Student capacity and school growth are handled through the tier structure.',
  },
  {
    icon: ShieldCheck,
    title: 'Rules applied automatically',
    description: 'Saved version limits and access rules are controlled by the plan.',
  },
  {
    icon: FileSpreadsheet,
    title: 'PDF & Excel exports',
    description: 'Schedules stay easy to share with staff, students, and leadership teams.',
  },
];

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

  return (
    <>
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <style>{`
          @keyframes float-blob-1 {
            0% { transform: translate(-50%, 0) scale(0.8); opacity: 0; }
            100% { transform: translate(-50%, 0) scale(1.2); opacity: 0.8; }
          }
          @keyframes float-blob-2 {
            0% { transform: translate(0, 0) scale(0.8); opacity: 0; }
            100% { transform: translate(0, 0) scale(1.2); opacity: 0.75; }
          }
          @keyframes float-blob-3 {
            0% { transform: translate(0, 0) scale(0.8); opacity: 0; }
            100% { transform: translate(0, 0) scale(1.2); opacity: 0.7; }
          }
          .animate-float-1 { animation: float-blob-1 2s ease-out forwards; }
          .animate-float-2 { animation: float-blob-2 2s ease-out forwards; animation-delay: 0.2s; }
          .animate-float-3 { animation: float-blob-3 2s ease-out forwards; animation-delay: 0.4s; }
        `}</style>
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.5, ease: "easeOut" }} className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1400px] h-[700px] bg-gradient-to-br from-sky-400/60 via-cyan-500/50 to-blue-500/60 rounded-full blur-3xl animate-float-1" />
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.5, delay: 0.2, ease: "easeOut" }} className="absolute -top-20 left-1/3 w-[800px] h-[800px] bg-gradient-to-bl from-purple-500/55 via-fuchsia-500/50 to-violet-500/55 rounded-full blur-3xl animate-float-2" />
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.5, delay: 0.4, ease: "easeOut" }} className="absolute top-10 right-1/4 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-400/45 via-sky-500/50 to-blue-400/45 rounded-full blur-3xl animate-float-3" />
      </div>

      <section className="relative min-h-screen pt-52 sm:pt-56 pb-[30rem] px-4 sm:px-6 lg:px-8 overflow-hidden bg-transparent">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap');
        `}</style>

        <div className="max-w-6xl mx-auto relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm backdrop-blur"
          >
            <Sparkles className="h-4 w-4" />
            Timetabling for IB schools
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0, ease: [0.16, 1, 0.3, 1] }}
            style={{ opacity: 1 - scrollProgress * 0.8, transform: `translateY(${scrollProgress * -50}px) scale(${1 - scrollProgress * 0.1})`, fontFamily: "'Poppins', 'Space Grotesk', sans-serif" }}
            className="text-5xl sm:text-6xl lg:text-7xl font-semibold text-slate-900 leading-[1.05] mb-8 tracking-tight"
          >
            A school tier system built into scheduling
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ opacity: 1 - scrollProgress * 0.8, transform: `translateY(${scrollProgress * -40}px)`, fontFamily: "'Poppins', 'Inter', sans-serif" }}
            className="text-lg sm:text-xl text-slate-700 mb-10 leading-8 max-w-3xl mx-auto font-normal"
          >
            Build better school schedules with AI-assisted generation, cleaner admin workflows, and a platform designed around the real complexity of IB programmes.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <a href="#pricing">
              <Button className="h-12 rounded-full bg-blue-900 px-6 text-base hover:bg-blue-800">
                View pricing
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <a href="#demo">
              <Button variant="outline" className="h-12 rounded-full border-slate-300 bg-white/80 px-6 text-base backdrop-blur">
                Book a demo
              </Button>
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-3"
          >
            {[
              'Built for IB timetabling',
              'Clear school-wide scheduling workflows',
              'Exports and admin controls included'
            ].map((item) => (
              <div key={item} className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm backdrop-blur">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>{item}</span>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-0 right-0 mt-20 h-64 overflow-hidden z-10"
          style={{ opacity: 1 - scrollProgress * 1.2, transform: `translateY(${scrollProgress * -30}px) scale(${1 - scrollProgress * 0.15})` }}
        >
          <style>{`
            @keyframes scroll-left {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .animate-scroll {
              animation: scroll-left 30s linear infinite;
            }
          `}</style>
          <div className="flex gap-6 animate-scroll">
            {[...features, ...features].map((feature, index) => (
              <div key={index} className="flex-shrink-0 w-64 h-64">
                <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200 p-4 h-full flex flex-col group hover:bg-gradient-to-br hover:from-blue-900 hover:to-blue-950 transition-all duration-500 cursor-pointer text-center">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl flex items-center justify-center mx-auto mb-3 flex-shrink-0 group-hover:from-sky-400 group-hover:via-fuchsia-500 group-hover:to-blue-500 transition-all">
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2 flex-shrink-0 group-hover:text-white transition-colors">{feature.title}</h3>
                  <p className="text-sm text-slate-700 flex-grow group-hover:text-blue-100 transition-colors">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>
    </>
  );
}