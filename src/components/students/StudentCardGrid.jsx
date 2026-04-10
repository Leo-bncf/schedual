import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { GraduationCap, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function StudentCardGrid({ students, subjects, getSubjectInfo, onEdit, onDelete }) {
  const programmeColors = {
    DP: { badge: 'bg-blue-500', avatar: 'bg-blue-500' },
    MYP: { badge: 'bg-purple-500', avatar: 'bg-purple-500' },
    PYP: { badge: 'bg-teal-500', avatar: 'bg-teal-500' }
  };

  return (
    <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {students.map((student, index) => {
        const colors = programmeColors[student.ib_programme] || programmeColors.DP;
        return (
          <motion.div key={student.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} whileHover={{ scale: 1.05, y: -8, transition: { duration: 0.2 } }}>
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white rounded-xl overflow-hidden flex flex-col h-full">
              <div className={`h-1.5 w-full ${colors.badge}`} />
              <CardContent className="p-4 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-lg ${colors.avatar} flex items-center justify-center text-white font-semibold text-base flex-shrink-0`}>
                      {student.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900 text-base truncate">
                        <Link to={`${createPageUrl('StudentProfile')}?id=${student.id}`} className="hover:text-blue-600 hover:underline">{student.full_name}</Link>
                      </h3>
                      <p className="text-xs text-slate-500 truncate">{student.student_id || student.email}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-slate-400 hover:text-slate-600"><MoreHorizontal className="w-5 h-5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(student)}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-rose-600" onClick={() => onDelete(student.id)}><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {student.subject_choices && student.subject_choices.length > 0 && (
                  <div className="mb-4">
                    {student.ib_programme === 'DP' ? (
                      <div className="flex gap-2">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-0 font-medium">{getSubjectInfo(student.subject_choices).hl} HL</Badge>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-0 font-medium">{getSubjectInfo(student.subject_choices).sl} SL</Badge>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {student.subject_choices.slice(0, 3).map((choice, i) => {
                          const subject = subjects.find((s) => s.id === choice.subject_id);
                          return subject ? <Badge key={i} variant="secondary" className="bg-slate-100 text-slate-700 border-0 text-xs font-medium">{subject.name}</Badge> : null;
                        })}
                        {student.subject_choices.length > 3 && <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0 text-xs font-medium">+{student.subject_choices.length - 3}</Badge>}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-2 text-slate-500"><GraduationCap className="w-4 h-4" /><span className="text-sm">{student.year_group}</span></div>
                  <Badge className={`${colors.badge} text-white border-0 rounded-md px-2 py-0.5 text-xs font-medium`}>{student.ib_programme}</Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}