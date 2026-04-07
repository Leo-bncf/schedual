import React from 'react';
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
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <main className="pt-36 pb-20">
        <section className="max-w-5xl mx-auto px-6">
          <div className="max-w-3xl mb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-900 mb-4">About Schedual</p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mb-6">Scheduling software built for modern IB schools.</h1>
            <p className="text-lg text-slate-600 leading-8">
              Schedual helps schools organize subjects, teachers, students, rooms, and timetable generation in one place.
              It is built to reduce manual scheduling work while giving school teams more clarity and control.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {principles.map((item) => (
              <Card key={item.title} className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-900">{item.title}</CardTitle>
                  <CardDescription className="text-slate-600 leading-7">{item.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          <Card className="mt-10 border-blue-100 bg-blue-50/60 shadow-sm">
            <CardContent className="p-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">Why this matters</h2>
              <p className="text-slate-700 leading-8">
                IB schools often rely on spreadsheets, fragmented tools, or systems that try to do everything at once.
                Schedual is being shaped around a narrower goal: make timetable setup, iteration, and delivery much simpler for schools that need reliability.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}