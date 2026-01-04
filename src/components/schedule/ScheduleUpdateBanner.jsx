import React from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, X, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ScheduleUpdateBanner({ 
  show, 
  onRegenerate, 
  onDismiss,
  isGenerating 
}) {
  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="mb-6"
      >
        <Alert className="border-0 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <AlertDescription className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Data has changed.</span> Students, teachers, or rooms were updated since the last schedule generation.
              </AlertDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={onRegenerate}
                disabled={isGenerating}
                className="bg-blue-600 hover:bg-blue-700 rounded-xl"
                size="sm"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Regenerate Schedule
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDismiss}
                className="h-8 w-8 rounded-lg"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Alert>
      </motion.div>
    </AnimatePresence>
  );
}