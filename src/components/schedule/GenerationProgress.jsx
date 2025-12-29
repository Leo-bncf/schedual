import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Loader2, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GenerationProgress({ open, progress, onClose }) {
  const { stage, percent, message, completed } = progress;

  return (
    <Dialog open={open} onOpenChange={completed ? onClose : undefined}>
      <DialogContent className="sm:max-w-md" hideClose={!completed}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {completed ? (
              <>
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Generation Complete!
              </>
            ) : (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                Generating Schedule
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 font-medium">{stage}</span>
              <span className="text-slate-900 font-semibold">{percent}%</span>
            </div>
            <Progress value={percent} className="h-2" />
          </div>

          {/* Status Message */}
          <AnimatePresence mode="wait">
            <motion.div
              key={message}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-slate-50 rounded-lg p-4"
            >
              <p className="text-sm text-slate-600">{message}</p>
            </motion.div>
          </AnimatePresence>

          {/* Steps Indicator */}
          <div className="space-y-3">
            {[
              { label: 'Assigning teachers', key: 'teachers' },
              { label: 'Scheduling DP groups', key: 'dp' },
              { label: 'Scheduling MYP classes', key: 'myp' },
              { label: 'Scheduling PYP classes', key: 'pyp' },
              { label: 'Creating schedule slots', key: 'slots' },
              { label: 'Finalizing schedule', key: 'finalize' }
            ].map(step => {
              const isComplete = progress.completedSteps?.includes(step.key);
              const isCurrent = progress.currentStep === step.key;
              
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                    isComplete 
                      ? 'bg-emerald-100 text-emerald-600' 
                      : isCurrent 
                      ? 'bg-indigo-100 text-indigo-600' 
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    {isComplete ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : isCurrent ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-current" />
                    )}
                  </div>
                  <span className={`text-sm ${
                    isComplete 
                      ? 'text-slate-600 line-through' 
                      : isCurrent 
                      ? 'text-slate-900 font-medium' 
                      : 'text-slate-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}