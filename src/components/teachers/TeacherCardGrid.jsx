import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Clock, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function TeacherCardGrid({ teachers, getSubjectNames, onEdit, onDelete }) {
  return (
    <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {teachers.map((teacher, index) => (
        <motion.div key={teacher.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} whileHover={{ scale: 1.05, y: -8, transition: { duration: 0.2 } }}>
          <Card className="border border-slate-200 shadow-sm bg-white rounded-xl hover:shadow-md transition-all duration-200 overflow-hidden h-full flex flex-col">
            <div className="h-1 w-full bg-indigo-500" />
            <CardContent className="p-5 flex-1 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">{teacher.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}</div>
                  <div className="min-w-0 flex-1">
                    <Link to={`${createPageUrl('TeacherProfile')}?id=${teacher.id}`} className="font-bold text-slate-900 text-base hover:text-indigo-600 hover:underline truncate block">{teacher.full_name}</Link>
                    {teacher.employee_id && <p className="text-xs text-slate-500 truncate">{teacher.employee_id}</p>}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2"><MoreHorizontal className="w-4 h-4 text-slate-400" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(teacher)}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                    <DropdownMenuItem className="text-rose-600" onClick={() => onDelete(teacher.id)}><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {teacher.subjects && teacher.subjects.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-1.5">
                    {getSubjectNames(teacher.subjects).slice(0, 3).map((name, i) => <Badge key={i} variant="secondary" className="bg-slate-100 text-slate-700 border-0 text-xs font-medium">{name}</Badge>)}
                    {getSubjectNames(teacher.subjects).length > 3 && <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0 text-xs font-medium">+{getSubjectNames(teacher.subjects).length - 3}</Badge>}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between mt-auto pt-2">
                <div className="flex items-center gap-2 text-slate-500"><Clock className="w-4 h-4" /><span className="text-sm">{teacher.max_hours_per_week || 25}h/week</span></div>
                <Badge className="bg-indigo-500 text-white border-0 font-medium">Teacher</Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}