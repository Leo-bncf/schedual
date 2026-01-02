import React, { useState } from 'react';
import { Building2, Users, Settings, Play, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const steps = [
  {
    number: '1',
    icon: Building2,
    title: 'Create Your School Profile',
    description: 'Set up your school details, academic year, and basic scheduling parameters like period duration and school hours.',
    previewTitle: 'School Settings Page',
    previewDescription: 'Configure your school\'s basic information including name, academic year, daily schedule structure, and timezone. This forms the foundation for all your scheduling.',
    previewImage: (
      <div className="space-y-3">
        <div className="bg-slate-100 rounded-lg p-3">
          <div className="text-xs font-semibold text-slate-600 mb-2">School Information</div>
          <div className="space-y-2">
            <div className="bg-white rounded p-2 text-xs">School Name: International School</div>
            <div className="bg-white rounded p-2 text-xs">Academic Year: 2024-2025</div>
            <div className="bg-white rounded p-2 text-xs">Timezone: UTC+1</div>
          </div>
        </div>
        <div className="bg-slate-100 rounded-lg p-3">
          <div className="text-xs font-semibold text-slate-600 mb-2">Schedule Structure</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded p-2 text-xs">Periods/Day: 8</div>
            <div className="bg-white rounded p-2 text-xs">Duration: 45 min</div>
            <div className="bg-white rounded p-2 text-xs">Start Time: 8:00 AM</div>
            <div className="bg-white rounded p-2 text-xs">Days/Week: 5</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: '2',
    icon: Users,
    title: 'Add Teachers, Students & Subjects',
    description: 'Import or manually add your teachers with qualifications, students with subject choices, and all your IB subjects.',
    previewTitle: 'Data Management',
    previewDescription: 'Easily manage your school\'s personnel and curriculum. Add teachers with their qualifications, students with subject selections, and define all IB subjects across PYP, MYP, and DP programmes.',
    previewImage: (
      <div className="space-y-3">
        <div className="bg-slate-100 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-slate-600">Teachers (45)</div>
            <div className="px-2 py-1 bg-blue-900 text-white text-xs rounded">+ Add</div>
          </div>
          <div className="space-y-1">
            {['Dr. Sarah Johnson - Physics HL/SL', 'Mr. David Lee - Mathematics HL', 'Ms. Emma Brown - English A'].map((t, i) => (
              <div key={i} className="bg-white rounded p-2 text-xs flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500"></div>
                {t}
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-100 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-slate-900">327</div>
            <div className="text-xs text-slate-600">Students</div>
          </div>
          <div className="bg-slate-100 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-slate-900">24</div>
            <div className="text-xs text-slate-600">Subjects</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: '3',
    icon: Settings,
    title: 'Define Rules & Constraints',
    description: 'Set teacher availability, room requirements, student groupings, and any special scheduling rules.',
    previewTitle: 'Constraints Builder',
    previewDescription: 'Define scheduling rules and constraints to ensure optimal timetables. Set teacher preferences, room requirements, and custom rules that the AI will respect during generation.',
    previewImage: (
      <div className="space-y-2">
        {[
          { type: 'Teacher', rule: 'No more than 4 consecutive periods', status: 'Active' },
          { type: 'Room', rule: 'Science labs required for HL sciences', status: 'Active' },
          { type: 'Student', rule: 'DP students: minimum 1 hour lunch break', status: 'Active' },
          { type: 'IB', rule: 'HL subjects: 6 hours/week minimum', status: 'Active' },
        ].map((constraint, i) => (
          <div key={i} className="bg-white rounded-lg p-2 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-900">{constraint.rule}</div>
                <div className="text-xs text-slate-500">{constraint.type} Constraint</div>
              </div>
              <div className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">{constraint.status}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    number: '4',
    icon: Play,
    title: 'Generate Schedule',
    description: 'Click generate and watch the AI create a complete, conflict-free timetable in seconds.',
    previewTitle: 'AI Schedule Generator',
    previewDescription: 'Our AI engine analyzes all your data and constraints to generate optimal schedules in seconds. Watch real-time progress as it creates conflict-free timetables for all teachers and students.',
    previewImage: (
      <div className="space-y-3">
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 rounded-lg p-4 text-white text-center">
          <div className="text-2xl font-bold mb-1">Generate Schedule</div>
          <div className="text-xs opacity-90">AI-Powered Optimization</div>
        </div>
        <div className="space-y-2">
          {[
            { task: 'Analyzing constraints', progress: 100, status: 'Complete' },
            { task: 'Creating teaching groups', progress: 100, status: 'Complete' },
            { task: 'Assigning time slots', progress: 75, status: 'In Progress...' },
            { task: 'Optimizing schedule', progress: 0, status: 'Pending' },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded p-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-700">{item.task}</span>
                <span className="text-slate-500">{item.status}</span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: `${item.progress}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    number: '5',
    icon: CheckCircle,
    title: 'Review & Export',
    description: 'Review the schedule, make any adjustments, and export for students, teachers, and rooms.',
    previewTitle: 'Schedule Dashboard',
    previewDescription: 'View your completed schedule in multiple formats. Export customized timetables for teachers, students, and rooms. Make manual adjustments if needed.',
    previewImage: (
      <div className="space-y-3">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <div className="text-xs font-semibold text-green-900">Schedule Generated Successfully!</div>
          </div>
          <div className="text-xs text-green-700">0 conflicts • 100% satisfaction score</div>
        </div>
        <div className="grid grid-cols-5 gap-1 bg-white rounded-lg p-2 border border-slate-200">
          <div className="text-xs font-bold text-center text-slate-600 col-span-1">Time</div>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
            <div key={day} className="text-xs font-bold text-center text-slate-600">{day}</div>
          ))}
          <div className="text-xs text-slate-500">P1</div>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="bg-blue-100 text-blue-900 text-xs p-1 rounded text-center">Physics</div>
          ))}
          <div className="text-xs text-slate-500">P2</div>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="bg-purple-100 text-purple-900 text-xs p-1 rounded text-center">Math</div>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="flex-1 bg-blue-900 text-white text-xs py-2 rounded text-center">Export PDF</div>
          <div className="flex-1 bg-slate-700 text-white text-xs py-2 rounded text-center">Share</div>
        </div>
      </div>
    ),
  },
];

export default function HowItWorksSection() {
  const [selectedStep, setSelectedStep] = useState(0);
  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-transparent relative overflow-hidden">
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
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Steps List */}
          <div className="space-y-4">
            {steps.map((step, index) => (
              <motion.div 
                key={index} 
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <button
                  onClick={() => setSelectedStep(index)}
                  className={`w-full text-left transition-all duration-300 ${
                    selectedStep === index ? 'scale-105' : 'scale-100'
                  }`}
                >
                  <div className="flex gap-4 items-start">
                    {/* Step Number */}
                    <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white shadow-lg transition-all duration-300 ${
                      selectedStep === index 
                        ? 'bg-gradient-to-br from-purple-600 via-purple-500 to-blue-600 ring-4 ring-purple-400/50' 
                        : 'bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800'
                    }`}>
                      {step.number}
                    </div>

                    {/* Step Content */}
                    <div className={`flex-1 bg-white/70 backdrop-blur-md p-4 rounded-xl border-2 shadow-lg transition-all duration-300 ${
                      selectedStep === index 
                        ? 'border-purple-600 shadow-[0_0_0_2px_rgb(126,34,206),0_0_20px_rgba(126,34,206,0.3)]' 
                        : 'border-transparent hover:border-purple-400'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <step.icon className={`w-5 h-5 transition-colors ${selectedStep === index ? 'text-purple-600' : 'text-blue-900'}`} />
                        <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </div>

          {/* Preview Panel */}
          <div className="lg:sticky lg:top-24">
            <AnimatePresence mode="wait">
              <motion.div
                  key={selectedStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
                >
                  {/* Browser Chrome */}
                  <div className="bg-slate-800 px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="flex-1 bg-slate-700 rounded px-3 py-1 text-xs text-slate-300 text-center">
                      schedual.app/{steps[selectedStep].title.toLowerCase().replace(/\s+/g, '-')}
                    </div>
                  </div>

                  {/* Preview Content */}
                  <div className="p-6">
                    <h4 className="text-xl font-bold text-slate-900 mb-2">{steps[selectedStep].previewTitle}</h4>
                    <p className="text-sm text-slate-600 mb-6 leading-relaxed">{steps[selectedStep].previewDescription}</p>
                    
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      {steps[selectedStep].previewImage}
                    </div>
                  </div>
                </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}