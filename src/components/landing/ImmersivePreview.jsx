import React from 'react';
import { motion } from 'framer-motion';
import { Play, Calendar, Users, Sparkles } from 'lucide-react';

export default function ImmersivePreview() {
  return (
    <section id="preview" className="relative min-h-[90vh] w-full overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100 py-20">
      {/* Soft background orbs */}
      <motion.div
        className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl"
        animate={{ y: [0, 15, 0], x: [0, 10, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 -right-24 h-80 w-80 rounded-full bg-purple-200/30 blur-3xl"
        animate={{ y: [0, -10, 0], x: [0, -10, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">See It In Action</h2>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto">An immersive peek at how Schedual brings your IB timetable to life.</p>
        </div>

        {/* Mock browser */}
        <div className="relative">
          {/* floating badges */}
          <motion.div
            className="hidden md:flex items-center gap-2 absolute -left-6 -top-6 rounded-full bg-white shadow-lg border border-slate-200 px-3 py-2"
            initial={{ opacity: 0, y: -10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Calendar className="w-4 h-4 text-blue-900" />
            <span className="text-xs font-medium text-slate-700">Conflict-free</span>
          </motion.div>
          <motion.div
            className="hidden md:flex items-center gap-2 absolute -right-6 -bottom-6 rounded-full bg-white shadow-lg border border-slate-200 px-3 py-2"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Users className="w-4 h-4 text-blue-900" />
            <span className="text-xs font-medium text-slate-700">Balanced loads</span>
          </motion.div>

          <div className="rounded-[22px] overflow-hidden border border-slate-200 bg-white shadow-2xl">
            {/* Browser chrome */}
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-900">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-500" />
              </div>
              <div className="flex-1 mx-3 h-7 rounded-md bg-slate-800 text-slate-300 text-xs flex items-center px-3">
                schedual.app/demo
              </div>
              <button className="hidden sm:inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white">
                <Play className="w-3.5 h-3.5" /> Quick tour
              </button>
            </div>

            {/* Content */}
            <div className="p-5 sm:p-8 bg-gradient-to-b from-white to-slate-50">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Timetable grid */}
                <div className="relative">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-blue-900 text-white flex items-center justify-center text-[10px]">DP</div>
                    <h3 className="font-semibold text-slate-900">DP1 – Weekly Timetable</h3>
                  </div>
                  <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="grid grid-cols-6 text-[11px] text-slate-600">
                      <div className="p-2 font-medium bg-slate-50">Time</div>
                      {["Mon","Tue","Wed","Thu","Fri"].map((d) => (
                        <div key={d} className="p-2 font-medium bg-slate-50 text-center">{d}</div>
                      ))}
                    </div>
                    {[
                      { label: 'P1', blocks: ['Physics','English A','Math','Chemistry','Spanish'] },
                      { label: 'P2', blocks: ['Math','TOK','Physics','Biology','Economics'] },
                      { label: 'P3', blocks: ['Chemistry','Math','History','English A','Geography'] },
                      { label: 'P4', blocks: ['Lunch','Lunch','Lunch','Lunch','Lunch'] },
                      { label: 'P5', blocks: ['Biology','Physics','Math','Chemistry','English A'] },
                    ].map((row, i) => (
                      <div key={i} className="grid grid-cols-6 border-t border-slate-100">
                        <div className="p-2 text-[11px] text-slate-500 bg-slate-50">{row.label}</div>
                        {row.blocks.map((b, j) => (
                          <div key={j} className="p-2">
                            <div className={`text-center text-[11px] rounded-md px-2 py-1 font-medium ${b==='Lunch' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-blue-50 text-blue-900 border border-blue-200'}`}>
                              {b}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* scanning highlight */}
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      initial={{ x: '-100%' }}
                      animate={{ x: ['-100%','100%'] }}
                      transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    >
                      <div className="h-full w-32 bg-gradient-to-r from-transparent via-blue-100/40 to-transparent" />
                    </motion.div>
                  </div>
                </div>

                {/* Right column: status & cards */}
                <div className="space-y-6">
                  {/* Generation status */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-blue-900 text-white flex items-center justify-center">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">AI Generation</div>
                          <div className="text-xs text-slate-500">Optimizing constraints</div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">00:12</div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {[
                        { t: 'Analyzing constraints', p: 100 },
                        { t: 'Balancing teacher loads', p: 90 },
                        { t: 'Placing rooms', p: 72 },
                        { t: 'Resolving conflicts', p: 45 },
                      ].map((s, idx) => (
                        <div key={idx}>
                          <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                            <span>{s.t}</span><span>{s.p}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                              initial={{ width: 0 }}
                              whileInView={{ width: `${s.p}%` }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.8, delay: idx * 0.15 }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Teacher & rule cards */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <motion.div
                      className="rounded-xl border border-slate-200 bg-white p-4"
                      whileHover={{ y: -2 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    >
                      <div className="text-xs text-slate-500 mb-1">Teacher</div>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Dr. Sarah Johnson</div>
                          <div className="text-xs text-slate-500">Physics HL/SL</div>
                        </div>
                      </div>
                      <div className="mt-3 text-[11px] text-slate-600">Max 4 consecutive periods • Prefers morning</div>
                    </motion.div>

                    <motion.div
                      className="rounded-xl border border-slate-200 bg-white p-4"
                      whileHover={{ y: -2 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    >
                      <div className="text-xs text-slate-500 mb-1">Rule</div>
                      <div className="text-sm font-semibold text-slate-900">Science labs for HL Sciences</div>
                      <div className="mt-3 flex items-center gap-2 text-[11px]">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">Room</span>
                      </div>
                    </motion.div>
                  </div>

                  {/* CTA row */}
                  <div className="flex items-center gap-3">
                    <a
                      href="#pricing"
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      <Sparkles className="w-4 h-4" /> Start in minutes
                    </a>
                    <button className="text-sm text-slate-600 hover:text-slate-900">Learn more →</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}