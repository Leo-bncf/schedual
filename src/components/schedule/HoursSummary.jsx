import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from 'lucide-react';

export default function HoursSummary({ slots = [], groups = [], subjects = [] }) {
  // Calculate hours per subject
  const subjectHours = {};
  
  slots.forEach(slot => {
    const group = groups.find(g => g.id === slot.teaching_group_id);
    if (group) {
      const subjectId = group.subject_id;
      if (!subjectHours[subjectId]) {
        subjectHours[subjectId] = {
          count: 0,
          subject: subjects.find(s => s.id === subjectId),
          groups: new Set()
        };
      }
      subjectHours[subjectId].count++;
      subjectHours[subjectId].groups.add(group.id);
    }
  });

  const sortedSubjects = Object.entries(subjectHours).sort((a, b) => b[1].count - a[1].count);

  const subjectColors = {
    1: 'bg-blue-100 text-blue-700 border-blue-300',
    2: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    3: 'bg-amber-100 text-amber-700 border-amber-300',
    4: 'bg-rose-100 text-rose-700 border-rose-300',
    5: 'bg-violet-100 text-violet-700 border-violet-300',
    6: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  };

  const totalHours = Object.values(subjectHours).reduce((sum, s) => sum + s.count, 0);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Hours per Subject
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sortedSubjects.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No schedule data yet</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {sortedSubjects.map(([subjectId, data]) => {
                const subject = data.subject;
                if (!subject) return null;

                const colorClass = subjectColors[subject.ib_group || 1];
                const percentage = ((data.count / totalHours) * 100).toFixed(0);

                return (
                  <div key={subjectId} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full border-2 ${colorClass}`}></div>
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {subject.name}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 ml-5">
                        {data.groups.size} {data.groups.size === 1 ? 'group' : 'groups'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge variant="outline" className="text-xs font-mono">
                        {data.count}h
                      </Badge>
                      <span className="text-xs text-slate-400 w-10 text-right">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 mt-3 border-t border-slate-200">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">Total Hours</span>
                <Badge className="bg-indigo-100 text-indigo-700 border-0 font-mono">
                  {totalHours}h
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                <span>Across {sortedSubjects.length} subjects</span>
                <span>{slots.length} periods scheduled</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}