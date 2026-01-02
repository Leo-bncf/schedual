import React from 'react';
import { Building2, Users, Settings, Play, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

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
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-300 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-300 rounded-full blur-3xl"></div>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
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
            <motion.div 
              key={index} 
              className="flex flex-col md:flex-row gap-6 items-start"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              {/* Step Number & Icon */}
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex items-center justify-center text-2xl font-bold text-white shadow-lg ring-2 ring-blue-400/50">
                  {step.number}
                </div>
              </div>

              {/* Step Content */}
              <div 
                className="flex-1 bg-white p-6 rounded-xl border-2 border-transparent hover:border-purple-900 shadow-lg hover:shadow-2xl transition-all duration-500 hover:shadow-[0_0_0_2px_rgb(88,28,135),0_0_20px_rgba(88,28,135,0.3)]"
              >
                <div className="flex items-center gap-3 mb-3">
                  <step.icon className="w-6 h-6 text-blue-900" />
                  <h3 className="text-xl font-semibold text-slate-900">{step.title}</h3>
                </div>
                <p className="text-slate-600 leading-relaxed">{step.description}</p>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block w-0.5 h-8 bg-slate-200 ml-8 mt-4"></div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}