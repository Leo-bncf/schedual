import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, X } from 'lucide-react';

export default function GroupBuilder({ 
  subjects, 
  teachers, 
  students, 
  rooms,
  initialData,
  onSubmit 
}) {
  // Detect IB level from year_group
  const getIBLevel = (yearGroup) => {
    if (!yearGroup) return 'DP';
    if (yearGroup.startsWith('DP')) return 'DP';
    if (yearGroup.startsWith('MYP')) return 'MYP';
    if (yearGroup.startsWith('PYP')) return 'PYP';
    return 'DP';
  };

  const [formData, setFormData] = useState(initialData || {
    name: '',
    subject_id: '',
    level: 'HL',
    year_group: 'DP1',
    teacher_id: '',
    student_ids: [],
    preferred_room_id: '',
    hours_per_week: 6,
    min_students: 3,
    max_students: 20,
    requires_double_periods: false,
    is_active: true
  });

  const [selectedStudents, setSelectedStudents] = useState(initialData?.student_ids || []);
  const selectedSubject = subjects.find(s => s.id === formData.subject_id);
  const currentIBLevel = getIBLevel(formData.year_group);

  const handleSubjectChange = (subjectId) => {
    const subject = subjects.find(s => s.id === subjectId);
    setFormData({
      ...formData,
      subject_id: subjectId,
      hours_per_week: formData.level === 'HL' ? subject?.hl_hours_per_week || 6 : subject?.sl_hours_per_week || 4,
      name: subject ? `${subject.name} ${formData.level} - Group A` : ''
    });
  };

  const handleLevelChange = (level) => {
    const hours = level === 'HL' ? selectedSubject?.hl_hours_per_week || 6 : selectedSubject?.sl_hours_per_week || 4;
    setFormData({
      ...formData,
      level,
      hours_per_week: hours,
      name: selectedSubject ? `${selectedSubject.name} ${level} - Group A` : ''
    });
  };

  const toggleStudent = (studentId) => {
    const newSelection = selectedStudents.includes(studentId)
      ? selectedStudents.filter(id => id !== studentId)
      : [...selectedStudents, studentId];
    setSelectedStudents(newSelection);
    setFormData({ ...formData, student_ids: newSelection });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  // Only show DP students
  const filteredStudents = students.filter(s => 
    s.ib_programme === 'DP' && s.year_group === formData.year_group
  );
  
  const selectedTeacher = teachers.find(t => t.id === formData.teacher_id);
  
  // Filter teachers by qualification for selected subject
  const qualifiedTeachers = formData.subject_id 
    ? teachers.filter(t => {
        const subject = subjects.find(s => s.id === formData.subject_id);
        if (!subject) return false;
        const qualification = t.qualifications?.find(q => q.subject_id === formData.subject_id);
        return qualification?.ib_levels?.includes(subject.ib_level);
      })
    : teachers;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="subject">Subject *</Label>
          <Select 
            value={formData.subject_id} 
            onValueChange={handleSubjectChange}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map(subject => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name} ({subject.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="level">Level *</Label>
          <Select 
            value={formData.level} 
            onValueChange={handleLevelChange}
            required
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HL">Higher Level (HL)</SelectItem>
              <SelectItem value="SL">Standard Level (SL)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="year_group">Year Group *</Label>
          <Select 
            value={formData.year_group} 
            onValueChange={(value) => setFormData({ ...formData, year_group: value })}
            required
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DP1">DP1 (First Year)</SelectItem>
              <SelectItem value="DP2">DP2 (Second Year)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="teacher">Teacher *</Label>
          <Select 
            value={formData.teacher_id} 
            onValueChange={(value) => setFormData({ ...formData, teacher_id: value })}
            required
            disabled={!formData.subject_id}
          >
            <SelectTrigger>
              <SelectValue placeholder={formData.subject_id ? "Select qualified teacher" : "Select subject first"} />
            </SelectTrigger>
            <SelectContent>
              {qualifiedTeachers.length === 0 ? (
                <div className="p-2 text-sm text-slate-500">No qualified teachers available</div>
              ) : (
                qualifiedTeachers.map(teacher => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.full_name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {formData.subject_id && qualifiedTeachers.length === 0 && (
            <p className="text-xs text-rose-600">⚠️ No teachers qualified for this subject/level</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Group Name *</Label>
        <Input 
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Physics HL - Group A"
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="hours">Hours/Week</Label>
          <Input 
            id="hours"
            type="number"
            min="1"
            max="12"
            value={formData.hours_per_week}
            onChange={(e) => setFormData({ ...formData, hours_per_week: parseInt(e.target.value) })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="min_students">Min Students</Label>
          <Input 
            id="min_students"
            type="number"
            min="1"
            value={formData.min_students}
            onChange={(e) => setFormData({ ...formData, min_students: parseInt(e.target.value) })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="max_students">Max Students</Label>
          <Input 
            id="max_students"
            type="number"
            min="1"
            value={formData.max_students}
            onChange={(e) => setFormData({ ...formData, max_students: parseInt(e.target.value) })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="room">Preferred Room</Label>
        <Select 
          value={formData.preferred_room_id} 
          onValueChange={(value) => setFormData({ ...formData, preferred_room_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select room (optional)" />
          </SelectTrigger>
          <SelectContent>
            {rooms.map(room => (
              <SelectItem key={room.id} value={room.id}>
                {room.name} - {room.room_type} (Capacity: {room.capacity})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox 
          id="double_periods"
          checked={formData.requires_double_periods}
          onCheckedChange={(checked) => setFormData({ ...formData, requires_double_periods: checked })}
        />
        <Label htmlFor="double_periods" className="font-normal">
          Requires double periods (2 consecutive periods per session)
        </Label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Students ({selectedStudents.length} selected)</Label>
          {selectedStudents.length > 0 && (
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              onClick={() => { setSelectedStudents([]); setFormData({ ...formData, student_ids: [] }); }}
            >
              Clear All
            </Button>
          )}
        </div>

        {filteredStudents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                No {formData.year_group} DP students available
              </p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-48 rounded-lg border border-slate-200">
            <div className="p-3 space-y-2">
              {filteredStudents.map(student => (
                <div 
                  key={student.id}
                  className={`flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors ${
                    selectedStudents.includes(student.id) ? 'bg-indigo-50 border border-indigo-200' : ''
                  }`}
                  onClick={() => toggleStudent(student.id)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox 
                      checked={selectedStudents.includes(student.id)}
                      onCheckedChange={() => toggleStudent(student.id)}
                    />
                    <div>
                      <p className="font-medium text-sm text-slate-900">{student.full_name}</p>
                      <p className="text-xs text-slate-500">{student.student_id}</p>
                    </div>
                  </div>
                  {selectedStudents.includes(student.id) && (
                    <Badge className="bg-indigo-100 text-indigo-700 border-0">Selected</Badge>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {formData.subject_id && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4">
            <h4 className="font-medium text-slate-900 mb-2">Group Summary</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500">Subject:</span>
                <p className="font-medium">{selectedSubject?.name}</p>
              </div>
              <div>
                <span className="text-slate-500">Level:</span>
                <p className="font-medium">{formData.level}</p>
              </div>
              <div>
                <span className="text-slate-500">Teacher:</span>
                <p className="font-medium">{selectedTeacher?.full_name || 'Not assigned'}</p>
              </div>
              <div>
                <span className="text-slate-500">Students:</span>
                <p className="font-medium">{selectedStudents.length} / {formData.max_students}</p>
              </div>
              <div>
                <span className="text-slate-500">Hours/Week:</span>
                <p className="font-medium">{formData.hours_per_week}</p>
              </div>
              <div>
                <span className="text-slate-500">Double Periods:</span>
                <p className="font-medium">{formData.requires_double_periods ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
          {initialData ? 'Update Teaching Group' : 'Create Teaching Group'}
        </Button>
      </div>
    </form>
  );
}