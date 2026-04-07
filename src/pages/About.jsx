import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import LandingHeader from '../components/landing/LandingHeader';
import LandingFooter from '../components/landing/LandingFooter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const principles = [
  {
    title: 'Built for IB complexity',
    description: 'Schedual is designed around real IB scheduling constraints, from DP subject combinations to teacher load and room availability.'
  },
  {
    title: 'Made for school leaders',
    description: 'We focus on giving coordinators and admins a clear system to manage setup, generation, review, and publishing without chaos.'
  },
  {
    title: 'Practical, not bloated',
    description: 'The goal is not to copy legacy systems with endless menus, but to give schools the pages they actually need to act fast.'
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
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mb-6">Scheduling software built for modern IB schools.</h1>
              <p className="text-lg text-slate-600 leading-8">
                Schedual helps schools organize subjects, teachers, students, rooms, and timetable generation in one place.
                It is built to reduce manual scheduling work while giving school teams more clarity and control.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-700">
                {['Clearer setup', 'Less manual work', 'Built for IB workflows'].map((item) => (
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
                      IB schools often rely on spreadsheets, fragmented tools, or systems that try to do everything at once.
                      Schedual is being shaped around a narrower goal: make timetable setup, iteration, and delivery much simpler for schools that need reliability.
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-8 text-white flex flex-col justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-blue-200 mb-3">Focused outcome</p>
                      <p className="text-lg leading-8 text-blue-50">
                        A scheduling workspace that feels more structured, more intentional, and easier for school teams to trust.
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