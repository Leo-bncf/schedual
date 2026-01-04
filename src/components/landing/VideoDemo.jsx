import React, { useState } from 'react';
import { Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function VideoDemo() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-transparent">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <div className="inline-block px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-4">
              See It In Action
            </div>
            <h2 className="text-4xl font-black text-slate-900 mb-4">
              Watch Schedual Transform Your Workflow
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              See how administrators create perfect schedules in minutes using our AI-powered platform. Watch real workflows in action.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative"
        >
          <div className="relative rounded-3xl overflow-hidden border-4 border-slate-200 shadow-2xl bg-white">
            {/* Video Placeholder / Thumbnail */}
            <div className="relative aspect-video bg-gradient-to-br from-slate-100 to-slate-200">
              <img 
                src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&h=675&fit=crop" 
                alt="Dashboard Preview" 
                className="w-full h-full object-cover"
              />
              
              {/* Play Button Overlay */}
              {!isPlaying && (
                <button
                  onClick={() => setIsPlaying(true)}
                  className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm hover:bg-slate-900/50 transition-all group"
                >
                  <div className="w-24 h-24 rounded-full bg-white shadow-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="w-10 h-10 text-blue-600 ml-1" />
                  </div>
                </button>
              )}

              {/* Duration Badge */}
              <div className="absolute top-4 right-4 px-3 py-1 bg-slate-900/80 backdrop-blur-sm text-white rounded-full text-sm font-semibold">
                3:45
              </div>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute -top-6 -left-6 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl"></div>
        </motion.div>

        {/* Video Modal */}
        <AnimatePresence>
          {isPlaying && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
              onClick={() => setIsPlaying(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-5xl"
              >
                <button
                  onClick={() => setIsPlaying(false)}
                  className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors flex items-center justify-center text-white"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden">
                  {/* Replace this with actual video embed when available */}
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <div className="text-center">
                      <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Video demo coming soon</p>
                      <p className="text-sm text-slate-400 mt-2">Add your demo video URL here</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 grid md:grid-cols-3 gap-6"
        >
          {[
            { label: 'Setup Time', value: '< 5 minutes', emoji: '⚡' },
            { label: 'Schedule Generation', value: '47 seconds', emoji: '🚀' },
            { label: 'User Satisfaction', value: '98%', emoji: '⭐' }
          ].map((stat, i) => (
            <div key={i} className="text-center p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200">
              <div className="text-3xl mb-2">{stat.emoji}</div>
              <div className="text-2xl font-black text-slate-900 mb-1">{stat.value}</div>
              <div className="text-sm text-slate-600 font-medium">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}