import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function ScheduleGenerationDialog({ open, onClose, status, message, error }) {
  const isTeacherCapacityError = message && typeof message === 'object' && message.overloadedTeachers;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === 'generating' && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
            {status === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
            {status === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
            {status === 'generating' ? 'Generating Schedule...' : 
             status === 'success' ? 'Schedule Generated!' : 
             'Generation Failed'}
          </DialogTitle>
          <DialogDescription>
            {status === 'generating' && 'OptaPlanner is optimizing your schedule (this may take up to 10 minutes)'}
            {status === 'success' && 'Your schedule has been successfully generated'}
            {status === 'error' && 'An error occurred during schedule generation'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {status === 'generating' && (
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm text-slate-600">
                Please wait... This process can take several minutes.
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Maximum wait time: 10 minutes
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <p className="text-sm text-slate-700">{message}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              {isTeacherCapacityError ? (
                <>
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-sm text-amber-900 font-semibold mb-2">{error}</p>
                    <p className="text-xs text-amber-800 mb-3">{message.message}</p>
                    
                    <div className="space-y-2 mt-3">
                      {message.overloadedTeachers.map((teacher, idx) => (
                        <div key={idx} className="bg-white rounded p-3 border border-amber-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-slate-900 text-sm">{teacher.name}</span>
                            <span className="text-xs text-red-600 font-medium">
                              {teacher.assigned} / {teacher.max} periods
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 space-y-1">
                            {teacher.teachingGroups.map((tg, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <span>{tg.subject} ({tg.yearGroup})</span>
                                <span className="text-slate-500">{tg.lessonsNeeded} periods</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <p className="text-xs text-amber-700 mt-3 italic">
                      💡 {message.solution}
                    </p>
                  </div>
                  <Button onClick={onClose} className="w-full">
                    Close
                  </Button>
                </>
              ) : (
                <>
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-sm text-red-900 font-medium mb-2">Error:</p>
                    <p className="text-sm text-red-800 whitespace-pre-wrap">{error}</p>
                  </div>
                  <Button onClick={onClose} className="w-full">
                    Close
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {status === 'success' && (
          <div className="flex justify-end">
            <Button onClick={onClose} className="bg-blue-900 hover:bg-blue-800">
              View Schedule
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}