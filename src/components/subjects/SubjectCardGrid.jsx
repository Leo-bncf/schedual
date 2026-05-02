import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MoreHorizontal, Pencil, Trash2, BookOpen, FlaskConical } from 'lucide-react';

export default function SubjectCardGrid({ subjects, colorClass, icon: Icon = BookOpen, programmeLabel, onEdit, onDelete, teachers = [] }) {
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const pendingSubject = subjects.find(s => s.id === pendingDeleteId);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {subjects.map((subject, index) => {
          const assignedTeacher = teachers.find((teacher) => teacher.id === subject.supervisor_teacher_id);
          return (
            <motion.div key={subject.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} whileHover={{ y: -8, transition: { duration: 0.2 } }}>
              <Card className="border border-slate-200 shadow-sm bg-white rounded-xl hover:shadow-md transition-all duration-200 overflow-hidden h-full flex flex-col">
                <div className={`h-1 w-full ${colorClass}`} />
                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center flex-shrink-0`}><Icon className="w-5 h-5 text-white" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 text-base truncate">{subject.name}</p>
                        <p className="text-xs text-slate-500 truncate">{subject.code}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2"><MoreHorizontal className="w-4 h-4 text-slate-400" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(subject)}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-rose-600" onClick={() => setPendingDeleteId(subject.id)}><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {subject.available_levels?.includes('HL') && <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-0 text-xs font-medium">HL {subject.hoursPerWeekHL || Math.round((subject.hl_minutes_per_week_default || 360) / 60)}h</Badge>}
                    {subject.available_levels?.includes('SL') && <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-0 text-xs font-medium">SL {subject.hoursPerWeekSL || Math.round((subject.sl_minutes_per_week_default || 240) / 60)}h</Badge>}
                    {!subject.available_levels?.length && !!subject.standard_hours_per_week && <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-0 text-xs font-medium">{subject.standard_hours_per_week}h/week</Badge>}
                    {!subject.available_levels?.length && !!subject.pyp_myp_minutes_per_week_default && <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-0 text-xs font-medium">{Math.round(subject.pyp_myp_minutes_per_week_default / 60)}h/week</Badge>}
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-2">
                    <div className="flex items-center gap-2 text-slate-500 min-w-0">
                      {subject.requires_lab ? <><FlaskConical className="w-4 h-4" /><span className="text-sm">Requires Lab</span></> : <><BookOpen className="w-4 h-4" /><span className="text-sm truncate">{assignedTeacher?.full_name || 'Standard'}</span></>}
                    </div>
                    <Badge className={`${colorClass} text-white border-0 font-medium`}>{programmeLabel}</Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete subject?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{pendingSubject?.name}</strong>. Teaching groups using this subject will be affected. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => { onDelete(pendingDeleteId); setPendingDeleteId(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
