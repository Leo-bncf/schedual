import React from 'react';
import { Calendar, Users, Target, Building2, Sparkles, FileText } from 'lucide-react';

const features = [
  {
    icon: <Calendar className="w-6 h-6" />,
    title: 'Automated Scheduling',
    description: 'AI-powered timetabling that considers all constraints and preferences automatically.'
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Teacher & Student Management',
    description: 'Comprehensive management system for teachers, students, and their preferences.'
  },
  {
    icon: <Target className="w-6 h-6" />,
    title: 'IB Diploma Support',
    description: 'Built specifically for IB DP schools with group requirements and core components.'
  },
  {
    icon: <Building2 className="w-6 h-6" />,
    title: 'Room Allocation',
    description: 'Intelligent room assignment considering capacity and special requirements.'
  },
  {
    icon: <Sparkles className="w-6 h-6" />,
    title: 'AI Optimization',
    description: 'Advanced algorithms optimize schedules for best outcomes and minimal conflicts.'
  },
  {
    icon: <FileText className="w-6 h-6" />,
    title: 'Export & Reports',
    description: 'Generate professional schedules and reports in multiple formats.'
  }
];

export default function InfoSection() {
  return (
    <section id="info" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Why IB Schedule Pro?
          </h2>
          <p className="text-xl text-slate-700 max-w-3xl mx-auto">
            Traditional scheduling is time-consuming and error-prone. We automate the entire process.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          {/* Problems */}
          <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-8 border border-purple-300/50">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">Traditional Problems</h3>
            <ul className="space-y-4">
              {[
                'Manual scheduling takes weeks',
                'Conflicts and double-bookings',
                'Teacher overload or underutilization',
                'IB requirements hard to track',
                'Last-minute changes chaos'
              ].map((problem, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-400 mt-2 flex-shrink-0" />
                  <span className="text-slate-700">{problem}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Solutions */}
          <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-8 border border-purple-300/50">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">Our Solutions</h3>
            <ul className="space-y-4">
              {[
                'AI generates schedules in minutes',
                'Automatic conflict detection & resolution',
                'Balanced workload distribution',
                'Built-in IB compliance checking',
                'Easy modifications and regeneration'
              ].map((solution, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-400 mt-2 flex-shrink-0" />
                  <span className="text-slate-700">{solution}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <div key={i} className="bg-white/50 backdrop-blur-sm rounded-xl p-6 border border-purple-300/50 hover:border-indigo-500/50 transition-all">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white mb-4">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-slate-700">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}