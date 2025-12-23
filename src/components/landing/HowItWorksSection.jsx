import React from 'react';
import { Building2, Users, Settings, Play, CheckCircle } from 'lucide-react';

const steps = [
  {
    number: '1',
    icon: Building2,
    title: 'Create Your School Profile',
    description: 'Set up your school details, academic year, and basic scheduling parameters like period duration and school hours.',
  },
  {
    number: '2',
    icon: Users,
    title: 'Add Teachers, Students & Subjects',
    description: 'Import or manually add your teachers with qualifications, students with subject choices, and all your IB subjects.',
  },
  {
    number: '3',
    icon: Settings,
    title: 'Define Rules & Constraints',
    description: 'Set teacher availability, room requirements, student groupings, and any special scheduling rules.',
  },
  {
    number: '4',
    icon: Play,
    title: 'Generate Schedule',
    description: 'Click generate and watch the AI create a complete, conflict-free timetable in seconds.',
  },
  {
    number: '5',
    icon: CheckCircle,
    title: 'Review & Export',
    description: 'Review the schedule, make any adjustments, and export for students, teachers, and rooms.',
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            How It Works
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Get started in 5 simple steps. No technical knowledge required.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-8">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col md:flex-row gap-6 items-start">
              {/* Step Number & Icon */}
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                  {step.number}
                </div>
              </div>

              {/* Step Content */}
              <div className="flex-1 bg-white p-6 rounded-xl border-2 border-purple-100 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <step.icon className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-xl font-semibold text-slate-900">{step.title}</h3>
                </div>
                <p className="text-slate-600 leading-relaxed">{step.description}</p>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block w-0.5 h-8 bg-slate-200 ml-8 mt-4"></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}