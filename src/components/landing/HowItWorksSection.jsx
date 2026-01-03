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
    <section className="py-12 px-4 sm:px-6 lg:px-8 bg-transparent">
      <div className="max-w-4xl mx-auto">
        <div className="space-y-4">
          {steps.map((step, index) => (
            <motion.div 
              key={index} 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white shadow-lg bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800">
                  {step.number}
                </div>
                <div className="flex-1 bg-white/70 backdrop-blur-md p-4 rounded-xl border border-slate-200 shadow-md hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <step.icon className="w-5 h-5 text-blue-900" />
                    <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}