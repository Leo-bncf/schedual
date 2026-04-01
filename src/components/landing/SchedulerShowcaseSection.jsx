import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarDays, CheckCircle2, GraduationCap, LayoutDashboard, Sparkles, Users } from 'lucide-react';
import ScrollExpansionHero from '@/components/ui/scroll-expansion-hero';
import { Button } from '@/components/ui/button';

const showcaseModes = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    title: 'Scheduler Templates Reimagined',
    eyebrow: 'Interactive product tour',
    scrollHint: 'Scroll to expand the platform preview',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1600&auto=format&fit=crop',
    background: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'timetable',
    label: 'Timetable',
    title: 'From Rules To Working Timetables',
    eyebrow: 'Constraint-aware schedule generation',
    scrollHint: 'Scroll to reveal the live scheduling canvas',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1600&auto=format&fit=crop',
    background: 'https://images.unsplash.com/photo-1497366412874-3415097a27e7?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    title: 'See Balance Coverage And Conflicts',
    eyebrow: 'Decision-ready insights',
    scrollHint: 'Scroll to explore workload and optimization views',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1600&auto=format&fit=crop',
    background: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2000&auto=format&fit=crop',
  },
];

const stats = [
  { label: 'IB programmes supported', value: 'PYP • MYP • DP' },
  { label: 'Typical generation window', value: 'Minutes, not weeks' },
  { label: 'What gets optimized', value: 'Teachers, rooms, loads, constraints' },
];

function BrowserChrome() {
  return (
    <div className="flex items-center gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-3">
      <div className="flex gap-1.5">
        <div className="h-3 w-3 rounded-full bg-red-400" />
        <div className="h-3 w-3 rounded-full bg-amber-400" />
        <div className="h-3 w-3 rounded-full bg-emerald-400" />
      </div>
      <div className="h-8 flex-1 rounded-md border border-white/10 bg-white/5 px-3 text-xs text-slate-300 flex items-center">
        schedual.app/platform-preview
      </div>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">School overview</p>
            <h3 className="text-xl font-semibold text-slate-900">IB scheduling command center</h3>
          </div>
          <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">Solver healthy</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: LayoutDashboard, label: 'Active versions', value: '04' },
            { icon: Users, label: 'Teachers mapped', value: '128' },
            { icon: GraduationCap, label: 'Students covered', value: '1,284' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <item.icon className="mb-3 h-5 w-5 text-blue-800" />
              <div className="text-2xl font-semibold text-slate-900">{item.value}</div>
              <div className="text-sm text-slate-600">{item.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-medium text-slate-900">This week’s optimization focus</h4>
            <Sparkles className="h-4 w-4 text-violet-600" />
          </div>
          <div className="space-y-3">
            {[
              { label: 'Teacher load balancing', width: '92%' },
              { label: 'Room allocation fit', width: '87%' },
              { label: 'Student conflict prevention', width: '96%' },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                  <span>{item.label}</span>
                  <span>{item.width}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-violet-500" style={{ width: item.width }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-900">AI scheduling checks</p>
          <div className="space-y-3">
            {[
              'No room collisions detected for science labs',
              'DP block alignment validated for language options',
              'Lunch break visibility preserved for student views',
            ].map((text) => (
              <div key={text} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <p className="text-sm text-slate-700">{text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-900 p-4 text-white shadow-sm">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">Why this matters</p>
          <p className="mt-3 text-sm leading-6 text-slate-200">
            Show schools a product view instead of a static screenshot: setup, generate, inspect, and publish in one guided flow.
          </p>
        </div>
      </div>
    </div>
  );
}

function TimetablePreview() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const rows = [
    ['Physics HL', 'English A', 'Math AA', 'Chemistry', 'Spanish B'],
    ['Math AA', 'TOK', 'Physics HL', 'Biology', 'Economics'],
    ['Chemistry', 'Math AA', 'History', 'English A', 'Geography'],
    ['Lunch', 'Lunch', 'Lunch', 'Lunch', 'Lunch'],
    ['Biology', 'Physics HL', 'Math AA', 'Chemistry', 'English A'],
  ];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">Template example</p>
          <h3 className="text-xl font-semibold text-slate-900">Weekly timetable builder</h3>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">DP1 • Published draft</div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-6 bg-slate-50 text-xs font-medium text-slate-600">
          <div className="p-3">Time</div>
          {days.map((day) => <div key={day} className="p-3 text-center">{day}</div>)}
        </div>
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-6 border-t border-slate-100">
            <div className="bg-slate-50 p-3 text-xs text-slate-500">P{rowIndex + 1}</div>
            {row.map((item, index) => (
              <div key={`${item}-${index}`} className="p-2">
                <div className={`rounded-xl border px-3 py-2 text-center text-xs font-medium ${item === 'Lunch' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>
                  {item}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          'Auto-place subject blocks',
          'Respect room and load rules',
          'Export student and teacher views',
        ].map((item) => (
          <div key={item} className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{item}</div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsPreview() {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-900">Coverage snapshot</p>
          <div className="space-y-4">
            {[
              { label: 'Teacher availability match', value: '94%' },
              { label: 'Room utilization fit', value: '88%' },
              { label: 'Conflict-free student paths', value: '97%' },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex justify-between text-sm text-slate-600">
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-400" style={{ width: item.value }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-900">What schools can inspect</p>
          <div className="space-y-2 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 p-3">Teacher overload risk by department</div>
            <div className="rounded-2xl bg-slate-50 p-3">Room bottlenecks before publishing</div>
            <div className="rounded-2xl bg-slate-50 p-3">Programme-wide balance across year groups</div>
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">Template example</p>
            <h3 className="text-xl font-semibold text-slate-900">Workload and conflict trends</h3>
          </div>
          <CalendarDays className="h-5 w-5 text-blue-800" />
        </div>
        <div className="h-[320px] rounded-2xl bg-[linear-gradient(to_top,rgba(248,250,252,1),rgba(255,255,255,1))] p-4">
          <div className="flex h-full items-end gap-4">
            {[58, 82, 74, 91, 67, 88].map((value, idx) => (
              <div key={value + idx} className="flex flex-1 flex-col items-center gap-3">
                <div className="w-full rounded-t-2xl bg-gradient-to-t from-blue-700 via-cyan-500 to-violet-500" style={{ height: `${value}%` }} />
                <span className="text-xs text-slate-500">W{idx + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SchedulerShowcaseContent({ mode }) {
  if (mode === 'timetable') return <TimetablePreview />;
  if (mode === 'analytics') return <AnalyticsPreview />;
  return <DashboardPreview />;
}

export default function SchedulerShowcaseSection() {
  const [activeMode, setActiveMode] = useState(showcaseModes[0]);

  useEffect(() => {
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event('resetSection'));
  }, [activeMode.id]);

  return (
    <section id="preview" className="bg-slate-950">
      <div className="fixed right-4 top-24 z-40 hidden rounded-2xl border border-white/10 bg-slate-900/80 p-2 backdrop-blur md:flex md:gap-2">
        {showcaseModes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setActiveMode(mode)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${activeMode.id === mode.id ? 'bg-white text-slate-950' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <ScrollExpansionHero
        mediaType="image"
        mediaSrc={activeMode.image}
        bgImageSrc={activeMode.background}
        title={activeMode.title}
        date={activeMode.eyebrow}
        scrollToExpand={activeMode.scrollHint}
        textBlend
      >
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr] md:items-end">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-200">Landing page showcase</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">
                Let prospects explore your scheduler like a live product, not a static marketing block.
              </h2>
            </div>
            <div className="space-y-3 text-sm text-slate-300 md:text-base">
              <p>
                This section is built for your landing page and reframes the old image-heavy preview into a richer scheduler template story.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-white text-slate-950 hover:bg-slate-100">
                  <a href="#pricing">See pricing <ArrowRight className="h-4 w-4" /></a>
                </Button>
                <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <a href="#demo">Book a demo</a>
                </Button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
            <BrowserChrome />
            <div className="p-4 sm:p-6 lg:p-8">
              <SchedulerShowcaseContent mode={activeMode.id} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {stats.map((item) => (
              <div key={item.label} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">{item.label}</p>
                <p className="mt-3 text-lg font-medium text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </ScrollExpansionHero>
    </section>
  );
}