import React from 'react';
import { motion } from 'framer-motion';

export default function ComparisonSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8">
          <div 
            className="bg-white p-8 rounded-2xl border-2 border-transparent group hover:bg-gradient-to-br hover:from-blue-900 hover:to-blue-950 transition-all cursor-pointer"
            style={{ borderImage: 'linear-gradient(to right, rgb(56, 189, 248), rgb(217, 70, 239), rgb(59, 130, 246)) 1' }}
          >
            <h3 className="text-2xl font-semibold text-slate-900 mb-4 group-hover:text-white transition-colors">Existing Solutions</h3>
            <ul className="space-y-3 text-slate-700 group-hover:text-blue-100 transition-colors">
              <li className="flex items-start gap-2">
                <span className="text-rose-600 mt-1 group-hover:text-red-300">•</span>
                <span>Manual scheduling takes weeks of work</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-600 mt-1 group-hover:text-red-300">•</span>
                <span>Teacher and room conflicts are common</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-600 mt-1 group-hover:text-red-300">•</span>
                <span>Changes require starting from scratch</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-600 mt-1 group-hover:text-red-300">•</span>
                <span>IB requirements are complex to manage</span>
              </li>
            </ul>
          </div>

          <div 
            className="bg-white p-8 rounded-2xl border-2 border-transparent group hover:bg-gradient-to-br hover:from-blue-900 hover:to-blue-950 transition-all cursor-pointer"
            style={{ borderImage: 'linear-gradient(to right, rgb(56, 189, 248), rgb(217, 70, 239), rgb(59, 130, 246)) 1' }}
          >
            <h3 className="text-2xl font-semibold text-slate-900 mb-4 group-hover:text-white transition-colors">IB Schedual Pro</h3>
            <ul className="space-y-3 text-slate-700 group-hover:text-blue-100 transition-colors">
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 mt-1 group-hover:text-emerald-300">✓</span>
                <span>Generate schedules in minutes with AI</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 mt-1 group-hover:text-emerald-300">✓</span>
                <span>Automatic conflict detection and resolution</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 mt-1 group-hover:text-emerald-300">✓</span>
                <span>Instant regeneration when rules change</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 mt-1 group-hover:text-emerald-300">✓</span>
                <span>Built-in IB compliance checks</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}