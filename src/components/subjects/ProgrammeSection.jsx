import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

export default function ProgrammeSection({ title, subtitle, count, colorClass, icon: Icon, children }) {
  return (
    <div>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-3 flex-1">
          <motion.div className={`w-14 h-14 rounded-2xl ${colorClass} flex items-center justify-center shadow-xl`} whileHover={{ rotate: 360, scale: 1.1 }} transition={{ duration: 0.6 }}>
            <Icon className="w-7 h-7 text-white" />
          </motion.div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          </div>
        </div>
        <Badge className={`${colorClass} text-white border-0 shadow-md text-base px-4 py-1`}>{count} subjects</Badge>
      </motion.div>
      {children}
    </div>
  );
}