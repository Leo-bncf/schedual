import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Users, GraduationCap, BookOpen, Building2, ChevronDown } from 'lucide-react';

const features = [
  {
    icon: Building2,
    title: 'Beautifully streamlined processes to increase your school\'s efficiency',
    description: 'Ditch the hassle of patchwork solutions that slow you down and hinder communication. Automate administrative tasks, reduce manual data entry, and free up valuable time for what matters most—teaching and learning.',
    color: 'from-blue-900 to-blue-800',
  },
  {
    icon: Users,
    title: 'Bring your community together!',
    description: 'From announcements to progress tracking, we keep your community connected. Parents, teachers, and students stay informed with real-time updates, transparent communication channels, and collaborative tools that foster engagement.',
    color: 'from-blue-900 to-blue-800',
  },
  {
    icon: BookOpen,
    title: 'Craft exceptional education experiences',
    description: 'Manage your teaching journey—from curriculum planning to report cards—in one simple solution. Track learning objectives, monitor student progress, and deliver personalized feedback that drives academic excellence.',
    color: 'from-blue-900 to-blue-800',
  },
  {
    icon: Calendar,
    title: 'Intelligent scheduling with AI optimization',
    description: 'Our advanced AI engine automatically generates conflict-free timetables that respect teacher availability, room constraints, and IB programme requirements. What used to take weeks now takes minutes, with smart suggestions that improve over time.',
    color: 'from-blue-900 to-blue-800',
  },
  {
    icon: GraduationCap,
    title: 'Complete IB programme compliance',
    description: 'Built specifically for PYP, MYP, and DP programmes. Automatically validate subject group requirements, HL/SL balance, core component allocation, and teaching hour requirements. Stay compliant with IB standards effortlessly.',
    color: 'from-blue-900 to-blue-800',
  },
  {
    icon: Users,
    title: 'Dynamic teaching group management',
    description: 'Create and manage teaching groups with intelligent student assignment. Handle mixed-level classes, track group sizes, manage subject choices, and ensure every student gets the right level of instruction for their learning journey.',
    color: 'from-blue-900 to-blue-800',
  },
  {
    icon: Building2,
    title: 'Smart resource allocation',
    description: 'Optimize room usage, manage specialized facilities like labs and studios, and ensure resources are allocated efficiently. Track equipment availability, capacity constraints, and room preferences to maximize your school\'s physical infrastructure.',
    color: 'from-blue-900 to-blue-800',
  },
  {
    icon: Calendar,
    title: 'Real-time conflict detection',
    description: 'Instantly identify scheduling conflicts before they become problems. Our system checks for teacher double-bookings, room conflicts, student timetable clashes, and IB requirement violations in real-time, with actionable suggestions to resolve them.',
    color: 'from-blue-900 to-blue-800',
  },
  {
    icon: BookOpen,
    title: 'Comprehensive teacher workload balancing',
    description: 'Ensure fair distribution of teaching hours, respect maximum consecutive periods, honor preferred free days, and track unavailable time slots. Keep your teachers happy and effective with balanced, sustainable schedules.',
    color: 'from-blue-900 to-blue-800',
  },
  {
    icon: GraduationCap,
    title: 'Student-centric scheduling',
    description: 'Prioritize student needs with personalized timetables that accommodate individual subject choices, support special requirements, and maintain proper balance across IB subject groups. Every student gets a schedule designed for their success.',
    color: 'from-blue-900 to-blue-800',
  },
];

export default function DashboardPreview() {
  const [expandedIndex, setExpandedIndex] = useState(null);

  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8 bg-transparent overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            See It In Action
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Explore the features that make scheduling effortless
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="relative flex flex-col lg:flex-row gap-8">
            {/* Left Column - Text */}
            <div className="lg:w-[400px] lg:shrink-0">
              <div className="lg:sticky lg:top-1/2 lg:-translate-y-1/2">
                <div className="text-sm font-semibold text-purple-600 mb-3">Benefits</div>
                <h3 className="text-4xl font-bold text-slate-900 mb-6">
                  Everything you need in one place
                </h3>
                <p className="text-lg text-slate-600 leading-relaxed mb-4">
                  Schedual brings together all the tools you need to manage your IB school efficiently. From scheduling to communication, we've got you covered.
                </p>
                <p className="text-base text-slate-600 leading-relaxed mb-6">
                  No more juggling between spreadsheets, emails, and outdated scheduling tools. Our platform consolidates everything into one seamless experience—built specifically for the complexities of IB programmes across PYP, MYP, and DP levels.
                </p>
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
                  <div className="text-sm font-semibold text-blue-900 mb-3">Built by IB Students, for IB Students</div>
                  <p className="text-slate-700 leading-relaxed">
                    We understand the unique challenges of IB scheduling because we've lived them. Our solution was born from real IB student experiences, designed to solve the complex timetabling problems that traditional tools can't handle. We know the pain of conflicting HL classes, the challenge of balancing CAS commitments, and the complexity of managing subject groups across multiple grade levels.
                  </p>
                </div>
              </div>
            </div>

          {/* Right Column - Feature Cards */}
          <div className="flex-1 space-y-8 lg:min-w-0">
            {features.map((feature, index) => (
              <div key={index}>
                <motion.button
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                  className="w-full text-left"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <div className={`bg-white/80 backdrop-blur-md rounded-2xl p-6 border-2 transition-all duration-300 max-w-xl h-48 flex items-center ${
                    expandedIndex === index 
                      ? 'border-blue-600 shadow-lg' 
                      : 'border-slate-200 hover:border-blue-400 hover:shadow-md'
                  }`}>
                    <div className="flex items-start gap-4 w-full">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center flex-shrink-0`}>
                        <feature.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h4>
                        <p className="text-sm text-slate-600 leading-relaxed">{feature.description}</p>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 flex-shrink-0 mt-1 ${
                        expandedIndex === index ? 'rotate-180' : ''
                      }`} />
                    </div>
                  </div>
                </motion.button>

                {/* Expanded Screenshot */}
                <AnimatePresence>
                  {expandedIndex === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 px-2">
                        <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
                          {/* Browser Chrome */}
                          <div className="bg-slate-800 px-4 py-2 flex items-center gap-2">
                            <div className="flex gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                            </div>
                            <div className="flex-1 bg-slate-700 rounded px-3 py-1 text-xs text-slate-300 text-center">
                              schedual.app/dashboard
                            </div>
                          </div>

                          {/* Screenshot Content */}
                          <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6">
                            <div className="grid grid-cols-3 gap-3 mb-4">
                              <div className="bg-white rounded-lg p-3 border border-slate-200">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-2">
                                  <Users className="w-4 h-4 text-white" />
                                </div>
                                <div className="text-2xl font-bold text-slate-900">45</div>
                                <div className="text-xs text-slate-600">Teachers</div>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-slate-200">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-2">
                                  <GraduationCap className="w-4 h-4 text-white" />
                                </div>
                                <div className="text-2xl font-bold text-slate-900">327</div>
                                <div className="text-xs text-slate-600">Students</div>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-slate-200">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-2">
                                  <BookOpen className="w-4 h-4 text-white" />
                                </div>
                                <div className="text-2xl font-bold text-slate-900">24</div>
                                <div className="text-xs text-slate-600">Subjects</div>
                              </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 border border-slate-200">
                              <div className="text-sm font-semibold text-slate-900 mb-3">Recent Activity</div>
                              <div className="space-y-2">
                                {[
                                  { status: 'success', title: 'DP Schedule 2024-25', time: '2h ago' },
                                  { status: 'pending', title: 'MYP Schedule Draft', time: 'Yesterday' },
                                ].map((item, i) => (
                                  <div key={i} className="flex items-center gap-3 p-2 rounded bg-slate-50">
                                    <div className={`w-2 h-2 rounded-full ${item.status === 'success' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                                    <div className="flex-1">
                                      <div className="text-xs font-medium text-slate-900">{item.title}</div>
                                      <div className="text-xs text-slate-500">{item.time}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}