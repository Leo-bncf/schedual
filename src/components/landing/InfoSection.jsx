import React from 'react';
import { Calendar, Users, BookOpen, Building2, Sparkles, Download } from 'lucide-react';

const features = [
  {
    icon: Calendar,
    title: 'Automated Schedule Generation',
    description: 'Generate complete school timetables in minutes, not weeks. Our AI handles all the complexity.',
  },
  {
    icon: Users,
    title: 'Teacher & Student Management',
    description: 'Track qualifications, availability, and preferences. Ensure every teacher and student gets an optimal schedule.',
  },
  {
    icon: BookOpen,
    title: 'IB Programme Support',
    description: 'Full support for PYP, MYP, and DP programmes. Manage subject groups, HL/SL levels, and core components.',
  },
  {
    icon: Building2,
    title: 'Room Allocation',
    description: 'Automatically assign classrooms based on capacity, equipment, and special requirements like labs.',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Optimization',
    description: 'Smart conflict resolution and constraint satisfaction. Get suggestions for improving your schedule.',
  },
  {
    icon: Download,
    title: 'Export & Share',
    description: 'Export schedules for students, teachers, and administrators. Print or share digitally.',
  },
];

export default function InfoSection() {
  return (
    <section id="info" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-200 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-sky-200 rounded-full blur-3xl"></div>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Everything You Need for IB Scheduling
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Stop spending weeks on manual scheduling. Our platform automates the entire process 
            while respecting all your constraints and requirements.
          </p>
        </div>

        {/* Problems & Solutions */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="bg-gradient-to-br from-rose-100 to-pink-100 p-8 rounded-2xl border border-rose-200">
            <h3 className="text-2xl font-semibold text-rose-900 mb-4">Existing Solutions</h3>
            <ul className="space-y-3 text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-rose-600 mt-1">•</span>
                <span>Manual scheduling takes weeks of work</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-600 mt-1">•</span>
                <span>Teacher and room conflicts are common</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-600 mt-1">•</span>
                <span>Changes require starting from scratch</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-600 mt-1">•</span>
                <span>IB requirements are complex to manage</span>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-emerald-100 to-teal-100 p-8 rounded-2xl border border-emerald-200">
            <h3 className="text-2xl font-semibold text-emerald-900 mb-4">IB Schedual Pro</h3>
            <ul className="space-y-3 text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 mt-1">✓</span>
                <span>Generate schedules in minutes with AI</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 mt-1">✓</span>
                <span>Automatic conflict detection and resolution</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 mt-1">✓</span>
                <span>Instant regeneration when rules change</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 mt-1">✓</span>
                <span>Built-in IB compliance checks</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="p-6 rounded-xl bg-gradient-to-br from-white via-blue-50/30 to-white backdrop-blur-sm border-2 border-blue-200 hover:border-blue-400 transition-all hover:shadow-2xl hover:-translate-y-2 group">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}