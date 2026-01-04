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
        <div className={`relative transition-all duration-500 ${expandedIndex !== null ? '' : 'flex flex-col lg:flex-row gap-8'}`}>
            {/* Left Column - Text */}
            <div ref={textContainerRef} className={`lg:w-[400px] lg:shrink-0 transition-opacity duration-300 ${
          expandedIndex !== null ? 'opacity-0 pointer-events-none absolute' : 'opacity-100'
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
          <div className={`space-y-8 transition-all duration-500 ${
            expandedIndex !== null ? 'w-full' : 'flex-1 lg:min-w-0'
          }`}>
            {features.map((feature, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`transition-all duration-500 ${
                  expandedIndex === index ? 'w-full' : 'max-w-xl'
                }`}
              >
                <button
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                  className="w-full text-left"
                >
                  <div className={`bg-white/80 backdrop-blur-md rounded-2xl p-6 border-2 transition-all duration-300 cursor-pointer ${
                    expandedIndex === index 
                      ? 'border-blue-600 shadow-xl h-auto' 
                      : 'border-slate-200 hover:border-blue-400 hover:shadow-md h-48'
                  } flex items-center`}>
                    <div className="flex items-start gap-4 w-full">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center flex-shrink-0`}>
                        <feature.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h4>
                        {expandedIndex !== index && (
                          <p className="text-sm text-slate-600 leading-relaxed">{feature.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {expandedIndex === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0, scale: 0.95 }}
                      animate={{ height: 'auto', opacity: 1, scale: 1 }}
                      exit={{ height: 0, opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="mt-6 bg-white rounded-2xl shadow-2xl border-2 border-blue-200 overflow-hidden min-h-[700px]">
                        <div className="grid lg:grid-cols-3 gap-0">
                          {/* Left side - Preview */}
                          <div className="lg:col-span-2 bg-gradient-to-br from-slate-50 to-slate-100 p-8">
                            {/* Browser Chrome */}
                            <div className="bg-slate-800 rounded-t-lg px-4 py-2 flex items-center gap-2 mb-6">
                              <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                              </div>
                              <div className="flex-1 bg-slate-700 rounded px-3 py-1 text-xs text-slate-300 text-center">
                                schedual.app/{['dashboard', 'community', 'curriculum', 'schedule', 'compliance', 'groups', 'resources', 'conflicts', 'workload', 'student-schedules'][index]}
                              </div>
                            </div>

                            {/* Preview Content - Different for each feature */}
                            <div className="bg-white rounded-lg border border-slate-200 p-6 min-h-[550px]">
                              {index === 0 && (
                                <div className="space-y-4">
                                  {/* Top Stats Row */}
                                  <div className="grid grid-cols-4 gap-3">
                                    {[
                                      { icon: Users, value: '45', label: 'Teachers', color: 'from-blue-500 to-blue-600', change: '+3 this term', trend: 'up' },
                                      { icon: GraduationCap, value: '327', label: 'Students', color: 'from-purple-500 to-purple-600', change: '+26 vs last year', trend: 'up' },
                                      { icon: BookOpen, value: '24', label: 'Subjects', color: 'from-emerald-500 to-emerald-600', change: '6 new courses', trend: 'up' },
                                      { icon: Building2, value: '18', label: 'Rooms', color: 'from-orange-500 to-orange-600', change: '94% utilized', trend: 'up' }
                                    ].map((stat, i) => (
                                      <motion.div 
                                        key={i} 
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.08 + 0.2 }}
                                        className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group"
                                      >
                                        <div className="flex items-start justify-between mb-3">
                                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow`}>
                                            <stat.icon className="w-5 h-5 text-white" />
                                          </div>
                                          <div className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${stat.trend === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {stat.trend === 'up' ? '↗' : '↘'}
                                          </div>
                                        </div>
                                        <div className="text-2xl font-bold text-slate-900 mb-0.5">{stat.value}</div>
                                        <div className="text-xs text-slate-600 font-medium mb-1">{stat.label}</div>
                                        <div className="text-[10px] text-slate-500">{stat.change}</div>
                                      </motion.div>
                                    ))}
                                  </div>

                                  {/* Active Schedule Card */}
                                  <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 }}
                                    className="bg-gradient-to-br from-blue-50 via-white to-purple-50 rounded-xl p-5 border border-blue-200 shadow-sm"
                                  >
                                    <div className="flex items-start justify-between mb-4">
                                      <div>
                                        <div className="flex items-center gap-2 mb-1">
                                          <Calendar className="w-4 h-4 text-blue-600" />
                                          <div className="text-sm font-bold text-slate-900">Active Schedule: DP 2024-25 Term 1</div>
                                        </div>
                                        <div className="text-xs text-slate-600">Generated 2 hours ago • Auto-optimized by AI</div>
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        <div className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-sm">98% Quality</div>
                                        <div className="text-[10px] text-emerald-700 font-semibold">Excellent</div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-5 gap-2 mb-4">
                                      <div className="bg-white/70 backdrop-blur rounded-lg p-3 border border-slate-200">
                                        <div className="text-[10px] text-slate-600 mb-1">Conflicts</div>
                                        <div className="text-xl font-bold text-emerald-600">0</div>
                                        <div className="text-[9px] text-slate-500">Zero issues</div>
                                      </div>
                                      <div className="bg-white/70 backdrop-blur rounded-lg p-3 border border-slate-200">
                                        <div className="text-[10px] text-slate-600 mb-1">Teachers</div>
                                        <div className="text-xl font-bold text-blue-600">45/45</div>
                                        <div className="text-[9px] text-slate-500">All assigned</div>
                                      </div>
                                      <div className="bg-white/70 backdrop-blur rounded-lg p-3 border border-slate-200">
                                        <div className="text-[10px] text-slate-600 mb-1">Rooms</div>
                                        <div className="text-xl font-bold text-purple-600">94%</div>
                                        <div className="text-[9px] text-slate-500">Utilization</div>
                                      </div>
                                      <div className="bg-white/70 backdrop-blur rounded-lg p-3 border border-slate-200">
                                        <div className="text-[10px] text-slate-600 mb-1">IB Req.</div>
                                        <div className="text-xl font-bold text-emerald-600">✓</div>
                                        <div className="text-[9px] text-slate-500">Compliant</div>
                                      </div>
                                      <div className="bg-white/70 backdrop-blur rounded-lg p-3 border border-slate-200">
                                        <div className="text-[10px] text-slate-600 mb-1">Balance</div>
                                        <div className="text-xl font-bold text-blue-600">A+</div>
                                        <div className="text-[9px] text-slate-500">Workload</div>
                                      </div>
                                    </div>

                                    <div className="space-y-1.5">
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-600 font-medium">Overall Quality Score</span>
                                        <span className="font-bold text-slate-900">98/100</span>
                                      </div>
                                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <motion.div 
                                          initial={{ width: 0 }}
                                          animate={{ width: '98%' }}
                                          transition={{ delay: 0.7, duration: 1.2, ease: "easeOut" }}
                                          className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-full relative overflow-hidden"
                                        >
                                          <motion.div
                                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
                                            animate={{ x: ['-100%', '100%'] }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                          />
                                        </motion.div>
                                      </div>
                                    </div>
                                  </motion.div>

                                  {/* Quick Stats Grid */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <motion.div
                                      initial={{ opacity: 0, x: -20 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: 0.8 }}
                                      className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
                                    >
                                      <div className="flex items-center gap-3 mb-3">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                                          <span className="text-white text-sm">⚠️</span>
                                        </div>
                                        <div className="text-sm font-bold text-slate-900">2 Warnings</div>
                                      </div>
                                      <div className="space-y-2 text-xs text-slate-600">
                                        <div className="flex items-start gap-2">
                                          <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></div>
                                          <span>Dr. Chen: 4 consecutive periods Wed (P3-P6)</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                          <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></div>
                                          <span>Lab 3: 85% capacity for Chemistry HL Group B</span>
                                        </div>
                                      </div>
                                    </motion.div>

                                    <motion.div
                                      initial={{ opacity: 0, x: 20 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: 0.8 }}
                                      className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-4 border border-emerald-200 shadow-sm"
                                    >
                                      <div className="flex items-center gap-3 mb-3">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                                          <span className="text-white text-sm">✓</span>
                                        </div>
                                        <div className="text-sm font-bold text-slate-900">IB Compliance</div>
                                      </div>
                                      <div className="space-y-2 text-xs text-slate-600">
                                        <div className="flex justify-between">
                                          <span>HL Subjects (6h/week)</span>
                                          <span className="font-semibold text-emerald-600">✓ 12/12</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>SL Subjects (4h/week)</span>
                                          <span className="font-semibold text-emerald-600">✓ 12/12</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Core (TOK, CAS, EE)</span>
                                          <span className="font-semibold text-emerald-600">✓ All</span>
                                        </div>
                                      </div>
                                    </motion.div>
                                  </div>

                                  {/* Recent Activity */}
                                  <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 1 }}
                                    className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
                                  >
                                    <div className="text-sm font-bold text-slate-900 mb-3">Recent Activity</div>
                                    <div className="space-y-2">
                                      {[
                                        { action: 'Schedule Published', detail: 'DP 2024-25 Term 1 went live', time: '2h ago', icon: Calendar, color: 'emerald' },
                                        { action: 'Group Updated', detail: 'Physics HL Group B: +2 students', time: '4h ago', icon: Users, color: 'blue' },
                                        { action: 'Room Changed', detail: 'Math AA moved to larger room R-204', time: '6h ago', icon: Building2, color: 'purple' }
                                      ].map((activity, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br from-${activity.color}-400 to-${activity.color}-600 flex items-center justify-center flex-shrink-0`}>
                                            <activity.icon className="w-3.5 h-3.5 text-white" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-xs font-semibold text-slate-900">{activity.action}</div>
                                            <div className="text-[10px] text-slate-600">{activity.detail}</div>
                                          </div>
                                          <div className="text-[10px] text-slate-400 flex-shrink-0">{activity.time}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>

                                  {/* Subject Groups Breakdown */}
                                  <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 1.1 }}
                                    className="bg-gradient-to-br from-indigo-50 to-white rounded-xl p-4 border border-indigo-200 shadow-sm"
                                  >
                                    <div className="text-sm font-bold text-slate-900 mb-3">IB Subject Groups Distribution</div>
                                    <div className="grid grid-cols-3 gap-2">
                                      {[
                                        { group: 'Group 1', name: 'Lang & Lit', students: 327, color: 'red' },
                                        { group: 'Group 2', name: 'Lang Acq', students: 245, color: 'orange' },
                                        { group: 'Group 3', name: 'Individuals', students: 198, color: 'amber' },
                                        { group: 'Group 4', name: 'Sciences', students: 289, color: 'emerald' },
                                        { group: 'Group 5', name: 'Math', students: 327, color: 'blue' },
                                        { group: 'Group 6', name: 'Arts', students: 124, color: 'purple' }
                                      ].map((grp, i) => (
                                        <div key={i} className="bg-white rounded-lg p-3 border border-slate-200">
                                          <div className={`text-[10px] font-bold text-${grp.color}-600 mb-1`}>{grp.group}</div>
                                          <div className="text-xs text-slate-900 font-semibold mb-1">{grp.name}</div>
                                          <div className="text-lg font-bold text-slate-900">{grp.students}</div>
                                          <div className="text-[9px] text-slate-500">enrollments</div>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                </div>
                              )}
                              {index === 1 && (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between mb-5">
                                    <div>
                                      <h4 className="text-lg font-semibold text-slate-900">Communication Hub</h4>
                                      <p className="text-xs text-slate-600 mt-1">Real-time updates across your entire school community</p>
                                    </div>
                                    <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">8 New Updates</div>
                                  </div>
                                  {[
                                    { type: 'announcement', title: 'Parent-Teacher Conference Schedule Published', desc: 'Conferences scheduled for January 15-17. Parents can now book 15-minute slots through the portal.', time: '2h ago', user: 'Sarah Mitchell, Admin', color: 'blue', reactions: 24 },
                                    { type: 'update', title: 'DP2 Report Cards & Predicted Grades Released', desc: 'All DP2 students can now access their Term 1 reports and IB predicted grades. Average: 36 points.', time: '5h ago', user: 'Mr. Johnson, DP Coordinator', color: 'emerald', reactions: 67 },
                                    { type: 'event', title: 'Science Fair: "Innovations for Tomorrow"', desc: 'MYP and DP students to present 47 projects. Guest judges from local universities confirmed.', time: '1d ago', user: 'Dr. Chen, Science Dept Head', color: 'purple', reactions: 52 },
                                    { type: 'message', title: 'DP1 Extended Essay Workshop Schedule', desc: 'Three workshops scheduled: Research methods (Jan 10), Academic writing (Jan 17), Citations (Jan 24).', time: '2d ago', user: 'Mrs. Davis, EE Coordinator', color: 'amber', reactions: 31 }
                                  ].map((item, i) => (
                                    <motion.div 
                                      key={i}
                                      initial={{ opacity: 0, x: -20 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: i * 0.1 + 0.2 }}
                                      className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-r from-slate-50 to-white border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all cursor-pointer"
                                    >
                                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br from-${item.color}-400 to-${item.color}-600 flex items-center justify-center flex-shrink-0 shadow-sm`}>
                                        <Users className="w-5 h-5 text-white" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-slate-900 mb-1">{item.title}</div>
                                        <div className="text-xs text-slate-600 leading-relaxed mb-2">{item.desc}</div>
                                        <div className="flex items-center gap-3 text-xs text-slate-500">
                                          <span>Posted by {item.user}</span>
                                          <span>•</span>
                                          <span>{item.time}</span>
                                          <span>•</span>
                                          <span>{item.reactions} reactions</span>
                                        </div>
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              )}
                              {index === 2 && (
                                <div className="space-y-5">
                                  <div>
                                    <h4 className="text-lg font-semibold text-slate-900 mb-1">Curriculum Management & Teaching Progress</h4>
                                    <p className="text-xs text-slate-600">Track learning objectives, unit completion, and IB assessment alignment</p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    {[
                                      { subject: 'Physics HL', teacher: 'Dr. Peterson', progress: 75, units: '6/8 units', color: 'blue', nextTopic: 'Quantum Physics', assessments: '3 IAs completed', hours: '54/72 hours' },
                                      { subject: 'Math AA SL', teacher: 'Mr. Kumar', progress: 90, units: '7/8 units', color: 'purple', nextTopic: 'Calculus Review', assessments: 'IA in progress', hours: '36/48 hours' },
                                      { subject: 'English A Lang & Lit', teacher: 'Ms. Thompson', progress: 60, units: '5/8 units', color: 'emerald', nextTopic: 'Poetry Analysis', assessments: 'IO completed: 15/20', hours: '28/48 hours' },
                                      { subject: 'Chemistry HL', teacher: 'Dr. Chen', progress: 85, units: '7/8 units', color: 'orange', nextTopic: 'Organic Chemistry', assessments: 'Group 4 project done', hours: '64/72 hours' }
                                    ].map((item, i) => (
                                      <motion.div 
                                        key={i}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.1 + 0.2 }}
                                        className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-5 border border-slate-100 hover:shadow-lg transition-all"
                                      >
                                        <div className="flex items-start justify-between mb-3">
                                          <div>
                                            <div className="text-sm font-bold text-slate-900">{item.subject}</div>
                                            <div className="text-xs text-slate-600 mt-0.5">{item.teacher}</div>
                                          </div>
                                          <div className="text-xs font-bold text-slate-600 bg-white rounded-full px-2 py-1 border border-slate-200">{item.units}</div>
                                        </div>
                                        <div className="space-y-2 mb-3">
                                          <div className="flex justify-between text-xs text-slate-600">
                                            <span>Progress</span>
                                            <span className="font-semibold">{item.progress}%</span>
                                          </div>
                                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div 
                                              initial={{ width: 0 }}
                                              animate={{ width: `${item.progress}%` }}
                                              transition={{ delay: i * 0.1 + 0.5, duration: 0.8 }}
                                              className={`h-full bg-gradient-to-r from-${item.color}-400 to-${item.color}-600 rounded-full`}
                                            />
                                          </div>
                                        </div>
                                        <div className="space-y-1.5 text-xs">
                                          <div className="flex items-center gap-2 text-slate-600">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                            <span>Next: {item.nextTopic}</span>
                                          </div>
                                          <div className="flex items-center gap-2 text-slate-600">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                                            <span>{item.assessments}</span>
                                          </div>
                                          <div className="flex items-center gap-2 text-slate-600">
                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                                            <span>{item.hours}</span>
                                          </div>
                                        </div>
                                      </motion.div>
                                    ))}
                                  </div>
                                  <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.6 }}
                                    className="bg-gradient-to-br from-indigo-50 to-white rounded-xl p-5 border border-indigo-100"
                                  >
                                    <div className="text-sm font-semibold text-slate-900 mb-3">📚 IB Core Components Status</div>
                                    <div className="grid grid-cols-3 gap-3 text-xs">
                                      <div className="bg-white rounded-lg p-3 border border-slate-100">
                                        <div className="font-semibold text-slate-900 mb-1">TOK</div>
                                        <div className="text-slate-600">Essay drafts: 78% submitted</div>
                                      </div>
                                      <div className="bg-white rounded-lg p-3 border border-slate-100">
                                        <div className="font-semibold text-slate-900 mb-1">CAS</div>
                                        <div className="text-slate-600">Avg activities: 12/student</div>
                                      </div>
                                      <div className="bg-white rounded-lg p-3 border border-slate-100">
                                        <div className="font-semibold text-slate-900 mb-1">Extended Essay</div>
                                        <div className="text-slate-600">92% topics approved</div>
                                      </div>
                                    </div>
                                  </motion.div>
                                </div>
                              )}
                              {index === 3 && (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between mb-4">
                                    <div>
                                      <h4 className="text-lg font-semibold text-slate-900 mb-1">AI-Optimized Timetable</h4>
                                      <p className="text-xs text-slate-600">Zero conflicts • 98% teacher preference match • IB compliant</p>
                                    </div>
                                    <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">Generated in 47 seconds</div>
                                  </div>
                                  <div className="bg-white rounded-lg border border-slate-200 p-1">
                                    <div className="grid grid-cols-6 gap-1">
                                      <div className="text-xs font-semibold text-slate-600 text-center py-3"></div>
                                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day, idx) => (
                                        <motion.div 
                                          key={day}
                                          initial={{ opacity: 0, y: -10 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          transition={{ delay: idx * 0.05 }}
                                          className="text-xs font-bold text-slate-700 text-center py-3 bg-gradient-to-br from-slate-100 to-slate-50 rounded"
                                        >
                                          {day}
                                        </motion.div>
                                      ))}
                                      {[
                                        { period: '08:00', label: 'Period 1' },
                                        { period: '09:00', label: 'Period 2' },
                                        { period: '10:00', label: 'Break', isBreak: true },
                                        { period: '10:20', label: 'Period 3' },
                                        { period: '11:20', label: 'Period 4' },
                                        { period: '12:20', label: 'Lunch', isBreak: true },
                                        { period: '13:20', label: 'Period 5' },
                                        { period: '14:20', label: 'Period 6' }
                                      ].map((time, periodIdx) => (
                                        <React.Fragment key={periodIdx}>
                                          <motion.div 
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: periodIdx * 0.05 }}
                                            className="flex flex-col items-center justify-center text-center py-3 bg-slate-50 rounded"
                                          >
                                            <div className="text-[10px] font-semibold text-slate-900">{time.label}</div>
                                            <div className="text-[9px] text-slate-500">{time.period}</div>
                                          </motion.div>
                                          {time.isBreak ? (
                                            [...Array(5)].map((_, i) => (
                                              <motion.div 
                                                key={i}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: (periodIdx * 5 + i) * 0.02 + 0.3 }}
                                                className="bg-slate-100 rounded-lg flex items-center justify-center"
                                              >
                                                <span className="text-[10px] text-slate-400">{time.label === 'Break' ? '☕' : '🍽️'}</span>
                                              </motion.div>
                                            ))
                                          ) : (
                                            [
                                              { subject: 'Physics HL', room: 'Lab 2', teacher: 'Dr. P', color: 'from-blue-500 to-blue-600' },
                                              { subject: 'Math AA SL', room: 'R-104', teacher: 'Mr. K', color: 'from-purple-500 to-purple-600' },
                                              { subject: 'English A', room: 'R-201', teacher: 'Ms. T', color: 'from-emerald-500 to-emerald-600' },
                                              { subject: 'Chemistry', room: 'Lab 1', teacher: 'Dr. C', color: 'from-orange-500 to-orange-600' },
                                              { subject: 'TOK', room: 'R-301', teacher: 'Mr. S', color: 'from-pink-500 to-pink-600' }
                                            ].map((cls, i) => (
                                              <motion.div 
                                                key={i}
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: (periodIdx * 5 + i) * 0.02 + 0.3 }}
                                                className={`rounded-lg p-2 bg-gradient-to-br ${cls.color} text-white shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
                                              >
                                                <div className="text-[10px] font-bold leading-tight mb-0.5">{cls.subject}</div>
                                                <div className="text-[8px] opacity-90">{cls.room} • {cls.teacher}</div>
                                              </motion.div>
                                            ))
                                          )}
                                        </React.Fragment>
                                      ))}
                                    </div>
                                  </div>
                                  <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.8 }}
                                    className="flex gap-3 text-xs"
                                  >
                                    <div className="flex-1 bg-blue-50 rounded-lg p-3 border border-blue-100">
                                      <div className="font-semibold text-blue-900 mb-1">✓ IB Requirements</div>
                                      <div className="text-blue-700">HL: 6h/week, SL: 4h/week</div>
                                    </div>
                                    <div className="flex-1 bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                                      <div className="font-semibold text-emerald-900 mb-1">✓ Zero Conflicts</div>
                                      <div className="text-emerald-700">All 45 teachers • 327 students</div>
                                    </div>
                                  </motion.div>
                                </div>
                              )}
                              {index > 3 && (
                                <div className="flex items-center justify-center h-full">
                                  <div className="text-center">
                                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mx-auto mb-4 shadow-xl`}>
                                      <feature.icon className="w-10 h-10 text-white" />
                                    </div>
                                    <div className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</div>
                                    <p className="text-sm text-slate-600 max-w-md">{feature.description.substring(0, 120)}...</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right side - Explanation */}
                          <div className="bg-white p-8 lg:border-l border-slate-200">
                            <h5 className="text-xl font-bold text-slate-900 mb-4">How it works</h5>
                            <p className="text-sm text-slate-600 leading-relaxed mb-8">
                              {feature.description}
                            </p>
                            <div className="space-y-4">
                              {['Quick setup and configuration', 'Automatic optimization and smart suggestions', 'Real-time updates and seamless collaboration'].map((step, i) => (
                                <div key={i} className="flex items-start gap-3">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                                    <span className="text-sm font-bold text-white">{i + 1}</span>
                                  </div>
                                  <p className="text-sm text-slate-700 pt-1.5">{step}</p>
                                </div>
                              ))}
                            </div>
                            <div className="mt-8 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                              <div className="text-xs font-semibold text-blue-900 mb-2">💡 Pro Tip</div>
                              <p className="text-xs text-slate-700 leading-relaxed">
                                This feature integrates seamlessly with your existing workflow and requires zero manual intervention after initial setup.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
          </div>
          </div>


          </section>
          );
          }