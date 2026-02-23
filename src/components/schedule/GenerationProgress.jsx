import React from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, X } from 'lucide-react';

export default function GenerationProgress({ open, progress, onClose, onCancel }) {
  const { stage, percent, message, completed } = progress || {};

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <div className="text-center py-6 space-y-4">
          {!completed ? (
            <>
              <Loader2 className="w-16 h-16 text-blue-900 mx-auto animate-spin" />
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">{stage || 'Generating...'}</h3>
                <p className="text-sm text-slate-600">{message}</p>
              </div>
              {percent > 0 && (
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-blue-900 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </div>
              )}
              <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
            </>
          ) : (
            <>
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Complete!</h3>
                <p className="text-sm text-slate-600">{message}</p>
              </div>
              <Button onClick={onClose} className="bg-blue-900">Close</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}