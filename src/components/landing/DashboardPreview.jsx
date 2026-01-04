import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Users, GraduationCap, BookOpen, Building2, Clock, AlertCircle, CheckCircle, TrendingUp, Award, Bell, FileText, BarChart3 } from 'lucide-react';

const features = [
  {
    icon: Building2,
    title: 'Complete School Management Dashboard',
    description: 'Get a 360° view of your entire school operations with real-time insights, automated workflows, and intelligent analytics that help you make data-driven decisions instantly.',
    color: 'from-blue-900 to-blue-800',
  },
  {
    icon: Users,
    title: 'Unified Communication Platform',
    description: 'Connect parents, teachers, and students through a centralized hub for announcements, updates, and real-time notifications. Keep everyone informed and engaged with seamless communication tools.',
    color: 'from-purple-600 to-purple-800',
  },
  {
    icon: BookOpen,
    title: 'Advanced Curriculum Tracking',
    description: 'Monitor teaching progress, track learning objectives, manage IB assessments, and ensure curriculum compliance with detailed analytics and automated reporting across all programmes.',
    color: 'from-emerald-600 to-emerald-800',
  },
  {
    icon: Calendar,
    title: 'AI-Powered Smart Scheduling',
    description: 'Generate conflict-free timetables in minutes with our advanced AI engine. Automatically optimizes for teacher preferences, room availability, and IB requirements while maintaining perfect balance.',
    color: 'from-indigo-600 to-indigo-800',
  },
  {
    icon: GraduationCap,
    title: 'IB Programme Compliance Engine',
    description: 'Automatically validate all IB requirements including subject groups, HL/SL ratios, core components, and teaching hours. Stay compliant with built-in checks for PYP, MYP, and DP standards.',
    color: 'from-pink-600 to-pink-800',
  },
  {
    icon: Users,
    title: 'Intelligent Group Management',
    description: 'Create and manage teaching groups with smart student assignment algorithms. Handle class sizes, track enrollment, balance group compositions, and optimize learning environments effortlessly.',
    color: 'from-orange-600 to-orange-800',
  },
  {
    icon: Building2,
    title: 'Resource Optimization System',
    description: 'Maximize facility usage with intelligent room allocation, equipment tracking, and capacity management. Ensure labs, studios, and specialized spaces are utilized efficiently across all schedules.',
    color: 'from-teal-600 to-teal-800',
  },
  {
    icon: AlertCircle,
    title: 'Real-Time Conflict Detection',
    description: 'Instantly identify and resolve scheduling conflicts before they impact operations. Advanced algorithms check for overlaps, violations, and issues across teachers, students, and rooms in real-time.',
    color: 'from-red-600 to-red-800',
  },
  {
    icon: TrendingUp,
    title: 'Teacher Workload Balancing',
    description: 'Ensure fair distribution of teaching hours, respect maximum periods, honor availability preferences, and maintain sustainable workloads. Keep your faculty happy and effective with intelligent scheduling.',
    color: 'from-cyan-600 to-cyan-800',
  },
  {
    icon: Award,
    title: 'Student-Centric Scheduling',
    description: 'Prioritize student success with personalized timetables that accommodate subject choices, support individual needs, and ensure proper balance across IB subject groups for optimal learning outcomes.',
    color: 'from-violet-600 to-violet-800',
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
      
      const firstCardOffset = 400;
      const lastCardOffset = 1200;
      
      const shouldStartSticky = sectionRect.top < (centerViewport - firstCardOffset);
      const shouldEndSticky = sectionRect.top < (centerViewport - lastCardOffset);
      
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

  const renderPreview = (index) => {
    switch(index) {
      case 0: // Dashboard
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-xl p-5 text-white shadow-xl relative overflow-hidden group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <div className="relative">
                  <div className="flex justify-between items-start mb-4">
                    <Users className="w-10 h-10 opacity-90" />
                    <span className="text-xs bg-white/25 px-2.5 py-1 rounded-full font-semibold backdrop-blur-sm">Live</span>
                  </div>
                  <div className="text-5xl font-black mb-2">45</div>
                  <div className="text-sm font-semibold opacity-95 mb-1">Active Teachers</div>
                  <div className="text-xs opacity-80">38 full-time • 7 part-time</div>
                  <div className="text-[10px] opacity-70 mt-1">Avg: 22.4h/week • 98% satisfaction</div>
                </div>
              </motion.div>
              
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 rounded-xl p-5 text-white shadow-xl relative overflow-hidden group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <div className="relative">
                  <div className="flex justify-between items-start mb-4">
                    <GraduationCap className="w-10 h-10 opacity-90" />
                    <span className="text-xs bg-white/25 px-2.5 py-1 rounded-full font-semibold backdrop-blur-sm">↗ +8%</span>
                  </div>
                  <div className="text-5xl font-black mb-2">327</div>
                  <div className="text-sm font-semibold opacity-95 mb-1">Total Students</div>
                  <div className="text-xs opacity-80">DP1: 89 • DP2: 92 • MYP: 146</div>
                  <div className="text-[10px] opacity-70 mt-1">18:1 student-teacher ratio</div>
                </div>
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="bg-white rounded-xl border-2 border-emerald-300 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 p-5 text-white relative overflow-hidden">
                <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ['-200%', '200%'] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}/>
                <div className="relative flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-6 h-6" />
                      <span className="font-black text-xl">Active Schedule</span>
                    </div>
                    <div className="text-sm opacity-95 font-medium">DP Programme 2024-25 • Term 1</div>
                    <div className="text-xs opacity-80 mt-1">Generated 2h ago • Last edit: Dr. Mitchell</div>
                  </div>
                  <div className="text-right">
                    <div className="text-5xl font-black mb-1">98</div>
                    <div className="text-xs font-semibold">Quality Score</div>
                  </div>
                </div>
              </div>
              
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: 'Conflicts', value: '0', color: 'emerald', icon: '✓', subtext: 'Perfect' },
                    { label: 'Coverage', value: '100%', color: 'blue', icon: '📚', subtext: 'Complete' },
                    { label: 'Room Use', value: '94%', color: 'purple', icon: '🏢', subtext: 'Optimal' },
                    { label: 'Balance', value: 'A+', color: 'indigo', icon: '⚖️', subtext: 'Excellent' },
                    { label: 'Compliance', value: '✓', color: 'emerald', icon: '🎓', subtext: 'Valid' }
                  ].map((m, i) => (
                    <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + i * 0.05 }}
                      className={`bg-gradient-to-br from-${m.color}-50 to-${m.color}-100/50 rounded-lg p-3 border-2 border-${m.color}-200 text-center`}>
                      <div className="text-xl mb-1">{m.icon}</div>
                      <div className="text-2xl font-black text-slate-900">{m.value}</div>
                      <div className="text-[9px] font-bold text-slate-700">{m.label}</div>
                      <div className="text-[8px] text-slate-600 mt-0.5">{m.subtext}</div>
                    </motion.div>
                  ))}
                </div>

                <div className="bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl p-4">
                  <div className="flex justify-between text-xs mb-2.5">
                    <span className="font-bold text-slate-800">AI Optimization Score</span>
                    <span className="font-black text-slate-900">98/100</span>
                  </div>
                  <div className="h-3 bg-white rounded-full overflow-hidden shadow-inner border border-slate-200">
                    <motion.div initial={{ width: 0 }} animate={{ width: '98%' }} transition={{ delay: 0.8, duration: 1.5, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500 rounded-full relative">
                      <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-50"
                        animate={{ x: ['-200%', '200%'] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}/>
                    </motion.div>
                  </div>
                  <div className="flex justify-between mt-2 text-[9px] text-slate-600 font-medium">
                    <span>⚡ Generated in 47 seconds</span>
                    <span>🕒 Updated 2 hours ago</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl p-4 border border-blue-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-sm font-black text-slate-900">Teacher Load</div>
                    </div>
                    <div className="space-y-2">
                      {[
                        { name: 'Dr. Peterson', hours: '24/25h', load: 96, color: 'emerald' },
                        { name: 'Ms. Thompson', hours: '22/25h', load: 88, color: 'blue' },
                        { name: 'Mr. Kumar', hours: '23/25h', load: 92, color: 'purple' }
                      ].map((t, i) => (
                        <div key={i} className="bg-white rounded-lg p-2 border border-slate-100">
                          <div className="flex justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-900">{t.name}</span>
                            <span className="text-[10px] font-bold text-slate-700">{t.hours}</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${t.load}%` }} transition={{ delay: 1 + i * 0.1, duration: 0.8 }}
                              className={`h-full bg-gradient-to-r from-${t.color}-400 to-${t.color}-600 rounded-full`}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
                        <Bell className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-sm font-black text-slate-900">Alerts</div>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-white/80 rounded-lg p-2 border border-amber-100">
                        <div className="flex items-start gap-2">
                          <span className="text-sm">⚠️</span>
                          <div>
                            <div className="text-[10px] font-bold text-amber-900">Minor Issue</div>
                            <div className="text-[9px] text-slate-700 leading-tight">Dr. Chen: 4 consecutive periods on Wed</div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white/80 rounded-lg p-2 border border-emerald-100">
                        <div className="flex items-start gap-2">
                          <span className="text-sm">✓</span>
                          <div>
                            <div className="text-[10px] font-bold text-emerald-900">Well Balanced</div>
                            <div className="text-[9px] text-slate-700 leading-tight">All teachers 90-100% target hours</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}
              className="grid grid-cols-4 gap-3">
              {[
                { icon: '📊', value: '24', label: 'Subjects', sub: 'HL: 12, SL: 12', color: 'blue' },
                { icon: '🎓', value: '18', label: 'Groups', sub: 'Avg: 18.2 students', color: 'purple' },
                { icon: '🏢', value: '18', label: 'Rooms', sub: '94% utilization', color: 'emerald' },
                { icon: '⏱️', value: '240', label: 'Periods/Week', sub: '8 per day', color: 'orange' }
              ].map((s, i) => (
                <div key={i} className={`bg-gradient-to-br from-${s.color}-50 to-white rounded-xl p-3 border-2 border-${s.color}-200 text-center`}>
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="text-2xl font-black text-slate-900">{s.value}</div>
                  <div className="text-[10px] font-bold text-slate-700">{s.label}</div>
                  <div className="text-[9px] text-slate-600 mt-0.5">{s.sub}</div>
                </div>
              ))}
            </motion.div>
          </div>
        );

      case 1: // Communication
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Bell className="w-6 h-6 text-blue-600" />
                  Communication Hub
                </h4>
                <p className="text-xs text-slate-600 mt-1">Real-time updates across your school community</p>
              </div>
              <div className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full text-xs font-bold shadow-lg">
                8 New Updates
              </div>
            </div>

            {[
              { title: 'Parent-Teacher Conferences: Booking Now Open', desc: 'January 15-17 conference slots available. Parents can book 15-minute sessions through the portal. 156 slots already booked.', time: '2h ago', user: 'Sarah Mitchell, Admin', color: 'blue', icon: '📅', reactions: 24, comments: 8 },
              { title: 'DP2 Report Cards & Predicted Grades Published', desc: 'All DP2 students received Term 1 reports with IB predicted grades. Class average: 36 points. 15 students achieved 40+ predictions.', time: '5h ago', user: 'Mr. Johnson, DP Coordinator', color: 'emerald', icon: '📊', reactions: 67, comments: 23 },
              { title: 'Science Fair 2025: "Innovations for Tomorrow"', desc: '47 student projects approved across MYP and DP. Guest judges from Stanford and MIT confirmed. Exhibition on March 15.', time: '1d ago', user: 'Dr. Chen, Science Dept', color: 'purple', icon: '🔬', reactions: 52, comments: 14 },
              { title: 'DP1 Extended Essay Workshop Series', desc: 'Three mandatory workshops: Research Methods (Jan 10), Academic Writing (Jan 17), Citations & Bibliography (Jan 24). All sessions 15:00-16:30.', time: '2d ago', user: 'Mrs. Davis, EE Coordinator', color: 'orange', icon: '📚', reactions: 31, comments: 5 }
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 + 0.2 }}
                className="bg-gradient-to-r from-slate-50 to-white rounded-xl p-4 border-2 border-slate-200 hover:border-slate-300 hover:shadow-xl transition-all cursor-pointer group">
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br from-${item.color}-400 to-${item.color}-600 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform`}>
                    <span className="text-2xl">{item.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 mb-1.5 group-hover:text-blue-600 transition-colors">{item.title}</div>
                    <div className="text-xs text-slate-700 leading-relaxed mb-3">{item.desc}</div>
                    <div className="flex items-center gap-4 text-[10px] text-slate-500">
                      <span className="font-semibold">{item.user}</span>
                      <span>•</span>
                      <span>{item.time}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span>❤️</span>
                        <span className="font-semibold">{item.reactions}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span>💬</span>
                        <span className="font-semibold">{item.comments}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              className="grid grid-cols-3 gap-3">
              {[
                { label: 'Announcements', value: '47', change: '+12 this week', color: 'blue' },
                { label: 'Messages Sent', value: '1.2k', change: 'This month', color: 'purple' },
                { label: 'Engagement Rate', value: '94%', change: '+3% vs last term', color: 'emerald' }
              ].map((stat, i) => (
                <div key={i} className={`bg-gradient-to-br from-${stat.color}-50 to-white rounded-xl p-4 border-2 border-${stat.color}-200 text-center`}>
                  <div className="text-3xl font-black text-slate-900 mb-1">{stat.value}</div>
                  <div className="text-xs font-bold text-slate-700 mb-1">{stat.label}</div>
                  <div className="text-[9px] text-slate-600">{stat.change}</div>
                </div>
              ))}
            </motion.div>
          </div>
        );

      case 2: // Curriculum
        return (
          <div className="space-y-4">
            <div className="mb-4">
              <h4 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-emerald-600" />
                Curriculum & Progress Tracking
              </h4>
              <p className="text-xs text-slate-600 mt-1">Monitor teaching progress and IB assessment compliance in real-time</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { subject: 'Physics HL', teacher: 'Dr. Peterson', progress: 75, units: '6/8 units', color: 'blue', next: 'Quantum Physics', assessments: '3 IAs completed', hours: '54/72 hours', students: 18 },
                { subject: 'Math AA SL', teacher: 'Mr. Kumar', progress: 90, units: '7/8 units', color: 'purple', next: 'Calculus Review', assessments: 'IA in progress', hours: '36/48 hours', students: 20 },
                { subject: 'English A Lang & Lit', teacher: 'Ms. Thompson', progress: 60, units: '5/8 units', color: 'emerald', next: 'Poetry Analysis', assessments: 'IO: 15/20 avg', hours: '28/48 hours', students: 22 },
                { subject: 'Chemistry HL', teacher: 'Dr. Chen', progress: 85, units: '7/8 units', color: 'orange', next: 'Organic Chem', assessments: 'Group 4 done', hours: '64/72 hours', students: 16 }
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 + 0.2 }}
                  className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-4 border-2 border-slate-200 hover:shadow-xl transition-all group cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">{item.subject}</div>
                      <div className="text-xs text-slate-600 mt-0.5 font-medium">{item.teacher} • {item.students} students</div>
                    </div>
                    <div className="text-xs font-black text-slate-700 bg-white rounded-full px-2.5 py-1 border-2 border-slate-200">
                      {item.units}
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="font-bold text-slate-700">Course Progress</span>
                      <span className="font-black text-slate-900">{item.progress}%</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${item.progress}%` }} transition={{ delay: i * 0.1 + 0.5, duration: 1 }}
                        className={`h-full bg-gradient-to-r from-${item.color}-400 to-${item.color}-600 rounded-full`}/>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs bg-white rounded-lg p-2.5 border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-700">
                      <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                      <span className="font-semibold">Next:</span>
                      <span>{item.next}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                      <span className="font-semibold">Assessment:</span>
                      <span>{item.assessments}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                      <span className="font-semibold">Teaching:</span>
                      <span>{item.hours}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              className="bg-gradient-to-br from-indigo-50 to-white rounded-xl p-5 border-2 border-indigo-200">
              <div className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                <span className="text-xl">🎓</span>
                IB Core Components Status
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: 'TOK', status: 'Essay drafts: 78%', students: '89/92 submitted', color: 'blue' },
                  { name: 'CAS', status: 'Avg: 12 activities', students: '85/92 on track', color: 'emerald' },
                  { name: 'Extended Essay', status: 'Topics approved: 92%', students: '84/92 confirmed', color: 'purple' }
                ].map((core, i) => (
                  <div key={i} className={`bg-white rounded-xl p-4 border-2 border-${core.color}-200`}>
                    <div className="text-sm font-black text-slate-900 mb-2">{core.name}</div>
                    <div className="text-xs text-slate-700 font-semibold mb-1">{core.status}</div>
                    <div className="text-[10px] text-slate-600">{core.students}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        );

      case 3: // Scheduling
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-indigo-600" />
                  AI-Optimized Weekly Timetable
                </h4>
                <p className="text-xs text-slate-600 mt-1">Zero conflicts • 98% preference match • IB compliant • 47sec generation</p>
              </div>
              <div className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-full text-xs font-bold shadow-lg">
                ✓ Active Schedule
              </div>
            </div>

            <div className="bg-white rounded-xl border-2 border-slate-200 p-2 shadow-lg">
              <div className="grid grid-cols-6 gap-1">
                <div className="text-xs font-bold text-slate-600 text-center py-3"></div>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day, idx) => (
                  <motion.div key={day} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                    className="text-xs font-black text-slate-800 text-center py-3 bg-gradient-to-br from-slate-100 to-slate-50 rounded-lg border border-slate-200">
                    {day}
                  </motion.div>
                ))}
                {[
                  { period: '08:00', label: 'Period 1', time: '08:00-09:00' },
                  { period: '09:00', label: 'Period 2', time: '09:00-10:00' },
                  { period: '10:00', label: 'Break', isBreak: true },
                  { period: '10:20', label: 'Period 3', time: '10:20-11:20' },
                  { period: '11:20', label: 'Period 4', time: '11:20-12:20' },
                  { period: '12:20', label: 'Lunch', isBreak: true },
                  { period: '13:20', label: 'Period 5', time: '13:20-14:20' },
                  { period: '14:20', label: 'Period 6', time: '14:20-15:20' }
                ].map((slot, periodIdx) => (
                  <React.Fragment key={periodIdx}>
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: periodIdx * 0.05 }}
                      className="flex flex-col items-center justify-center text-center py-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-[10px] font-black text-slate-900">{slot.label}</div>
                      <div className="text-[8px] text-slate-600 font-semibold">{slot.period}</div>
                    </motion.div>
                    {slot.isBreak ? (
                      [...Array(5)].map((_, i) => (
                        <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: (periodIdx * 5 + i) * 0.02 + 0.3 }}
                          className="bg-gradient-to-br from-slate-100 to-slate-50 rounded-lg flex items-center justify-center border border-slate-200">
                          <span className="text-lg">{slot.label === 'Break' ? '☕' : '🍽️'}</span>
                        </motion.div>
                      ))
                    ) : (
                      [
                        { subject: 'Physics HL', room: 'Lab 2', teacher: 'Dr. P', students: 18, color: 'from-blue-500 to-blue-600' },
                        { subject: 'Math AA SL', room: 'R-104', teacher: 'Mr. K', students: 20, color: 'from-purple-500 to-purple-600' },
                        { subject: 'English A', room: 'R-201', teacher: 'Ms. T', students: 22, color: 'from-emerald-500 to-emerald-600' },
                        { subject: 'Chemistry', room: 'Lab 1', teacher: 'Dr. C', students: 16, color: 'from-orange-500 to-orange-600' },
                        { subject: 'TOK', room: 'R-301', teacher: 'Mr. S', students: 89, color: 'from-pink-500 to-pink-600' }
                      ].map((cls, i) => (
                        <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: (periodIdx * 5 + i) * 0.02 + 0.3 }}
                          className={`rounded-lg p-2.5 bg-gradient-to-br ${cls.color} text-white shadow-md hover:shadow-xl hover:scale-105 transition-all cursor-pointer border border-white/20`}>
                          <div className="text-[10px] font-black leading-tight mb-1">{cls.subject}</div>
                          <div className="text-[8px] opacity-90 font-semibold">{cls.room} • {cls.teacher}</div>
                          <div className="text-[8px] opacity-80 mt-0.5">{cls.students} students</div>
                        </motion.div>
                      ))
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              className="grid grid-cols-4 gap-3">
              {[
                { label: '✓ IB Requirements', value: 'Met', sub: 'HL: 6h, SL: 4h', color: 'blue' },
                { label: '✓ Zero Conflicts', value: 'Perfect', sub: '45 teachers • 327 students', color: 'emerald' },
                { label: '📊 Room Usage', value: '94%', sub: '18/18 rooms active', color: 'purple' },
                { label: '⚖️ Balance Score', value: 'A+', sub: 'All teachers 90-100%', color: 'indigo' }
              ].map((stat, i) => (
                <div key={i} className={`bg-gradient-to-br from-${stat.color}-50 to-white rounded-xl p-3 border-2 border-${stat.color}-200 text-center`}>
                  <div className="text-xs font-bold text-slate-700 mb-2">{stat.label}</div>
                  <div className="text-2xl font-black text-slate-900 mb-1">{stat.value}</div>
                  <div className="text-[9px] text-slate-600">{stat.sub}</div>
                </div>
              ))}
            </motion.div>
          </div>
        );

      case 4: // IB Compliance
        return (
          <div className="space-y-4">
            <div className="text-center mb-5">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center mx-auto mb-4 shadow-xl">
                <GraduationCap className="w-10 h-10 text-white" />
              </div>
              <h4 className="text-xl font-black text-slate-900">IB Programme Compliance Dashboard</h4>
              <p className="text-xs text-slate-600 mt-2">Real-time validation across PYP, MYP, and DP requirements</p>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-5 border-2 border-emerald-300 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-black text-slate-900">DP Programme Status</div>
                <div className="px-4 py-2 bg-emerald-500 text-white rounded-full text-xs font-bold shadow-md">
                  ✓ 100% Compliant
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Subject Groups', requirement: '6 groups mandatory', status: '✓ All 6 covered', students: '181/181 students', color: 'blue' },
                  { label: 'HL/SL Balance', requirement: '3 HL, 3 SL minimum', status: '✓ All balanced', students: 'Avg: 3.2 HL per student', color: 'purple' },
                  { label: 'Teaching Hours', requirement: 'HL: 240h, SL: 150h', status: '✓ All met', students: 'Total: 4,320 hours', color: 'emerald' },
                  { label: 'Core Components', requirement: 'TOK, CAS, EE', status: '✓ All assigned', students: '181/181 enrolled', color: 'pink' }
                ].map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 + 0.3 }}
                    className={`bg-white rounded-xl p-4 border-2 border-${item.color}-200`}>
                    <div className="text-sm font-black text-slate-900 mb-2">{item.label}</div>
                    <div className="text-xs text-slate-600 mb-2">{item.requirement}</div>
                    <div className="text-xs font-bold text-emerald-600 mb-1">{item.status}</div>
                    <div className="text-[10px] text-slate-500">{item.students}</div>
                  </motion.div>
                ))}
              </div>

              <div className="bg-white rounded-xl p-4 border-2 border-slate-200">
                <div className="text-sm font-black text-slate-900 mb-3">IB Subject Group Distribution</div>
                <div className="grid grid-cols-6 gap-2">
                  {[
                    { group: 'G1', name: 'Lang & Lit', students: 181, color: 'red', coverage: '100%' },
                    { group: 'G2', name: 'Lang Acq', students: 156, color: 'orange', coverage: '86%' },
                    { group: 'G3', name: 'Individuals', students: 167, color: 'amber', coverage: '92%' },
                    { group: 'G4', name: 'Sciences', students: 181, color: 'emerald', coverage: '100%' },
                    { group: 'G5', name: 'Math', students: 181, color: 'blue', coverage: '100%' },
                    { group: 'G6', name: 'Arts', students: 89, color: 'purple', coverage: '49%' }
                  ].map((g, i) => (
                    <div key={i} className={`bg-gradient-to-br from-${g.color}-50 to-white rounded-lg p-3 border-2 border-${g.color}-200 text-center`}>
                      <div className="text-[10px] font-black text-slate-900 mb-1">{g.group}</div>
                      <div className="text-[9px] text-slate-700 mb-2 font-semibold leading-tight">{g.name}</div>
                      <div className="text-lg font-black text-slate-900">{g.students}</div>
                      <div className="text-[8px] text-slate-600 mt-1">{g.coverage} coverage</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              className="grid grid-cols-3 gap-3">
              {[
                { icon: '📚', label: 'HL Subjects', value: '12', detail: 'All meeting 6h/week' },
                { icon: '📖', label: 'SL Subjects', value: '12', detail: 'All meeting 4h/week' },
                { icon: '🎯', label: 'Core Components', value: '100%', detail: 'TOK, CAS, EE complete' }
              ].map((stat, i) => (
                <div key={i} className="bg-gradient-to-br from-indigo-50 to-white rounded-xl p-4 border-2 border-indigo-200 text-center">
                  <div className="text-3xl mb-2">{stat.icon}</div>
                  <div className="text-2xl font-black text-slate-900 mb-1">{stat.value}</div>
                  <div className="text-xs font-bold text-slate-700 mb-1">{stat.label}</div>
                  <div className="text-[9px] text-slate-600">{stat.detail}</div>
                </div>
              ))}
            </motion.div>
          </div>
        );

      case 5: // Group Management
        return (
          <div className="space-y-4">
            <div className="text-center mb-5">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mx-auto mb-4 shadow-xl">
                <Users className="w-10 h-10 text-white" />
              </div>
              <h4 className="text-xl font-black text-slate-900">Teaching Group Management</h4>
              <p className="text-xs text-slate-600 mt-2">Smart student assignment and class composition optimization</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'Physics HL - Group A', level: 'HL', teacher: 'Dr. Peterson', students: 18, capacity: 20, subjects: 'Physics', room: 'Lab 2', hours: '6h/week', status: 'optimal' },
                { name: 'Math AA SL - Group B', level: 'SL', teacher: 'Mr. Kumar', students: 22, capacity: 22, subjects: 'Math', room: 'R-104', hours: '4h/week', status: 'full' },
                { name: 'English A HL - Group C', level: 'HL', teacher: 'Ms. Thompson', students: 15, capacity: 20, subjects: 'English', room: 'R-201', hours: '6h/week', status: 'available' },
                { name: 'Chemistry HL - Group A', level: 'HL', teacher: 'Dr. Chen', students: 16, capacity: 18, subjects: 'Chemistry', room: 'Lab 1', hours: '6h/week', status: 'optimal' }
              ].map((group, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 + 0.2 }}
                  className="bg-white rounded-xl p-4 border-2 border-slate-200 hover:border-orange-300 hover:shadow-xl transition-all cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="text-sm font-black text-slate-900 mb-1">{group.name}</div>
                      <div className="text-xs text-slate-600 font-semibold">{group.teacher}</div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      group.status === 'optimal' ? 'bg-emerald-100 text-emerald-700' :
                      group.status === 'full' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {group.level}
                    </div>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 font-semibold">Enrollment</span>
                      <span className="font-black text-slate-900">{group.students}/{group.capacity}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(group.students/group.capacity)*100}%`}} transition={{ delay: i * 0.1 + 0.5, duration: 0.8 }}
                        className={`h-full rounded-full ${
                          group.status === 'optimal' ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                          group.status === 'full' ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                          'bg-gradient-to-r from-blue-400 to-blue-600'
                        }`}/>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-2.5 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Room:</span>
                      <span className="font-bold text-slate-900">{group.room}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Schedule:</span>
                      <span className="font-bold text-slate-900">{group.hours}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Status:</span>
                      <span className={`font-bold ${
                        group.status === 'optimal' ? 'text-emerald-600' :
                        group.status === 'full' ? 'text-amber-600' :
                        'text-blue-600'
                      }`}>
                        {group.status === 'optimal' ? '✓ Optimal' : group.status === 'full' ? '⚠ Full' : '○ Available'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total Groups', value: '18', detail: 'Active this term', color: 'blue' },
                { label: 'Avg Size', value: '18.2', detail: 'Students per group', color: 'purple' },
                { label: 'Utilization', value: '94%', detail: 'Capacity usage', color: 'emerald' },
                { label: 'Balance Score', value: 'A+', detail: 'Excellent distribution', color: 'orange' }
              ].map((stat, i) => (
                <div key={i} className={`bg-gradient-to-br from-${stat.color}-50 to-white rounded-xl p-3 border-2 border-${stat.color}-200 text-center`}>
                  <div className="text-2xl font-black text-slate-900 mb-1">{stat.value}</div>
                  <div className="text-xs font-bold text-slate-700 mb-1">{stat.label}</div>
                  <div className="text-[9px] text-slate-600">{stat.detail}</div>
                </div>
              ))}
            </motion.div>
          </div>
        );

      case 6: // Resource Management
        return (
          <div className="space-y-4">
            <div className="text-center mb-5">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-xl">
                <Building2 className="w-10 h-10 text-white" />
              </div>
              <h4 className="text-xl font-black text-slate-900">Resource & Facility Management</h4>
              <p className="text-xs text-slate-600 mt-2">Optimize room usage and track equipment across your campus</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { room: 'Science Lab 2', type: 'Laboratory', capacity: 20, usage: 96, hours: '38/40h', subjects: ['Physics HL', 'Chemistry SL'], equipment: ['Microscopes', 'Spectrometers', 'Lab Stations'], color: 'blue' },
                { room: 'Room 104', type: 'Classroom', capacity: 25, usage: 88, hours: '35/40h', subjects: ['Math AA', 'Math AI'], equipment: ['Smartboard', 'Graphing Calculators'], color: 'purple' },
                { room: 'Art Studio 1', type: 'Studio', capacity: 18, usage: 75, hours: '30/40h', subjects: ['Visual Arts', 'Design Tech'], equipment: ['Easels', '3D Printer', 'Digital Tablets'], color: 'pink' },
                { room: 'Library', type: 'Multi-Purpose', capacity: 40, usage: 65, hours: '26/40h', subjects: ['TOK', 'Extended Essay'], equipment: ['Computers', 'Study Booths', 'Projector'], color: 'emerald' },
                { room: 'Gymnasium', type: 'Sports Facility', capacity: 60, usage: 82, hours: '33/40h', subjects: ['Physical Ed', 'Sports Science'], equipment: ['Sports Equipment', 'Fitness Machines'], color: 'orange' },
                { room: 'Music Room', type: 'Specialized', capacity: 22, usage: 70, hours: '28/40h', subjects: ['Music', 'Theater'], equipment: ['Instruments', 'Recording Equipment'], color: 'indigo' }
              ].map((room, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 + 0.2 }}
                  className="bg-white rounded-xl p-4 border-2 border-slate-200 hover:shadow-xl transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-sm font-black text-slate-900 mb-0.5">{room.room}</div>
                      <div className="text-[10px] text-slate-600 font-semibold">{room.type}</div>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r from-${room.color}-100 to-${room.color}-200 text-${room.color}-700`}>
                      {room.capacity} seats
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-600 font-semibold">Weekly Usage</span>
                      <span className="font-black text-slate-900">{room.usage}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${room.usage}%` }} transition={{ delay: i * 0.08 + 0.5, duration: 0.8 }}
                        className={`h-full bg-gradient-to-r from-${room.color}-400 to-${room.color}-600 rounded-full`}/>
                    </div>
                    <div className="text-[9px] text-slate-600 mt-1 font-semibold">{room.hours} weekly</div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-2.5 space-y-1">
                    <div className="text-[10px] font-bold text-slate-700 mb-1.5">Assigned Subjects:</div>
                    {room.subjects.map((sub, j) => (
                      <div key={j} className="text-[9px] text-slate-600 font-semibold flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full bg-${room.color}-400`}></div>
                        {sub}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total Rooms', value: '18', detail: 'Active facilities', color: 'teal' },
                { label: 'Avg Usage', value: '85%', detail: 'Capacity utilization', color: 'blue' },
                { label: 'Labs & Studios', value: '6', detail: 'Specialized spaces', color: 'purple' },
                { label: 'Equipment', value: '156', detail: 'Tracked items', color: 'emerald' }
              ].map((stat, i) => (
                <div key={i} className={`bg-gradient-to-br from-${stat.color}-50 to-white rounded-xl p-3 border-2 border-${stat.color}-200 text-center`}>
                  <div className="text-2xl font-black text-slate-900 mb-1">{stat.value}</div>
                  <div className="text-xs font-bold text-slate-700 mb-1">{stat.label}</div>
                  <div className="text-[9px] text-slate-600">{stat.detail}</div>
                </div>
              ))}
            </motion.div>
          </div>
        );

      case 7: // Conflict Detection
        return (
          <div className="space-y-4">
            <div className="text-center mb-5">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mx-auto mb-4 shadow-xl">
                <AlertCircle className="w-10 h-10 text-white" />
              </div>
              <h4 className="text-xl font-black text-slate-900">Real-Time Conflict Detection</h4>
              <p className="text-xs text-slate-600 mt-2">Instantly identify and resolve scheduling issues before they impact operations</p>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-5 border-2 border-emerald-300 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                  <div>
                    <div className="text-lg font-black text-slate-900">Schedule Status: Clear</div>
                    <div className="text-xs text-slate-600">Last scan: 2 minutes ago • Auto-check every 5 minutes</div>
                  </div>
                </div>
                <div className="px-4 py-2 bg-emerald-500 text-white rounded-full text-xs font-bold shadow-md">
                  ✓ Zero Conflicts
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { check: 'Teacher Conflicts', status: 'clear', count: 0, scanned: '45 teachers', color: 'emerald' },
                  { check: 'Student Conflicts', status: 'clear', count: 0, scanned: '327 students', color: 'blue' },
                  { check: 'Room Conflicts', status: 'clear', count: 0, scanned: '18 rooms', color: 'purple' }
                ].map((item, i) => (
                  <div key={i} className={`bg-white rounded-xl p-4 border-2 border-${item.color}-200`}>
                    <div className="text-4xl font-black text-slate-900 mb-2">{item.count}</div>
                    <div className="text-xs font-bold text-slate-700 mb-1">{item.check}</div>
                    <div className="text-[10px] text-slate-600">{item.scanned}</div>
                    <div className={`mt-2 text-[10px] font-bold text-${item.color}-600`}>✓ All Clear</div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-amber-50 to-white rounded-xl p-5 border-2 border-amber-200">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-7 h-7 text-amber-600" />
                <div className="text-lg font-black text-slate-900">Recent Warnings (Resolved)</div>
              </div>

              <div className="space-y-2">
                {[
                  { type: 'Minor', issue: 'Dr. Chen scheduled for 4 consecutive periods', resolution: 'Adjusted to 3-hour block with break', time: '2 days ago', resolved: true },
                  { type: 'Minor', issue: 'Lab 3 at 85% capacity for Chemistry HL', resolution: 'Moved to larger Lab 1', time: '3 days ago', resolved: true },
                  { type: 'Info', issue: 'Room R-204 maintenance scheduled', resolution: 'Classes redistributed automatically', time: '1 week ago', resolved: true }
                ].map((warning, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.1 }}
                    className="bg-white rounded-lg p-3 border border-slate-200">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-600 text-sm">⚠️</span>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-slate-900 mb-1">{warning.issue}</div>
                        <div className="text-[10px] text-emerald-700 font-semibold mb-1">✓ {warning.resolution}</div>
                        <div className="text-[9px] text-slate-500">{warning.time}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              className="grid grid-cols-4 gap-3">
              {[
                { label: 'Checks Today', value: '288', detail: 'Every 5 minutes', color: 'red' },
                { label: 'Issues Found', value: '0', detail: 'This week', color: 'emerald' },
                { label: 'Auto-Resolved', value: '12', detail: 'Last 30 days', color: 'blue' },
                { label: 'Uptime', value: '99.9%', detail: 'System availability', color: 'purple' }
              ].map((stat, i) => (
                <div key={i} className={`bg-gradient-to-br from-${stat.color}-50 to-white rounded-xl p-3 border-2 border-${stat.color}-200 text-center`}>
                  <div className="text-2xl font-black text-slate-900 mb-1">{stat.value}</div>
                  <div className="text-xs font-bold text-slate-700 mb-1">{stat.label}</div>
                  <div className="text-[9px] text-slate-600">{stat.detail}</div>
                </div>
              ))}
            </motion.div>
          </div>
        );

      case 8: // Workload Balancing
        return (
          <div className="space-y-4">
            <div className="text-center mb-5">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center mx-auto mb-4 shadow-xl">
                <TrendingUp className="w-10 h-10 text-white" />
              </div>
              <h4 className="text-xl font-black text-slate-900">Teacher Workload Analytics</h4>
              <p className="text-xs text-slate-600 mt-2">Ensure fair distribution and sustainable teaching loads across all faculty</p>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-blue-50 to-white rounded-xl p-5 border-2 border-blue-200 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-black text-slate-900">Faculty Distribution Overview</div>
                <div className="px-4 py-2 bg-blue-500 text-white rounded-full text-xs font-bold shadow-md">
                  A+ Balance Score
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { name: 'Dr. Peterson', dept: 'Science', hours: 24, target: 25, load: 96, consecutive: 3, freeDay: 'Wed', subjects: ['Physics HL', 'Physics SL'], color: 'blue' },
                  { name: 'Ms. Thompson', dept: 'Language A', hours: 22, target: 25, load: 88, consecutive: 4, freeDay: 'Fri', subjects: ['English A HL', 'English A SL'], color: 'purple' },
                  { name: 'Mr. Kumar', dept: 'Mathematics', hours: 23, target: 25, load: 92, consecutive: 3, freeDay: 'Thu', subjects: ['Math AA SL', 'Math AI SL'], color: 'emerald' },
                  { name: 'Dr. Chen', dept: 'Science', hours: 25, target: 25, load: 100, consecutive: 4, freeDay: 'Mon', subjects: ['Chemistry HL', 'Biology SL'], color: 'orange' },
                  { name: 'Mrs. Davis', dept: 'Extended Essay', hours: 18, target: 20, load: 90, consecutive: 2, freeDay: 'Tue', subjects: ['EE Coordination', 'TOK'], color: 'pink' }
                ].map((teacher, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08 }}
                    className="bg-white rounded-xl p-4 border-2 border-slate-200 hover:shadow-lg transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-sm font-black text-slate-900">{teacher.name}</div>
                        <div className="text-xs text-slate-600 font-semibold">{teacher.dept}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-slate-900">{teacher.hours}h</div>
                        <div className="text-[10px] text-slate-600">/ {teacher.target}h target</div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-600 font-semibold">Weekly Load</span>
                        <span className="font-black text-slate-900">{teacher.load}%</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${teacher.load}%` }} transition={{ delay: 0.5 + i * 0.08, duration: 0.8 }}
                          className={`h-full bg-gradient-to-r from-${teacher.color}-400 to-${teacher.color}-600 rounded-full`}/>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-[9px] text-slate-600 mb-0.5">Max Consecutive</div>
                        <div className="font-bold text-slate-900">{teacher.consecutive} periods</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-[9px] text-slate-600 mb-0.5">Free Day</div>
                        <div className="font-bold text-slate-900">{teacher.freeDay}</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-[9px] text-slate-600 mb-0.5">Subjects</div>
                        <div className="font-bold text-slate-900">{teacher.subjects.length}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              className="grid grid-cols-4 gap-3">
              {[
                { label: 'Avg Load', value: '93%', detail: 'Faculty average', color: 'cyan' },
                { label: 'Balanced', value: '43/45', detail: 'Within target range', color: 'emerald' },
                { label: 'Max Periods', value: '4', detail: 'Consecutive limit', color: 'blue' },
                { label: 'Free Days', value: '100%', detail: 'All honored', color: 'purple' }
              ].map((stat, i) => (
                <div key={i} className={`bg-gradient-to-br from-${stat.color}-50 to-white rounded-xl p-3 border-2 border-${stat.color}-200 text-center`}>
                  <div className="text-2xl font-black text-slate-900 mb-1">{stat.value}</div>
                  <div className="text-xs font-bold text-slate-700 mb-1">{stat.label}</div>
                  <div className="text-[9px] text-slate-600">{stat.detail}</div>
                </div>
              ))}
            </motion.div>
          </div>
        );

      case 9: // Student Scheduling
        return (
          <div className="space-y-4">
            <div className="text-center mb-5">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-xl">
                <Award className="w-10 h-10 text-white" />
              </div>
              <h4 className="text-xl font-black text-slate-900">Student-Centric Timetables</h4>
              <p className="text-xs text-slate-600 mt-2">Personalized schedules that optimize learning outcomes and subject balance</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'Emma Johnson', id: 'DP2-2024-089', programme: 'DP2', subjects: 6, hl: 3, sl: 3, groups: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'], hours: 32, balance: 'Perfect', cas: 14, predicted: 38 },
                { name: 'Liam Zhang', id: 'DP1-2024-156', programme: 'DP1', subjects: 6, hl: 4, sl: 2, groups: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'], hours: 34, balance: 'Good', cas: 8, predicted: 42 },
                { name: 'Sofia Martinez', id: 'DP2-2024-034', programme: 'DP2', subjects: 6, hl: 3, sl: 3, groups: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'], hours: 32, balance: 'Perfect', cas: 16, predicted: 40 },
                { name: 'Oliver Kim', id: 'DP1-2024-201', programme: 'DP1', subjects: 6, hl: 3, sl: 3, groups: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'], hours: 32, balance: 'Perfect', cas: 10, predicted: 35 }
              ].map((student, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 + 0.2 }}
                  className="bg-white rounded-xl p-4 border-2 border-slate-200 hover:shadow-xl transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-sm font-black text-slate-900 mb-0.5">{student.name}</div>
                      <div className="text-[10px] text-slate-600 font-semibold">{student.id}</div>
                    </div>
                    <div className="px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full text-[10px] font-bold">
                      {student.programme}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-blue-50 rounded-lg p-2 border border-blue-200">
                      <div className="text-[9px] text-blue-700 font-bold mb-1">Subject Balance</div>
                      <div className="text-xs font-black text-slate-900">{student.hl} HL • {student.sl} SL</div>
                      <div className={`text-[9px] mt-1 font-bold ${student.balance === 'Perfect' ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {student.balance === 'Perfect' ? '✓' : '○'} {student.balance}
                      </div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2 border border-purple-200">
                      <div className="text-[9px] text-purple-700 font-bold mb-1">IB Groups</div>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {student.groups.map((g, j) => (
                          <span key={j} className="text-[8px] font-bold bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded">{g}</span>
                        ))}
                      </div>
                      <div className="text-[9px] text-emerald-600 font-bold">✓ All Covered</div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-2.5 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600 font-semibold">Weekly Hours:</span>
                      <span className="font-black text-slate-900">{student.hours}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 font-semibold">CAS Activities:</span>
                      <span className="font-black text-slate-900">{student.cas}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 font-semibold">Predicted:</span>
                      <span className="font-black text-violet-600">{student.predicted} points</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              className="grid grid-cols-4 gap-3">
              {[
                { label: 'Students', value: '327', detail: 'Personalized schedules', color: 'violet' },
                { label: 'Perfect Balance', value: '94%', detail: 'Optimal subject mix', color: 'emerald' },
                { label: 'Avg Predicted', value: '36.2', detail: 'IB points', color: 'blue' },
                { label: 'Satisfaction', value: '98%', detail: 'Student feedback', color: 'pink' }
              ].map((stat, i) => (
                <div key={i} className={`bg-gradient-to-br from-${stat.color}-50 to-white rounded-xl p-3 border-2 border-${stat.color}-200 text-center`}>
                  <div className="text-2xl font-black text-slate-900 mb-1">{stat.value}</div>
                  <div className="text-xs font-bold text-slate-700 mb-1">{stat.label}</div>
                  <div className="text-[9px] text-slate-600">{stat.detail}</div>
                </div>
              ))}
            </motion.div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <section ref={sectionRef} className="relative py-24 px-4 sm:px-6 lg:px-8 bg-transparent overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            See It In Action
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Explore the features that make scheduling effortless
          </p>
        </div>

        <div className={`relative transition-all duration-500 ${expandedIndex !== null ? '' : 'flex flex-col lg:flex-row gap-8'}`}>
          <div ref={textContainerRef} className={`lg:w-[400px] lg:shrink-0 transition-opacity duration-300 ${
            expandedIndex !== null ? 'opacity-0 pointer-events-none absolute' : 'opacity-100'
          }`}>
            <div className={`transition-all duration-300 ${
              isSticky ? 'lg:fixed lg:top-1/2 lg:-translate-y-1/2 lg:w-[400px] lg:left-[max(2rem,calc(50%-44rem))]' : ''
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
                  We understand the unique challenges of IB scheduling because we've lived them. Our solution was born from real IB student experiences, designed to solve the complex timetabling problems that traditional tools can't handle.
                </p>
              </div>
            </div>
          </div>

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
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
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
                          <div className="lg:col-span-2 bg-gradient-to-br from-slate-50 to-slate-100 p-8">
                            <div className="bg-slate-800 rounded-t-lg px-4 py-2 flex items-center gap-2 mb-6">
                              <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                              </div>
                              <div className="flex-1 bg-slate-700 rounded px-3 py-1 text-xs text-slate-300 text-center">
                                schedual.app/{['dashboard', 'communication', 'curriculum', 'scheduling', 'compliance', 'groups', 'resources', 'conflicts', 'workload', 'students'][index]}
                              </div>
                            </div>

                            <div className="bg-white rounded-lg border border-slate-200 p-6 min-h-[550px]">
                              {renderPreview(index)}
                            </div>
                          </div>

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