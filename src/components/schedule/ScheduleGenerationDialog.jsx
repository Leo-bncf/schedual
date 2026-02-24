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

import { motion, AnimatePresence } from 'framer-motion';

export default function ScheduleGenerationDialog({ open, onClose, status, message, error }) {
  const isTeacherCapacityError = message && typeof message === 'object' && message.overloadedTeachers;
  return (
    <Dialog open={open} onOpenChange={(val) => {
      // Prevent closing by clicking outside while generating
      if (status === 'generating') return;
      onClose(val);
    }}>
      <DialogContent className="max-w-lg overflow-hidden border-0 shadow-2xl p-0 bg-white">
        <div className={`h-2 w-full ${status === 'generating' ? 'bg-blue-600 animate-pulse' : status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
        
        <div className="p-6 sm:p-8">
          <DialogHeader className="mb-2">
            <DialogTitle className="flex items-center justify-center gap-3 text-2xl font-bold text-center">
              {status === 'generating' && <Loader2 className="w-7 h-7 animate-spin text-blue-600" />}
              {status === 'success' && <CheckCircle className="w-7 h-7 text-green-600" />}
              {status === 'error' && <XCircle className="w-7 h-7 text-red-600" />}
              <span className="text-slate-900">
                {status === 'generating' ? 'Génération en cours...' : 
                 status === 'success' ? 'Emploi du temps créé !' : 
                 'Échec de la génération'}
              </span>
            </DialogTitle>
            <DialogDescription className="text-center text-slate-500 text-sm mt-2">
              {status === 'generating' && "Notre moteur d'optimisation (OptaPlanner) calcule le meilleur emploi du temps. Veuillez patienter, cela peut prendre jusqu'à 10 minutes."}
              {status === 'success' && "L'emploi du temps a été généré avec succès en respectant les contraintes."}
              {status === 'error' && "Une erreur est survenue lors de la création de l'emploi du temps."}
            </DialogDescription>
          </DialogHeader>

        <AnimatePresence mode="wait">
          {status === 'generating' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-10 text-center flex flex-col items-center justify-center"
            >
              <div className="relative w-24 h-24 mb-6">
                <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-blue-600">
                  <span className="animate-pulse font-bold text-xl">...</span>
                </div>
              </div>
              
              <div className="space-y-3 max-w-sm mx-auto">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner">
                  <p className="text-sm font-medium text-slate-700 animate-pulse">
                    Analyse des disponibilités...
                  </p>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 mt-3 overflow-hidden">
                    <div className="bg-blue-600 h-1.5 rounded-full animate-[progress_2s_ease-in-out_infinite] w-1/2"></div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 font-medium px-4">
                  Ne fermez pas cette page. Le processus continue en arrière-plan.
                </p>
              </div>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-10 text-center flex flex-col items-center justify-center space-y-6"
            >
              <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center mx-auto ring-8 ring-green-100/50 shadow-sm">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <p className="text-lg font-medium text-slate-800">{message}</p>
              
              <Button onClick={onClose} size="lg" className="bg-green-600 hover:bg-green-700 w-full max-w-xs shadow-md">
                Voir l'emploi du temps
              </Button>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-6 space-y-4"
            >
              {isTeacherCapacityError ? (
                <>
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 max-h-64 overflow-y-auto custom-scrollbar">
                    <p className="text-sm text-amber-900 font-semibold mb-2">{error}</p>
                    <p className="text-xs text-amber-800 mb-3">{message.message}</p>
                    
                    <div className="space-y-2 mt-3">
                      {message.overloadedTeachers.map((teacher, idx) => (
                        <div key={idx} className="bg-white rounded p-3 border border-amber-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-slate-900 text-sm">{teacher.name}</span>
                            <div className="text-right">
                              <div className="text-xs text-red-600 font-medium">
                                {teacher.assigned} / {teacher.max} periods
                              </div>
                              <div className="text-xs text-red-500">
                                Needs {teacher.shortage} fewer periods
                              </div>
                            </div>
                          </div>
                          {teacher.teachingGroups && teacher.teachingGroups.length > 0 && (
                            <div className="text-xs text-slate-600 space-y-1">
                              {teacher.teachingGroups.map((tg, i) => (
                                <div key={i} className="flex items-center justify-between">
                                  <span>{tg.subject} ({tg.yearGroup})</span>
                                  <span className="text-slate-500">{tg.lessonsNeeded} periods</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <p className="text-xs text-amber-700 mt-3 italic">
                      💡 {message.solution}
                    </p>
                  </div>
                  <Button variant="outline" onClick={onClose} className="w-full border-amber-300 text-amber-900 hover:bg-amber-100">
                    Fermer et ajuster
                  </Button>
                </>
              ) : (
                <>
                  <div className="p-5 rounded-xl bg-red-50 border border-red-200 shadow-sm max-h-64 overflow-y-auto custom-scrollbar">
                    <div className="flex items-center gap-2 mb-3">
                      <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                      <p className="font-semibold text-red-900 text-base">Détails de l'erreur</p>
                    </div>
                    <p className="text-sm text-red-800 whitespace-pre-wrap leading-relaxed">{error}</p>
                  </div>
                  <Button variant="outline" onClick={onClose} className="w-full border-red-200 text-red-700 hover:bg-red-50">
                    Fermer
                  </Button>
                </>
              )}
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}