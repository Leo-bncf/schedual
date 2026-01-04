import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Users, GraduationCap, BookOpen, Building2, Clock, AlertCircle, CheckCircle, TrendingUp, Award, Bell, FileText, BarChart3, X } from 'lucide-react';

const features = [
  {
    icon: Building2,
    title: 'Complete School Management',
    shortDesc: 'Real-time insights and automated workflows',
    description: 'Get a 360° view of your entire school operations with real-time insights, automated workflows, and intelligent analytics that help you make data-driven decisions instantly.',
    color: 'from-blue-500 to-blue-700',
    accentColor: 'blue',
  },
  {
    icon: Calendar,
    title: 'AI-Powered Scheduling',
    shortDesc: 'Generate perfect timetables in minutes',
    description: 'Generate conflict-free timetables in minutes with our advanced AI engine. Automatically optimizes for teacher preferences, room availability, and IB requirements.',
    color: 'from-indigo-500 to-indigo-700',
    accentColor: 'indigo',
  },
  {
    icon: Users,
    title: 'Unified Communication',
    shortDesc: 'Keep everyone connected in real-time',
    description: 'Connect parents, teachers, and students through a centralized hub for announcements, updates, and real-time notifications.',
    color: 'from-purple-500 to-purple-700',
    accentColor: 'purple',
  },
  {
    icon: BookOpen,
    title: 'Curriculum Tracking',
    shortDesc: 'Monitor progress and assessments',
    description: 'Monitor teaching progress, track learning objectives, manage IB assessments, and ensure curriculum compliance with detailed analytics.',
    color: 'from-emerald-500 to-emerald-700',
    accentColor: 'emerald',
  },
  {
    icon: GraduationCap,
    title: 'IB Compliance Engine',
    shortDesc: 'Automatic validation for all requirements',
    description: 'Automatically validate all IB requirements including subject groups, HL/SL ratios, core components, and teaching hours for PYP, MYP, and DP.',
    color: 'from-pink-500 to-pink-700',
    accentColor: 'pink',
  },
  {
    icon: TrendingUp,
    title: 'Workload Balancing',
    shortDesc: 'Fair distribution for sustainable teaching',
    description: 'Ensure fair distribution of teaching hours, respect maximum periods, honor availability preferences, and maintain sustainable workloads.',
    color: 'from-cyan-500 to-cyan-700',
    accentColor: 'cyan',
  },
];

export default function DashboardPreview() {
  const [selectedFeature, setSelectedFeature] = useState(null);

  const renderPreview = (index) => {
    switch(index) {
      case 0: // Dashboard
        return (
          <div className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-3">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-6 text-white shadow-xl">
                <Users className="w-10 h-10 mb-4 opacity-90" />
                <div className="text-5xl font-black mb-2">45</div>
                <div className="text-sm font-semibold opacity-90">Active Teachers</div>
                <div className="text-xs opacity-75 mt-1">38 full-time • 7 part-time</div>
              </motion.div>
              
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl p-6 text-white shadow-xl">
                <GraduationCap className="w-10 h-10 mb-4 opacity-90" />
                <div className="text-5xl font-black mb-2">327</div>
                <div className="text-sm font-semibold opacity-90">Total Students</div>
                <div className="text-xs opacity-75 mt-1">DP: 181 • MYP: 146</div>
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="bg-white rounded-xl border-2 border-emerald-300 shadow-lg">
              <div className="bg-gradient-to-r from-emerald-500 to-blue-500 p-4 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-black text-lg mb-1">Active Schedule</div>
                    <div className="text-sm opacity-90">DP Programme 2024-25</div>
                  </div>
                  <div className="text-4xl font-black">98</div>
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: 'Conflicts', value: '0', icon: '✓' },
                    { label: 'Coverage', value: '100%', icon: '📚' },
                    { label: 'Rooms', value: '94%', icon: '🏢' },
                    { label: 'Balance', value: 'A+', icon: '⚖️' },
                    { label: 'IB Valid', value: '✓', icon: '🎓' }
                  ].map((m, i) => (
                    <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 + i * 0.05 }}
                      className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
                      <div className="text-lg mb-1">{m.icon}</div>
                      <div className="text-xl font-bold text-slate-900">{m.value}</div>
                      <div className="text-[9px] font-semibold text-slate-600">{m.label}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: '📊', value: '24', label: 'Subjects' },
                { icon: '🎓', value: '18', label: 'Groups' },
                { icon: '🏢', value: '18', label: 'Rooms' },
                { icon: '⏱️', value: '240', label: 'Periods' }
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.05 }}
                  className="bg-gradient-to-br from-slate-50 to-white rounded-lg p-3 border-2 border-slate-200 text-center">
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="text-2xl font-black text-slate-900">{s.value}</div>
                  <div className="text-[10px] font-bold text-slate-600">{s.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 1: // Scheduling
        return (
          <div className="space-y-4 p-6">
            <div className="bg-white rounded-xl border-2 border-slate-200 p-2 shadow-lg">
              <div className="grid grid-cols-6 gap-1">
                <div></div>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, idx) => (
                  <motion.div key={day} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                    className="text-xs font-black text-slate-800 text-center py-2 bg-slate-100 rounded">
                    {day}
                  </motion.div>
                ))}
                {[
                  { period: 'P1', time: '08:00' },
                  { period: 'P2', time: '09:00' },
                  { period: 'Break', isBreak: true },
                  { period: 'P3', time: '10:20' }
                ].map((slot, periodIdx) => (
                  <React.Fragment key={periodIdx}>
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: periodIdx * 0.05 }}
                      className="flex flex-col justify-center text-center py-2 bg-slate-50 rounded">
                      <div className="text-[10px] font-black text-slate-900">{slot.period}</div>
                      {slot.time && <div className="text-[8px] text-slate-600">{slot.time}</div>}
                    </motion.div>
                    {slot.isBreak ? (
                      [...Array(5)].map((_, i) => (
                        <div key={i} className="bg-slate-100 rounded flex items-center justify-center">
                          <span className="text-sm">☕</span>
                        </div>
                      ))
                    ) : (
                      [
                        { subject: 'Physics HL', color: 'from-blue-500 to-blue-600' },
                        { subject: 'Math AA', color: 'from-purple-500 to-purple-600' },
                        { subject: 'English A', color: 'from-emerald-500 to-emerald-600' },
                        { subject: 'Chemistry', color: 'from-orange-500 to-orange-600' },
                        { subject: 'TOK', color: 'from-pink-500 to-pink-600' }
                      ].map((cls, i) => (
                        <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: (periodIdx * 5 + i) * 0.02 }}
                          className={`rounded-lg p-2 bg-gradient-to-br ${cls.color} text-white shadow-md`}>
                          <div className="text-[10px] font-bold">{cls.subject}</div>
                        </motion.div>
                      ))
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        );

      case 2: // Communication
        return (
          <div className="space-y-3 p-6">
            {[
              { title: 'Parent-Teacher Conferences', desc: 'Booking now open for January 15-17', time: '2h ago', color: 'blue' },
              { title: 'DP2 Report Cards Published', desc: 'All students received Term 1 reports', time: '5h ago', color: 'emerald' },
              { title: 'Science Fair 2025', desc: '47 student projects approved', time: '1d ago', color: 'purple' }
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                className="bg-white rounded-xl p-4 border-2 border-slate-200 hover:shadow-lg transition-all">
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br from-${item.color}-400 to-${item.color}-600 flex items-center justify-center flex-shrink-0 shadow-md`}>
                    <Bell className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-900 mb-1">{item.title}</div>
                    <div className="text-xs text-slate-600 mb-2">{item.desc}</div>
                    <div className="text-xs text-slate-500">{item.time}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        );

      case 3: // Curriculum
        return (
          <div className="space-y-3 p-6">
            {[
              { subject: 'Physics HL', progress: 75, color: 'blue' },
              { subject: 'Math AA SL', progress: 90, color: 'purple' },
              { subject: 'English A', progress: 60, color: 'emerald' },
              { subject: 'Chemistry HL', progress: 85, color: 'orange' }
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                className="bg-white rounded-xl p-4 border-2 border-slate-200">
                <div className="text-sm font-bold text-slate-900 mb-3">{item.subject}</div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-600">Progress</span>
                  <span className="font-bold">{item.progress}%</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${item.progress}%` }} transition={{ delay: i * 0.1 + 0.2, duration: 0.8 }}
                    className={`h-full bg-gradient-to-r from-${item.color}-400 to-${item.color}-600 rounded-full`}/>
                </div>
              </motion.div>
            ))}
          </div>
        );

      case 4: // IB Compliance
        return (
          <div className="space-y-4 p-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-50 rounded-xl p-5 border-2 border-emerald-200">
              <div className="flex justify-between items-center mb-4">
                <div className="text-lg font-black text-slate-900">DP Programme</div>
                <div className="px-3 py-1 bg-emerald-500 text-white rounded-full text-xs font-bold">
                  ✓ Compliant
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Subject Groups', status: '✓ All 6' },
                  { label: 'HL/SL Balance', status: '✓ Valid' },
                  { label: 'Teaching Hours', status: '✓ Met' },
                  { label: 'Core Components', status: '✓ Complete' }
                ].map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                    className="bg-white rounded-lg p-3 border border-slate-200">
                    <div className="text-xs font-bold text-slate-900 mb-1">{item.label}</div>
                    <div className="text-xs text-emerald-600 font-bold">{item.status}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        );

      case 5: // Workload
        return (
          <div className="space-y-3 p-6">
            {[
              { name: 'Dr. Peterson', hours: '24/25h', load: 96 },
              { name: 'Ms. Thompson', hours: '22/25h', load: 88 },
              { name: 'Mr. Kumar', hours: '23/25h', load: 92 }
            ].map((teacher, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                className="bg-white rounded-xl p-4 border-2 border-slate-200">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-bold text-slate-900">{teacher.name}</span>
                  <span className="text-xs font-bold text-slate-700">{teacher.hours}</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${teacher.load}%` }} transition={{ delay: i * 0.1 + 0.2, duration: 0.8 }}
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"/>
                </div>
              </motion.div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-block px-4 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold mb-4">
              Platform Features
            </div>
            <h2 className="text-5xl font-black text-slate-900 mb-6">
              See It In Action
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              Explore our powerful features designed specifically for IB schools. Click any card to see it in action.
            </p>
          </motion.div>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              onClick={() => setSelectedFeature(index)}
              className="group relative bg-white rounded-2xl p-6 border-2 border-slate-200 hover:border-blue-400 hover:shadow-2xl transition-all duration-300 text-left overflow-hidden"
            >
              {/* Gradient background on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
              
              <div className="relative">
                {/* Icon */}
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {feature.shortDesc}
                </p>

                {/* Arrow indicator */}
                <div className="mt-4 flex items-center text-sm font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>View Demo</span>
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Built by IB Students Badge */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-2xl p-8 border-2 border-blue-100 shadow-xl">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                <Award className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 mb-3">Built by IB Students, for IB Students</h3>
                <p className="text-slate-700 leading-relaxed mb-4">
                  We understand the unique challenges of IB scheduling because we've lived them. Our solution was born from real IB student experiences, designed to solve the complex timetabling problems that traditional tools can't handle.
                </p>
                <p className="text-slate-600 text-sm">
                  We know the pain of conflicting HL classes, the challenge of balancing CAS commitments, and the complexity of managing subject groups across multiple grade levels. That's why we built Schedual.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Feature Detail Modal */}
        <AnimatePresence>
          {selectedFeature !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedFeature(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", duration: 0.5 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
              >
                {/* Header */}
                <div className={`bg-gradient-to-r ${features[selectedFeature].color} p-6 text-white relative overflow-hidden`}>
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ['-200%', '200%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  />
                  <div className="relative flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        {React.createElement(features[selectedFeature].icon, { className: "w-8 h-8" })}
                      </div>
                      <div>
                        <h3 className="text-2xl font-black mb-2">{features[selectedFeature].title}</h3>
                        <p className="text-sm opacity-90">{features[selectedFeature].description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedFeature(null)}
                      className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors flex items-center justify-center"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Preview Content */}
                <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6">
                    <div className="bg-white rounded-xl border-2 border-slate-200 shadow-lg">
                      {renderPreview(selectedFeature)}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}