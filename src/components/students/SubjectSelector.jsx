import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from 'lucide-react';

const IB_GROUPS = [
  { id: 1, name: 'Language & Literature', color: 'bg-blue-100 text-blue-700' },
  { id: 2, name: 'Language Acquisition', color: 'bg-emerald-100 text-emerald-700' },
  { id: 3, name: 'Individuals & Societies', color: 'bg-amber-100 text-amber-700' },
  { id: 4, name: 'Sciences', color: 'bg-violet-100 text-violet-700' },
  { id: 5, name: 'Mathematics', color: 'bg-rose-100 text-rose-700' },
  { id: 6, name: 'The Arts', color: 'bg-cyan-100 text-cyan-700' },
];

export default function SubjectSelector({ 
  subjects, 
  selectedSubjects = [], 
  onChange,
  programme = 'DP' 
}) {
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('HL');

  // Filter subjects by programme
  const availableSubjects = subjects.filter(s => s.ib_level === programme && !s.is_core);

  const addSubject = () => {
    if (!selectedSubjectId) return;

    const subject = subjects.find(s => s.id === selectedSubjectId);
    if (!subject) return;

    // CRITICAL: Prevent duplicate subjects (same subject_id already exists)
    const alreadySelected = selectedSubjects.some(sc => sc.subject_id === selectedSubjectId);
    if (alreadySelected) {
      alert(`This subject is already selected. You cannot take the same subject at multiple levels.`);
      return;
    }

    const newSubject = {
      subject_id: selectedSubjectId,
      level: programme === 'DP' ? selectedLevel : undefined,
      ib_group: subject.ib_group
    };

    onChange([...selectedSubjects, newSubject]);
    setSelectedSubjectId('');
  };

  const removeSubject = (index) => {
    onChange(selectedSubjects.filter((_, i) => i !== index));
  };

  const getSubjectInfo = (subjectId) => subjects.find(s => s.id === subjectId);
  const getGroupColor = (groupId) => IB_GROUPS.find(g => g.id === groupId)?.color || 'bg-slate-100 text-slate-700';

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={`Select ${programme} subject`} />
          </SelectTrigger>
          <SelectContent>
            {availableSubjects.map(subject => (
              <SelectItem 
                key={subject.id} 
                value={subject.id}
                disabled={selectedSubjects.some(sc => sc.subject_id === subject.id)}
              >
                {subject.name} (Group {subject.ib_group})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {programme === 'DP' && (
          <Select value={selectedLevel} onValueChange={setSelectedLevel}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HL">HL</SelectItem>
              <SelectItem value="SL">SL</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Button 
          type="button"
          onClick={addSubject}
          disabled={!selectedSubjectId}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {selectedSubjects.length > 0 && (
        <div className="space-y-2">
          {selectedSubjects.map((choice, index) => {
            const subject = getSubjectInfo(choice.subject_id);
            if (!subject) return null;

            return (
              <Card key={index} className="border-0 bg-slate-50">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={`${getGroupColor(choice.ib_group)} border-0`}>
                      Group {choice.ib_group}
                    </Badge>
                    <span className="font-medium text-slate-900">{subject.name}</span>
                    {programme === 'DP' && choice.level && (
                      <Badge className={
                        choice.level === 'HL' 
                          ? 'bg-rose-100 text-rose-700 border-0' 
                          : 'bg-amber-100 text-amber-700 border-0'
                      }>
                        {choice.level}
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeSubject(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}