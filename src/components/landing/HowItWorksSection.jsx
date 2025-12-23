import React from 'react';
import { Users, BookOpen, Settings, Sparkles, CheckCircle } from 'lucide-react';

const steps = [
  {
    number: 1,
    icon: <Users className="w-6 h-6" />,
    title: 'Add Your Data',
    description: 'Import teachers, students, subjects, and rooms into the system.'
  },
  {
    number: 2,
    icon: <BookOpen className="w-6 h-6" />,
    title: 'Set Preferences',
    description: 'Define teacher qualifications, student choices, and scheduling constraints.'
  },
  {
    number: 3,
    icon: <Settings className="w-6 h-6" />,
    title: 'Configure Settings',
    description: 'Set your school parameters like periods per day and IB requirements.'
  },
  {
    number: 4,
    icon: <Sparkles className="w-6 h-6" />,
    title: 'Generate Schedule',
    description: 'Our AI creates an optimized schedule in minutes, not weeks.'
  },
  {
    number: 5,
    icon: <CheckCircle className="w-6 h-6" />,
    title: 'Review & Publish',
    description: 'Fine-tune if needed and publish your conflict-free schedule.'
  }
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            How It Works
          </h2>
          <p className="text-xl text-slate-700 max-w-3xl mx-auto">
            Get started in 5 simple steps. From data import to published schedule.
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-8">
          {steps.map((step, i) => (
            <div key={i} className="relative">
              {/* Connector Line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-indigo-500/50 to-violet-500/50" />
              )}
              
              {/* Step Card */}
              <div className="relative bg-white/50 backdrop-blur-sm rounded-xl p-6 border border-blue-300/50 hover:border-indigo-500/50 transition-all text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">
                  {step.number}
                </div>
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600/20 to-violet-600/20 flex items-center justify-center text-indigo-400 mx-auto mb-3">
                  {step.icon}
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-700">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}