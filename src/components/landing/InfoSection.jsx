import React from 'react';
import { Calendar, Users, BookOpen, Building2, Sparkles, Download } from 'lucide-react';
import { motion } from 'framer-motion';

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



        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const colors = [
              { border: 'hover:border-cyan-500', shadow: 'hover:shadow-[0_0_0_2px_rgb(6,182,212),0_0_20px_rgba(6,182,212,0.3)]' },
              { border: 'hover:border-fuchsia-500', shadow: 'hover:shadow-[0_0_0_2px_rgb(217,70,239),0_0_20px_rgba(217,70,239,0.3)]' },
              { border: 'hover:border-blue-500', shadow: 'hover:shadow-[0_0_0_2px_rgb(59,130,246),0_0_20px_rgba(59,130,246,0.3)]' },
              { border: 'hover:border-sky-500', shadow: 'hover:shadow-[0_0_0_2px_rgb(14,165,233),0_0_20px_rgba(14,165,233,0.3)]' },
              { border: 'hover:border-violet-500', shadow: 'hover:shadow-[0_0_0_2px_rgb(139,92,246),0_0_20px_rgba(139,92,246,0.3)]' },
              { border: 'hover:border-purple-500', shadow: 'hover:shadow-[0_0_0_2px_rgb(168,85,247),0_0_20px_rgba(168,85,247,0.3)]' },
            ];
            const colorClass = colors[index % colors.length];
            return (
            <div 
              key={index} 
              className={`p-6 rounded-xl bg-gradient-to-br from-white via-blue-50/30 to-white backdrop-blur-sm border-2 border-transparent ${colorClass.border} group hover:bg-gradient-to-br hover:from-blue-900 hover:to-blue-950 transition-all duration-500 ${colorClass.shadow}`}
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-all shadow-lg group-hover:from-sky-400 group-hover:via-fuchsia-500 group-hover:to-blue-500">
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-white transition-colors">{feature.title}</h3>
              <p className="text-slate-600 group-hover:text-blue-100 transition-colors">{feature.description}</p>
            </div>
          );
          })}
        </div>
      </div>
    </section>
  );
}