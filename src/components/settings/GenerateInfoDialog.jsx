import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion } from 'framer-motion';
import { Sparkles, Users, Zap, CheckCircle2, Loader2 } from 'lucide-react';

export default function GenerateInfoDialog({ open, onOpenChange, onConfirm, type = 'classgroups', isGenerating = false }) {
  const config = {
    classgroups: {
      title: 'Auto-Generate Class Groups',
      description: 'Let AI organize your students into balanced batches',
      steps: [
        { icon: Users, text: 'Analyze all students by year group & programme', color: 'text-blue-500' },
        { icon: Zap, text: 'Create balanced batches (max 20 per group)', color: 'text-amber-500' },
        { icon: CheckCircle2, text: 'Assign students automatically', color: 'text-emerald-500' }
      ],
      note: 'This will organize all students who are not currently in a ClassGroup',
      gradient: 'from-blue-500 to-indigo-600'
    },
    teachinggroups: {
      title: 'AI Teaching Group Generator',
      description: 'Smart organization of DP students into subject classes',
      steps: [
        { icon: Users, text: 'Analyze student subject choices & levels', color: 'text-violet-500' },
        { icon: Zap, text: 'Create balanced teaching groups', color: 'text-pink-500' },
        { icon: CheckCircle2, text: 'Assign teachers & rooms intelligently', color: 'text-emerald-500' }
      ],
      note: 'The AI will consider IB requirements, teacher qualifications, and student preferences',
      gradient: 'from-violet-500 to-purple-600'
    }
  };

  const current = config[type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden p-0">
        <div className={`relative bg-gradient-to-r ${current.gradient} p-6 overflow-hidden`}>
          <motion.div
            className="absolute inset-0 opacity-20"
            animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
            transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse' }}
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
          />
          <DialogHeader className="relative">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-8 h-8 text-white" />
              <DialogTitle className="text-2xl font-bold text-white">{current.title}</DialogTitle>
            </div>
            <DialogDescription className="text-white/90 text-sm">{current.description}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            {current.steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
              >
                <div className={`${step.color} mt-0.5`}>
                  <step.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">{step.text}</p>
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.1 + 0.3, type: 'spring' }}
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold"
                >
                  {index + 1}
                </motion.div>
              </motion.div>
            ))}
          </div>

          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">ℹ️ Note:</span> {current.note}
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={isGenerating}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className={`flex-1 bg-gradient-to-r ${current.gradient} hover:opacity-90 transition-opacity text-white`}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Start Generation
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}