import React from 'react';
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
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <main className="pt-36 pb-20">
        <section className="max-w-5xl mx-auto px-6">
          <div className="max-w-3xl mb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-900 mb-4">Solutions</p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mb-6">Purpose-built flows for the people who actually run the school timetable.</h1>
            <p className="text-lg text-slate-600 leading-8">
              Schedual is designed to show clearly who it helps, what parts of timetable work it supports, and where it can simplify school operations.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {solutions.map((item) => (
              <Card key={item.title} className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-900">{item.title}</CardTitle>
                  <CardDescription className="text-slate-600 leading-7">{item.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-slate-500 leading-7">
                  Clear setup, fewer manual steps, and a more structured scheduling workflow from start to finish.
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}