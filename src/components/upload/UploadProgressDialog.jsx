import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, FileSearch, Database, CheckCircle } from 'lucide-react';

export default function UploadProgressDialog({ 
  open, 
  stage, 
  progress, 
  current, 
  total, 
  entityType 
}) {
  const stages = {
    uploading: { icon: Upload, label: 'Uploading file...', color: 'text-blue-600' },
    extracting: { icon: FileSearch, label: 'Extracting data...', color: 'text-violet-600' },
    creating: { icon: Database, label: `Creating ${entityType}...`, color: 'text-indigo-600' },
    complete: { icon: CheckCircle, label: 'Complete!', color: 'text-emerald-600' }
  };

  const currentStage = stages[stage] || stages.uploading;
  const StageIcon = currentStage.icon;

  // Calculate percentage
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-gradient-to-br from-indigo-50 to-violet-50 ${currentStage.color}`}>
              {stage === 'complete' ? (
                <StageIcon className="w-5 h-5" />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin" />
              )}
            </div>
            Importing {entityType}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Stage indicator */}
          <div className="flex items-center justify-between text-sm">
            <span className={`font-medium ${currentStage.color}`}>
              {currentStage.label}
            </span>
            {stage === 'creating' && total > 0 && (
              <span className="text-slate-500 font-mono">
                {current}/{total}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {stage === 'creating' && total > 0 && (
            <>
              <Progress value={percentage} className="h-3" />
              <div className="text-center">
                <span className="text-2xl font-bold text-indigo-600">{percentage}%</span>
                <p className="text-sm text-slate-500 mt-1">{progress}</p>
              </div>
            </>
          )}

          {(stage === 'uploading' || stage === 'extracting') && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-sm text-slate-600">{progress}</p>
            </div>
          )}

          {stage === 'complete' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-emerald-700">{progress}</p>
            </div>
          )}

          {/* Step indicators */}
          <div className="flex justify-between items-center pt-4">
            {['uploading', 'extracting', 'creating'].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                  stage === s ? 'bg-indigo-600 text-white scale-110' :
                  stages[stage] && Object.keys(stages).indexOf(stage) > i ? 'bg-emerald-500 text-white' :
                  'bg-slate-200 text-slate-400'
                }`}>
                  {stages[stage] && Object.keys(stages).indexOf(stage) > i ? '✓' : i + 1}
                </div>
                {i < 2 && <div className={`h-0.5 w-12 ${
                  stages[stage] && Object.keys(stages).indexOf(stage) > i ? 'bg-emerald-500' : 'bg-slate-200'
                }`} />}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}