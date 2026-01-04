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
  const [fullscreenIndex, setFullscreenIndex] = useState(null);
  const [isSticky, setIsSticky] = useState(false);
  const sectionRef = useRef(null);
  const textContainerRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current || !textContainerRef.current) return;

      const sectionRect = sectionRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const centerViewport = viewportHeight / 2;
      
      // Sticky starts when first card reaches center
      const firstCardOffset = 400;
      // Sticky ends before last few cards
      const lastCardOffset = 1200;
      
      const shouldStartSticky = sectionRect.top < (centerViewport - firstCardOffset);
      const shouldEndSticky = sectionRect.top < (centerViewport - lastCardOffset);
      
      // Only sticky between start and end points
      if (shouldStartSticky && !shouldEndSticky) {
        setIsSticky(true);
      } else {
        setIsSticky(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section ref={sectionRef} className="relative py-24 px-4 sm:px-6 lg:px-8 bg-transparent overflow-hidden">
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
            <div ref={textContainerRef} className={`lg:w-[400px] lg:shrink-0 transition-opacity duration-300 ${
              fullscreenIndex !== null ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}>
              <div className={`transition-all duration-300 ${
                isSticky 
                  ? 'lg:fixed lg:top-1/2 lg:-translate-y-1/2 lg:w-[400px] lg:left-[max(2rem,calc(50%-44rem))]' 
                  : ''
              }`}>
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
                  onClick={() => setFullscreenIndex(index)}
                  className="w-full text-left"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <div className={`bg-white/80 backdrop-blur-md rounded-2xl p-6 border-2 transition-all duration-300 max-w-xl h-48 flex items-center cursor-pointer ${
                    'border-slate-200 hover:border-blue-400 hover:shadow-md'
                  }`}>
                    <div className="flex items-start gap-4 w-full">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center flex-shrink-0`}>
                        <feature.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h4>
                        <p className="text-sm text-slate-600 leading-relaxed">{feature.description}</p>
                      </div>
                      </div>
                      </div>
                      </motion.button>
              </div>
            ))}
          </div>
          </div>
          </div>

          {/* Fullscreen Preview Modal */}
          <AnimatePresence>
          {fullscreenIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
            onClick={() => setFullscreenIndex(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative w-full max-w-6xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setFullscreenIndex(null)}
                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-900 flex items-center justify-center text-white transition-colors"
              >
                ✕
              </button>

              {/* Browser Chrome */}
              <div className="bg-slate-800 px-6 py-3 flex items-center gap-3">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="flex-1 bg-slate-700 rounded px-4 py-2 text-sm text-slate-300 text-center">
                  schedual.app/{fullscreenIndex === 0 ? 'dashboard' : fullscreenIndex === 3 ? 'schedule' : 'dashboard'}
                </div>
              </div>

              {/* Dashboard Preview Content */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-8 overflow-y-auto max-h-[calc(90vh-60px)]">
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                          <Users className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xs text-green-600 font-semibold">+12%</span>
                      </div>
                      <div className="text-3xl font-bold text-slate-900 mb-1">45</div>
                      <div className="text-sm text-slate-600">Active Teachers</div>
                    </div>
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                          <GraduationCap className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xs text-green-600 font-semibold">+8%</span>
                      </div>
                      <div className="text-3xl font-bold text-slate-900 mb-1">327</div>
                      <div className="text-sm text-slate-600">Students Enrolled</div>
                    </div>
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                          <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xs text-slate-600 font-semibold">24 active</span>
                      </div>
                      <div className="text-3xl font-bold text-slate-900 mb-1">24</div>
                      <div className="text-sm text-slate-600">Subject Offerings</div>
                    </div>
                  </div>

                  {/* Schedule Status */}
                  <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-slate-900">Current Schedule</h3>
                      <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">Active</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-slate-400" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-900">DP Schedule 2024-25</div>
                          <div className="text-xs text-slate-500">Last updated 2 hours ago</div>
                        </div>
                        <div className="text-sm font-semibold text-green-600">98% optimized</div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" style={{ width: '98%' }}></div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h3>
                    <div className="space-y-3">
                      {[
                        { status: 'success', title: 'Schedule published', desc: 'DP Schedule 2024-25 went live', time: '2h ago', icon: Calendar },
                        { status: 'pending', title: 'Group created', desc: 'Physics HL - Group B assigned', time: '5h ago', icon: Users },
                        { status: 'success', title: 'Teacher updated', desc: 'Dr. Smith availability changed', time: 'Yesterday', icon: Users },
                        { status: 'info', title: 'Room booked', desc: 'Lab 3 reserved for Chemistry', time: '2 days ago', icon: Building2 },
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            item.status === 'success' ? 'bg-green-100 text-green-600' :
                            item.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                            'bg-blue-100 text-blue-600'
                          }`}>
                            <item.icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900">{item.title}</div>
                            <div className="text-xs text-slate-500">{item.desc}</div>
                          </div>
                          <div className="text-xs text-slate-400 flex-shrink-0">{item.time}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'New Schedule', icon: Calendar, color: 'blue' },
                      { label: 'Add Teacher', icon: Users, color: 'purple' },
                      { label: 'Add Student', icon: GraduationCap, color: 'emerald' },
                      { label: 'Configure Room', icon: Building2, color: 'orange' },
                    ].map((action, i) => (
                      <button key={i} className="bg-white rounded-lg p-4 border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br from-${action.color}-500 to-${action.color}-600 flex items-center justify-center mb-2 mx-auto`}>
                          <action.icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-xs font-medium text-slate-700 text-center">{action.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
          )}
          </AnimatePresence>
          </section>
          );
          }