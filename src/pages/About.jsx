import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import LandingHeader from '../components/landing/LandingHeader';
import LandingFooter from '../components/landing/LandingFooter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const principles = [
  {
    title: 'Started by two IB students',
    description: 'Schedual began with two IB students who experienced the limits of existing timetable systems and wanted to build something more useful for real schools.'
  },
  {
    title: 'Built to improve timetabling',
    description: 'The goal is to improve how schools plan and manage schedules, with clearer workflows, less manual effort, and tools that reflect how IB schools actually operate.'
  },
  {
    title: 'Designed for future students',
    description: 'We believe better scheduling supports better learning environments, giving future students a more organized, reliable, and effective school experience.'
  }
];

export default function About() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_42%,#eef4ff_100%)]">
      <LandingHeader />
      <main className="pt-36 pb-20">
        <section className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white/85 p-8 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-12"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.12),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.08),transparent_28%)]" />
            <div className="relative max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-900 mb-4">About Schedual</p>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mb-6">Built by two IB students to improve school timetabling.</h1>
              <p className="text-lg text-slate-600 leading-8">
                Schedual was started by two IB students who saw how frustrating and outdated timetable systems could be.
                What began as a drive to improve existing scheduling tools has grown into a mission to help schools run better and give future students a stronger educational experience.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-700">
                {['Founded by IB students', 'Improving school timetables', 'Built for future learners'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 font-medium text-blue-900">
                    <CheckCircle2 className="w-4 h-4" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3 mt-10">
            {principles.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1 + index * 0.08, ease: 'easeOut' }}
              >
                <Card className="h-full border-slate-200 bg-white/90 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-xl text-slate-900">{item.title}</CardTitle>
                    <CardDescription className="text-slate-600 leading-7">{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.28, ease: 'easeOut' }}
          >
            <Card className="mt-10 overflow-hidden border-blue-100 bg-white/90 shadow-sm">
              <CardContent className="p-0">
                <div className="grid gap-0 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="p-8 sm:p-10">
                    <h2 className="text-2xl font-semibold text-slate-900 mb-4">Why this matters</h2>
                    <p className="text-slate-700 leading-8">
                      Better timetables do more than save admin time.
                      They create more stable school days, reduce friction for teachers and coordinators, and help students learn in an environment that feels more organized and intentional.
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-8 text-white flex flex-col justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-blue-200 mb-3">Focused outcome</p>
                      <p className="text-lg leading-8 text-blue-50">
                        A better scheduling system built with the belief that smarter school operations can contribute to better education for the students who come next.
                      </p>
                    </div>
                    <div className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-white/90">
                      Built for practical school use
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}