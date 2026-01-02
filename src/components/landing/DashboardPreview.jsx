import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Users, GraduationCap, BookOpen, Building2, Sparkles } from 'lucide-react';

export default function DashboardPreview() {
  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8 bg-transparent overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            See It In Action
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            A glimpse into your powerful scheduling dashboard
          </p>
        </div>

        {/* Dashboard Preview */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative"
        >
          {/* Browser Chrome */}
          <div className="bg-slate-800 rounded-t-2xl p-3 flex items-center gap-2">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="flex-1 bg-slate-700 rounded-md px-4 py-1 text-xs text-slate-400 text-center">
              schedual.app/dashboard
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-b-2xl p-8 border-4 border-slate-800 shadow-2xl">
            {/* Header */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Dashboard Overview</h3>
              <p className="text-slate-600">Welcome back! Here's your school at a glance.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {[
                { icon: Users, label: 'Teachers', value: '45', color: 'from-blue-500 to-blue-600' },
                { icon: GraduationCap, label: 'Students', value: '327', color: 'from-purple-500 to-purple-600' },
                { icon: BookOpen, label: 'Subjects', value: '24', color: 'from-emerald-500 to-emerald-600' },
                { icon: Building2, label: 'Rooms', value: '18', color: 'from-amber-500 to-amber-600' },
                { icon: Calendar, label: 'Schedules', value: '3', color: 'from-rose-500 to-rose-600' },
                { icon: Sparkles, label: 'AI Insights', value: '12', color: 'from-cyan-500 to-cyan-600' },
              ].map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</div>
                  <div className="text-sm text-slate-600">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            {/* Schedule Preview */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Recent Schedule Activity</h4>
              <div className="space-y-3">
                {[
                  { status: 'published', title: 'DP Schedule 2024-25', time: '2 hours ago' },
                  { status: 'draft', title: 'MYP Schedule (Draft v2)', time: 'Yesterday' },
                  { status: 'generating', title: 'PYP Fall Term', time: 'In progress...' },
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className={`w-2 h-2 rounded-full ${
                      item.status === 'published' ? 'bg-green-500' :
                      item.status === 'draft' ? 'bg-amber-500' : 'bg-blue-500 animate-pulse'
                    }`}></div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{item.title}</div>
                      <div className="text-xs text-slate-500">{item.time}</div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      item.status === 'published' ? 'bg-green-100 text-green-700' :
                      item.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {item.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Glow effect */}
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 rounded-3xl blur-2xl -z-10"></div>
        </motion.div>
      </div>
    </section>
  );
}