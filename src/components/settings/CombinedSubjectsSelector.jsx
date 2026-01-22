import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus } from 'lucide-react';

export default function CombinedSubjectsSelector({ value = [], onChange, schoolId }) {
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: () => base44.entities.Subject.filter({ school_id: schoolId, ib_level: 'DP' }),
    enabled: !!schoolId,
  });

  const selectedSubjects = subjects.filter(s => value.includes(s.id));
  const availableSubjects = subjects.filter(s => !value.includes(s.id) && s.is_active);

  const handleAdd = (subjectId) => {
    if (subjectId && !value.includes(subjectId)) {
      onChange([...value, subjectId]);
    }
  };

  const handleRemove = (subjectId) => {
    onChange(value.filter(id => id !== subjectId));
  };

  return (
    <div className="space-y-4">
      {/* Selected Subjects */}
      {selectedSubjects.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Selected Subjects:</p>
          <div className="flex flex-wrap gap-2">
            {selectedSubjects.map((subject) => (
              <Badge
                key={subject.id}
                className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 px-3 py-2 text-sm"
              >
                {subject.name}
                <button
                  onClick={() => handleRemove(subject.id)}
                  className="ml-2 hover:text-indigo-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Add Subject */}
      {availableSubjects.length > 0 && (
        <div className="flex gap-2">
          <Select onValueChange={handleAdd}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a subject to combine..." />
            </SelectTrigger>
            <SelectContent>
              {availableSubjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name} (Group {subject.ib_group})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedSubjects.length === 0 && availableSubjects.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-4">
          No DP subjects available. Create subjects first.
        </p>
      )}
    </div>
  );
}