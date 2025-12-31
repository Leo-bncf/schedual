import React from 'react';
import { GraduationCap, Heart } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MissionSection() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-400 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-sky-400 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.div 
          className="inline-flex items-center gap-2 mb-6 bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full"
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <GraduationCap className="w-6 h-6 text-white" />
          <span className="text-white font-semibold text-lg">Built by IB Students, For IB Students</span>
          <Heart className="w-5 h-5 text-white" />
        </motion.div>

        <motion.p 
          className="text-xl md:text-2xl text-white/95 leading-relaxed font-light"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          We understand the complexity of IB scheduling because we've lived it. Schedual was created by former IB students who experienced firsthand the challenges of timetabling conflicts, teacher availability issues, and the stress of manual schedule management. Our mission is to bring intelligent automation to IB schools worldwide, saving time for what truly matters—education.
        </motion.p>
      </div>
    </section>
  );
}