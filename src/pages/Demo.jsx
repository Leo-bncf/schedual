import React from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, Clock3, PlayCircle } from 'lucide-react';
import LandingHeader from '../components/landing/LandingHeader';
import LandingFooter from '../components/landing/LandingFooter';
import DemoBooking from '../components/landing/DemoBooking';

const highlights = [
  {
    icon: CalendarDays,
    title: 'Live walkthrough',
    description: 'See the core scheduling workflow step by step with a real product tour.'
  },
  {
    icon: Clock3,
    title: 'Short and focused',
    description: 'A practical session built to answer questions quickly without wasting time.'
  },
  {
    icon: CheckCircle2,
    title: 'Relevant to your school',
    description: 'We focus on how the platform fits IB scheduling needs, not generic software talk.'
  }
];

export default function Demo() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_45%,#eef4ff_100%)]">
      <LandingHeader />
      <main className="pt-36 pb-20">
        <section className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white/85 p-8 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-12"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.12),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.08),transparent_28%)]" />
            <div className="relative max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-900 mb-4">Book a demo</p>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mb-6">See how Schedual works in a real scheduling workflow.</h1>
              <p className="text-lg text-slate-600 leading-8">
                This is a dedicated product walkthrough for schools that want a clearer view of setup, timetable generation, review, and day-to-day use.
              </p>
              <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900">
                <PlayCircle className="w-4 h-4" />
                Focused demo, no pressure
              </div>
            </div>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3 mt-10">
            {highlights.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.08 + index * 0.08, ease: 'easeOut' }}
                  className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-900">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-2">{item.title}</h2>
                  <p className="text-slate-600 leading-7">{item.description}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        <div className="mt-8">
          <DemoBooking />
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}