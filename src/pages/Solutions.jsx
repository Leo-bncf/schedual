import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Briefcase, GraduationCap, Workflow } from 'lucide-react';
import LandingHeader from '../components/landing/LandingHeader';
import LandingFooter from '../components/landing/LandingFooter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const solutions = [
  {
    title: 'For IB Coordinators',
    description: 'Manage programme structure, subject setup, constraints, and schedule generation from a single workflow.'
  },
  {
    title: 'For School Leadership',
    description: 'Get better visibility over staffing, room usage, scheduling quality, and administrative readiness.'
  },
  {
    title: 'For Operations Teams',
    description: 'Reduce repetitive data handling across teachers, rooms, students, and class groups.'
  }
];

export default function Solutions() {
  const icons = [GraduationCap, Briefcase, Workflow];

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
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_28%)]" />
            <div className="relative max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-900 mb-4">Solutions</p>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mb-6">Purpose-built flows for the people who actually run the school timetable.</h1>
              <p className="text-lg text-slate-600 leading-8">
                Schedual is designed to show clearly who it helps, what parts of timetable work it supports, and where it can simplify school operations.
              </p>
            </div>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3 mt-10">
            {solutions.map((item, index) => {
              const Icon = icons[index];
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.1 + index * 0.08, ease: 'easeOut' }}
                >
                  <Card className="h-full border-slate-200 bg-white/90 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                    <CardHeader>
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-900">
                        <Icon className="w-6 h-6" />
                      </div>
                      <CardTitle className="text-xl text-slate-900">{item.title}</CardTitle>
                      <CardDescription className="text-slate-600 leading-7">{item.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 text-sm text-slate-500 leading-7">
                      Clear setup, fewer manual steps, and a more structured scheduling workflow from start to finish.
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.28, ease: 'easeOut' }}
            className="mt-10 rounded-[2rem] bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-8 sm:p-10 text-white shadow-lg"
          >
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.2em] text-blue-200 mb-3">What schools get</p>
              <h2 className="text-2xl sm:text-3xl font-semibold mb-4">Less friction in setup, review, and timetable coordination.</h2>
              <p className="text-blue-50/90 leading-8">
                The aim is not to overload schools with noise. It is to give timetable teams a more focused workflow for the work they already need to do.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white/90">
                Built around real school workflows
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </motion.div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}