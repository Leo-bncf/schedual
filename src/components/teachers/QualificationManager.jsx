import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Award, AlertCircle } from 'lucide-react';

const IB_LEVELS = ['PYP', 'MYP', 'DP'];

export default function QualificationManager({ subjects, qualifications = [], onChange }) {
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedLevels, setSelectedLevels] = useState([]);

  const addQualification = () => {
    if (!selectedSubject || selectedLevels.length === 0) return;

    const newQualifications = [...qualifications];
    const existingIndex = newQualifications.findIndex(q => q.subject_id === selectedSubject);

    if (existingIndex >= 0) {
      // Merge levels
      const existing = newQualifications[existingIndex];
      newQualifications[existingIndex] = {
        subject_id: selectedSubject,
        ib_levels: [...new Set([...existing.ib_levels, ...selectedLevels])]
      };
    } else {
      newQualifications.push({
        subject_id: selectedSubject,
        ib_levels: selectedLevels
      });
    }

    onChange(newQualifications);
    setSelectedSubject('');
    setSelectedLevels([]);
  };

  const removeQualification = (subjectId, level) => {
    const newQualifications = qualifications.map(q => {
      if (q.subject_id === subjectId) {
        const newLevels = q.ib_levels.filter(l => l !== level);
        return newLevels.length > 0 ? { ...q, ib_levels: newLevels } : null;
      }
      return q;
    }).filter(Boolean);

    onChange(newQualifications);
  };

  const toggleLevel = (level) => {
    setSelectedLevels(prev => 
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  const getSubjectName = (subjectId) => {
    return subjects.find(s => s.id === subjectId)?.name || 'Unknown Subject';
  };

  const getLevelColor = (level) => {
    switch(level) {
      case 'PYP': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'MYP': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'DP': return 'bg-violet-100 text-violet-700 border-violet-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5" />
          IB Qualifications
        </CardTitle>
        <CardDescription>
          Specify which subjects and IB levels this teacher is qualified to teach
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Qualification */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map(subject => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name} ({subject.ib_level})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            {IB_LEVELS.map(level => (
              <Button
                key={level}
                type="button"
                variant={selectedLevels.includes(level) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleLevel(level)}
                className={selectedLevels.includes(level) ? getLevelColor(level) : ''}
              >
                {level}
              </Button>
            ))}
          </div>

          <Button 
            type="button"
            onClick={addQualification}
            disabled={!selectedSubject || selectedLevels.length === 0}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Current Qualifications */}
        {qualifications.length > 0 ? (
          <div className="space-y-2">
            {qualifications.map((qual, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <p className="font-medium text-slate-900">{getSubjectName(qual.subject_id)}</p>
                  <div className="flex gap-1 mt-1">
                    {qual.ib_levels.map(level => (
                      <Badge 
                        key={level} 
                        className={`${getLevelColor(level)} border text-xs cursor-pointer hover:opacity-80`}
                        onClick={() => removeQualification(qual.subject_id, level)}
                      >
                        {level}
                        <X className="w-3 h-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-lg border-2 border-dashed border-slate-200 text-center">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No qualifications added yet</p>
            <p className="text-xs text-slate-400 mt-1">Add subjects and IB levels this teacher can teach</p>
          </div>
        )}

        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
            <div className="text-xs text-amber-700">
              <p className="font-medium mb-1">Hard Constraint</p>
              <p>Teachers can only be assigned to classes matching their qualifications. This is strictly enforced during schedule generation.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}