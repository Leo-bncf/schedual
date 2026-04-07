import React from 'react';
import { GraduationCap, Heart } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MissionSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-transparent relative overflow-hidden">

      <div className="max-w-4xl mx-auto text-center relative z-10 rounded-[2rem] border border-slate-200 bg-white/80 px-6 py-10 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur sm:px-10">
        <motion.div 
          className="inline-flex items-center gap-2 mb-6 bg-blue-50/70 backdrop-blur-md px-6 py-3 rounded-full"
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <GraduationCap className="w-6 h-6 text-blue-900" />
          <span className="text-blue-900 font-semibold text-lg">Built by IB Students, For IB Students</span>
          <Heart className="w-5 h-5 text-blue-900" />
        </motion.div>

        <motion.p 
          className="text-lg md:text-xl text-slate-700 leading-8 font-light"
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