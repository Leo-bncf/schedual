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
          <div className="space-y-5 p-6">
            <div className="mb-4">
              <h4 className="text-lg font-bold text-slate-900 mb-2">Real-Time Operations Dashboard</h4>
              <p className="text-sm text-slate-600">Monitor your entire school at a glance with live data, AI-powered insights, and instant conflict detection across all programmes.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                <Users className="w-10 h-10 mb-4 opacity-90 relative z-10" />
                <div className="text-5xl font-black mb-2 relative z-10">45</div>
                <div className="text-sm font-semibold opacity-90 mb-2 relative z-10">Active Teachers</div>
                <div className="text-xs opacity-80 relative z-10">38 full-time • 7 part-time</div>
                <div className="text-xs opacity-70 mt-1 relative z-10">Avg: 22.4h/week • 98% satisfaction</div>
              </motion.div>
              
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                <GraduationCap className="w-10 h-10 mb-4 opacity-90 relative z-10" />
                <div className="text-5xl font-black mb-2 relative z-10">327</div>
                <div className="text-sm font-semibold opacity-90 mb-2 relative z-10">Total Students</div>
                <div className="text-xs opacity-80 relative z-10">DP1: 89 • DP2: 92 • MYP: 146</div>
                <div className="text-xs opacity-70 mt-1 relative z-10">18:1 student-teacher ratio</div>
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="bg-white rounded-xl border-2 border-emerald-300 shadow-xl">
              <div className="bg-gradient-to-r from-emerald-500 to-blue-500 p-5 text-white relative overflow-hidden">
                <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{ x: ['-200%', '200%'] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}/>
                <div className="relative flex justify-between items-center">
                  <div>
                    <div className="font-black text-xl mb-1">Active Schedule</div>
                    <div className="text-sm opacity-90 font-medium">DP Programme 2024-25 • Term 1</div>
                    <div className="text-xs opacity-80 mt-1">Generated 2h ago • Auto-optimized by AI</div>
                  </div>
                  <div className="text-right">
                    <div className="text-5xl font-black">98</div>
                    <div className="text-xs opacity-90 font-semibold">Quality Score</div>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {[
                    { label: 'Conflicts', value: '0', icon: '✓', color: 'emerald' },
                    { label: 'Coverage', value: '100%', icon: '📚', color: 'blue' },
                    { label: 'Rooms', value: '94%', icon: '🏢', color: 'purple' },
                    { label: 'Balance', value: 'A+', icon: '⚖️', color: 'indigo' },
                    { label: 'IB Valid', value: '✓', icon: '🎓', color: 'emerald' }
                  ].map((m, i) => (
                    <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 + i * 0.05 }}
                      className={`bg-gradient-to-br from-${m.color}-50 to-white rounded-lg p-3 text-center border-2 border-${m.color}-200`}>
                      <div className="text-lg mb-1">{m.icon}</div>
                      <div className="text-xl font-bold text-slate-900">{m.value}</div>
                      <div className="text-[9px] font-semibold text-slate-700">{m.label}</div>
                    </motion.div>
                  ))}
                </div>

                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="font-bold text-slate-700">AI Optimization Progress</span>
                    <span className="font-black text-slate-900">98/100</span>
                  </div>
                  <div className="h-2.5 bg-white rounded-full overflow-hidden border border-slate-300">
                    <motion.div initial={{ width: 0 }} animate={{ width: '98%' }} transition={{ delay: 0.6, duration: 1.2, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500 rounded-full"/>
                  </div>
                  <div className="flex justify-between mt-2 text-[9px] text-slate-600">
                    <span>⚡ Generated in 47 seconds</span>
                    <span>🕒 Updated 2 hours ago</span>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: '📊', value: '24', label: 'Subjects', desc: 'HL: 12, SL: 12' },
                { icon: '🎓', value: '18', label: 'Groups', desc: 'Avg 18.2 students' },
                { icon: '🏢', value: '18', label: 'Rooms', desc: '94% utilization' },
                { icon: '⏱️', value: '240', label: 'Periods', desc: '8 per day' }
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.05 }}
                  className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-3 border-2 border-slate-200 text-center">
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="text-2xl font-black text-slate-900">{s.value}</div>
                  <div className="text-[10px] font-bold text-slate-700">{s.label}</div>
                  <div className="text-[9px] text-slate-600 mt-1">{s.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 1: // Scheduling
        return (
          <div className="space-y-5 p-6">
            <div className="mb-4">
              <h4 className="text-lg font-bold text-slate-900 mb-2">AI-Generated Timetables</h4>
              <p className="text-sm text-slate-600">Create conflict-free schedules in minutes. Our AI engine optimizes for teacher preferences, room availability, IB requirements, and student needs simultaneously.</p>
            </div>

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Week View</div>
                  <div className="text-xs text-slate-600">Monday, Jan 6 - Friday, Jan 10</div>
                </div>
              </div>
              <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                ✓ Zero Conflicts
              </div>
            </div>

            <div className="bg-white rounded-xl border-2 border-slate-200 p-2 shadow-lg">
              <div className="grid grid-cols-6 gap-1">
                <div></div>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, idx) => (
                  <motion.div key={day} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                    className="text-xs font-black text-slate-800 text-center py-2.5 bg-slate-100 rounded-lg border border-slate-200">
                    {day}
                  </motion.div>
                ))}
                {[
                  { period: 'P1', time: '08:00' },
                  { period: 'P2', time: '09:00' },
                  { period: 'Break', isBreak: true },
                  { period: 'P3', time: '10:20' },
                  { period: 'P4', time: '11:20' }
                ].map((slot, periodIdx) => (
                  <React.Fragment key={periodIdx}>
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: periodIdx * 0.05 }}
                      className="flex flex-col justify-center text-center py-2.5 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-[10px] font-black text-slate-900">{slot.period}</div>
                      {slot.time && <div className="text-[8px] text-slate-600 font-semibold">{slot.time}</div>}
                    </motion.div>
                    {slot.isBreak ? (
                      [...Array(5)].map((_, i) => (
                        <div key={i} className="bg-gradient-to-br from-slate-100 to-slate-50 rounded-lg flex items-center justify-center border border-slate-200">
                          <span className="text-base">☕</span>
                        </div>
                      ))
                    ) : (
                      [
                        { subject: 'Physics HL', room: 'Lab 2', teacher: 'Dr. P', color: 'from-blue-500 to-blue-600' },
                        { subject: 'Math AA SL', room: 'R-104', teacher: 'Mr. K', color: 'from-purple-500 to-purple-600' },
                        { subject: 'English A', room: 'R-201', teacher: 'Ms. T', color: 'from-emerald-500 to-emerald-600' },
                        { subject: 'Chemistry HL', room: 'Lab 1', teacher: 'Dr. C', color: 'from-orange-500 to-orange-600' },
                        { subject: 'TOK', room: 'R-301', teacher: 'Mr. S', color: 'from-pink-500 to-pink-600' }
                      ].map((cls, i) => (
                        <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: (periodIdx * 5 + i) * 0.02 }}
                          className={`rounded-lg p-2.5 bg-gradient-to-br ${cls.color} text-white shadow-md hover:shadow-lg transition-shadow border border-white/20`}>
                          <div className="text-[10px] font-bold leading-tight mb-1">{cls.subject}</div>
                          <div className="text-[8px] opacity-90 font-semibold">{cls.room}</div>
                          <div className="text-[8px] opacity-80">{cls.teacher}</div>
                        </motion.div>
                      ))
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mt-4">
              {[
                { label: '✓ IB Compliant', value: 'All met', color: 'blue' },
                { label: '✓ Zero Conflicts', value: '45 teachers', color: 'emerald' },
                { label: '📊 Room Usage', value: '94%', color: 'purple' },
                { label: '⚡ Generated', value: '47 sec', color: 'indigo' }
              ].map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.05 }}
                  className={`bg-gradient-to-br from-${stat.color}-50 to-white rounded-lg p-3 border-2 border-${stat.color}-200 text-center`}>
                  <div className="text-xs font-bold text-slate-700 mb-1">{stat.label}</div>
                  <div className="text-lg font-black text-slate-900">{stat.value}</div>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 2: // Communication
        return (
          <div className="space-y-5 p-6">
            <div className="mb-4">
              <h4 className="text-lg font-bold text-slate-900 mb-2">Unified Communication Hub</h4>
              <p className="text-sm text-slate-600">Keep your entire school community connected with real-time announcements, updates, and notifications. Parents, teachers, and students stay informed effortlessly.</p>
            </div>

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Recent Updates</div>
                  <div className="text-xs text-slate-600">Last 24 hours</div>
                </div>
              </div>
              <div className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                8 New
              </div>
            </div>

            {[
              { title: 'Parent-Teacher Conferences: Booking Now Open', desc: 'January 15-17 conference slots available. Parents can book 15-minute sessions through the portal. 156 slots already reserved.', time: '2h ago', user: 'Sarah Mitchell, Admin', color: 'blue', reactions: 24, comments: 8 },
              { title: 'DP2 Report Cards & Predicted Grades Published', desc: 'All DP2 students received Term 1 reports with IB predicted grades. Class average: 36 points. 15 students achieved 40+ predictions.', time: '5h ago', user: 'Mr. Johnson, DP Coordinator', color: 'emerald', reactions: 67, comments: 23 },
              { title: 'Science Fair 2025: "Innovations for Tomorrow"', desc: '47 student projects approved across MYP and DP. Guest judges from Stanford and MIT confirmed. Exhibition on March 15.', time: '1d ago', user: 'Dr. Chen, Science Dept', color: 'purple', reactions: 52, comments: 14 }
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 + 0.2 }}
                className="bg-white rounded-xl p-4 border-2 border-slate-200 hover:shadow-xl hover:border-slate-300 transition-all group cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br from-${item.color}-400 to-${item.color}-600 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform`}>
                    <Bell className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 mb-1.5 group-hover:text-blue-600 transition-colors">{item.title}</div>
                    <div className="text-xs text-slate-700 leading-relaxed mb-3">{item.desc}</div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
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

            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: 'Announcements', value: '47', sub: '+12 this week', color: 'blue' },
                { label: 'Messages', value: '1.2k', sub: 'This month', color: 'purple' },
                { label: 'Engagement', value: '94%', sub: 'Read rate', color: 'emerald' }
              ].map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.05 }}
                  className={`bg-gradient-to-br from-${stat.color}-50 to-white rounded-lg p-3 border-2 border-${stat.color}-200 text-center`}>
                  <div className="text-2xl font-black text-slate-900 mb-1">{stat.value}</div>
                  <div className="text-[10px] font-bold text-slate-700 mb-1">{stat.label}</div>
                  <div className="text-[9px] text-slate-600">{stat.sub}</div>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 3: // Curriculum
        return (
          <div className="space-y-5 p-6">
            <div className="mb-4">
              <h4 className="text-lg font-bold text-slate-900 mb-2">Advanced Curriculum Tracking</h4>
              <p className="text-sm text-slate-600">Monitor teaching progress, track learning objectives, manage IB assessments, and ensure curriculum compliance with detailed analytics and automated reporting.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { subject: 'Physics HL', teacher: 'Dr. Peterson', progress: 75, units: '6/8', color: 'blue', next: 'Quantum Physics', hours: '54/72h', students: 18 },
                { subject: 'Math AA SL', teacher: 'Mr. Kumar', progress: 90, units: '7/8', color: 'purple', next: 'Calculus Review', hours: '36/48h', students: 20 },
                { subject: 'English A', teacher: 'Ms. Thompson', progress: 60, units: '5/8', color: 'emerald', next: 'Poetry Analysis', hours: '28/48h', students: 22 },
                { subject: 'Chemistry HL', teacher: 'Dr. Chen', progress: 85, units: '7/8', color: 'orange', next: 'Organic Chem', hours: '64/72h', students: 16 }
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 + 0.2 }}
                  className="bg-white rounded-xl p-4 border-2 border-slate-200 hover:shadow-xl transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{item.subject}</div>
                      <div className="text-xs text-slate-600 font-semibold mt-0.5">{item.teacher} • {item.students} students</div>
                    </div>
                    <div className="px-2 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-700">
                      {item.units}
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-slate-600 font-semibold">Course Progress</span>
                      <span className="font-black text-slate-900">{item.progress}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${item.progress}%` }} transition={{ delay: i * 0.1 + 0.4, duration: 1 }}
                        className={`h-full bg-gradient-to-r from-${item.color}-400 to-${item.color}-600 rounded-full`}/>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-2 space-y-1 text-xs border border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                      <span className="text-slate-700"><span className="font-semibold">Next:</span> {item.next}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                      <span className="text-slate-700"><span className="font-semibold">Hours:</span> {item.hours}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
              className="bg-gradient-to-br from-indigo-50 to-white rounded-xl p-4 border-2 border-indigo-200">
              <div className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="text-lg">🎓</span>
                IB Core Components Status
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: 'TOK', status: 'Essays: 78%', students: '89/92', color: 'blue' },
                  { name: 'CAS', status: 'Avg: 12 activities', students: '85/92', color: 'emerald' },
                  { name: 'EE', status: 'Topics: 92%', students: '84/92', color: 'purple' }
                ].map((core, i) => (
                  <div key={i} className={`bg-white rounded-lg p-3 border-2 border-${core.color}-200 text-center`}>
                    <div className="text-xs font-black text-slate-900 mb-1">{core.name}</div>
                    <div className="text-xs text-slate-700 font-semibold mb-1">{core.status}</div>
                    <div className="text-[10px] text-slate-600">{core.students}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        );

      case 4: // IB Compliance
        return (
          <div className="space-y-5 p-6">
            <div className="mb-4">
              <h4 className="text-lg font-bold text-slate-900 mb-2">IB Programme Compliance Engine</h4>
              <p className="text-sm text-slate-600">Automatically validate all IB requirements including subject groups, HL/SL ratios, core components, and teaching hours. Built-in checks for PYP, MYP, and DP standards.</p>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-5 border-2 border-emerald-300 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-lg font-black text-slate-900">DP Programme Status</div>
                    <div className="text-xs text-slate-600 font-semibold">Real-time validation • 181 students</div>
                  </div>
                </div>
                <div className="px-4 py-2 bg-emerald-500 text-white rounded-full text-xs font-bold shadow-md">
                  ✓ 100% Compliant
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Subject Groups', requirement: '6 groups mandatory', status: '✓ All 6 covered', students: '181/181', color: 'blue' },
                  { label: 'HL/SL Balance', requirement: '3 HL, 3 SL minimum', status: '✓ All balanced', students: 'Avg: 3.2 HL', color: 'purple' },
                  { label: 'Teaching Hours', requirement: 'HL: 240h, SL: 150h', status: '✓ All met', students: '4,320 total hours', color: 'emerald' },
                  { label: 'Core Components', requirement: 'TOK, CAS, EE', status: '✓ All assigned', students: '181/181 enrolled', color: 'pink' }
                ].map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.08 }}
                    className={`bg-white rounded-xl p-4 border-2 border-${item.color}-200`}>
                    <div className="text-sm font-black text-slate-900 mb-2">{item.label}</div>
                    <div className="text-xs text-slate-600 mb-2 font-semibold">{item.requirement}</div>
                    <div className="text-xs font-bold text-emerald-600 mb-1">{item.status}</div>
                    <div className="text-[10px] text-slate-500">{item.students}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              className="bg-white rounded-xl p-4 border-2 border-slate-200">
              <div className="text-sm font-bold text-slate-900 mb-3">IB Subject Group Distribution</div>
              <div className="grid grid-cols-6 gap-2">
                {[
                  { group: 'G1', name: 'Lang & Lit', students: 181, coverage: '100%', color: 'red' },
                  { group: 'G2', name: 'Lang Acq', students: 156, coverage: '86%', color: 'orange' },
                  { group: 'G3', name: 'Individuals', students: 167, coverage: '92%', color: 'amber' },
                  { group: 'G4', name: 'Sciences', students: 181, coverage: '100%', color: 'emerald' },
                  { group: 'G5', name: 'Math', students: 181, coverage: '100%', color: 'blue' },
                  { group: 'G6', name: 'Arts', students: 89, coverage: '49%', color: 'purple' }
                ].map((g, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 + i * 0.05 }}
                    className={`bg-gradient-to-br from-${g.color}-50 to-white rounded-lg p-2 border-2 border-${g.color}-200 text-center`}>
                    <div className="text-[10px] font-black text-slate-900 mb-0.5">{g.group}</div>
                    <div className="text-[8px] text-slate-700 font-semibold mb-1 leading-tight">{g.name}</div>
                    <div className="text-base font-black text-slate-900">{g.students}</div>
                    <div className="text-[8px] text-slate-600 mt-0.5">{g.coverage}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        );

      case 5: // Workload
        return (
          <div className="space-y-5 p-6">
            <div className="mb-4">
              <h4 className="text-lg font-bold text-slate-900 mb-2">Teacher Workload Balancing</h4>
              <p className="text-sm text-slate-600">Ensure fair distribution of teaching hours, respect maximum periods, honor availability preferences, and maintain sustainable workloads. Keep your faculty happy and effective.</p>
            </div>

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Faculty Analytics</div>
                  <div className="text-xs text-slate-600">45 teachers tracked</div>
                </div>
              </div>
              <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                A+ Balance Score
              </div>
            </div>

            <div className="space-y-3">
              {[
                { name: 'Dr. Peterson', dept: 'Science', hours: 24, target: 25, load: 96, consecutive: 3, freeDay: 'Wed', subjects: 2, color: 'blue' },
                { name: 'Ms. Thompson', dept: 'Language A', hours: 22, target: 25, load: 88, consecutive: 4, freeDay: 'Fri', subjects: 2, color: 'purple' },
                { name: 'Mr. Kumar', dept: 'Mathematics', hours: 23, target: 25, load: 92, consecutive: 3, freeDay: 'Thu', subjects: 2, color: 'emerald' },
                { name: 'Dr. Chen', dept: 'Science', hours: 25, target: 25, load: 100, consecutive: 4, freeDay: 'Mon', subjects: 2, color: 'orange' }
              ].map((teacher, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 + 0.2 }}
                  className="bg-white rounded-xl p-4 border-2 border-slate-200 hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{teacher.name}</div>
                      <div className="text-xs text-slate-600 font-semibold">{teacher.dept}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-slate-900">{teacher.hours}h</div>
                      <div className="text-[10px] text-slate-600">/ {teacher.target}h</div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-600 font-semibold">Weekly Load</span>
                      <span className="font-black text-slate-900">{teacher.load}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${teacher.load}%` }} transition={{ delay: i * 0.1 + 0.4, duration: 0.8 }}
                        className={`h-full bg-gradient-to-r from-${teacher.color}-400 to-${teacher.color}-600 rounded-full`}/>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                      <div className="text-[9px] text-slate-600 mb-0.5">Max Periods</div>
                      <div className="font-bold text-slate-900">{teacher.consecutive}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                      <div className="text-[9px] text-slate-600 mb-0.5">Free Day</div>
                      <div className="font-bold text-slate-900">{teacher.freeDay}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                      <div className="text-[9px] text-slate-600 mb-0.5">Subjects</div>
                      <div className="font-bold text-slate-900">{teacher.subjects}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-3 mt-4">
              {[
                { label: 'Avg Load', value: '94%', color: 'cyan' },
                { label: 'Balanced', value: '43/45', color: 'emerald' },
                { label: 'Free Days', value: '100%', color: 'blue' },
                { label: 'Satisfaction', value: '98%', color: 'purple' }
              ].map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.05 }}
                  className={`bg-gradient-to-br from-${stat.color}-50 to-white rounded-lg p-3 border-2 border-${stat.color}-200 text-center`}>
                  <div className="text-xl font-black text-slate-900 mb-1">{stat.value}</div>
                  <div className="text-[10px] font-bold text-slate-700">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8 bg-white">
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