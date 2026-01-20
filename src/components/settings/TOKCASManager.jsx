import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, Users, FileText, Save, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function TOKCASManager({ schoolId }) {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  const { data: school } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: async () => {
      const schools = await base44.entities.School.filter({ id: schoolId });
      return schools[0] || null;
    },
    enabled: !!schoolId,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', schoolId],
    queryFn: () => base44.entities.Teacher.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const [formData, setFormData] = useState({
    tok_hours_per_week: 2,
    tok_teacher_id: '',
    cas_hours_per_week: 1,
    cas_coordinator_id: '',
    ee_hours_per_week: 1,
    ee_coordinator_id: '',
  });

  React.useEffect(() => {
    if (school?.settings) {
      setFormData({
        tok_hours_per_week: school.settings.tok_hours_per_week || 2,
        tok_teacher_id: school.settings.tok_teacher_id || '',
        cas_hours_per_week: school.settings.cas_hours_per_week || 1,
        cas_coordinator_id: school.settings.cas_coordinator_id || '',
        ee_hours_per_week: school.settings.ee_hours_per_week || 1,
        ee_coordinator_id: school.settings.ee_coordinator_id || '',
      });
    }
  }, [school]);

  const updateSchoolMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.School.update(schoolId, {
        settings: {
          ...school.settings,
          ...data,
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school', schoolId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success('Core components updated successfully');
    },
    onError: (error) => {
      console.error('Update error:', error);
      toast.error('Failed to update settings');
    }
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSchoolMutation.mutateAsync(formData);
    } catch (error) {
      console.error('Error saving:', error);
    }
    setIsSaving(false);
  };

  const coreComponents = [
    {
      id: 'tok',
      name: 'Theory of Knowledge (TOK)',
      icon: BookOpen,
      color: 'from-blue-500 to-indigo-600',
      hoursKey: 'tok_hours_per_week',
      teacherKey: 'tok_teacher_id',
    },
    {
      id: 'cas',
      name: 'Creativity, Activity, Service (CAS)',
      icon: Users,
      color: 'from-emerald-500 to-teal-600',
      hoursKey: 'cas_hours_per_week',
      teacherKey: 'cas_coordinator_id',
    },
    {
      id: 'ee',
      name: 'Extended Essay (EE)',
      icon: FileText,
      color: 'from-purple-500 to-pink-600',
      hoursKey: 'ee_hours_per_week',
      teacherKey: 'ee_coordinator_id',
    },
  ];

  return (
    <div className="space-y-6">
      {coreComponents.map((component) => {
        const Icon = component.icon;
        return (
          <Card key={component.id} className="border-2 border-slate-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${component.color} flex items-center justify-center shadow-lg flex-shrink-0`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{component.name}</h3>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`${component.id}-hours`} className="text-sm font-semibold text-slate-700">
                        Weekly Teaching Hours
                      </Label>
                      <Input
                        id={`${component.id}-hours`}
                        type="number"
                        min="0"
                        max="10"
                        value={formData[component.hoursKey]}
                        onChange={(e) => setFormData({
                          ...formData,
                          [component.hoursKey]: parseInt(e.target.value) || 0
                        })}
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${component.id}-teacher`} className="text-sm font-semibold text-slate-700">
                        Assigned Teacher / Coordinator
                      </Label>
                      <Select
                        value={formData[component.teacherKey]}
                        onValueChange={(value) => setFormData({
                          ...formData,
                          [component.teacherKey]: value
                        })}
                      >
                        <SelectTrigger id={`${component.id}-teacher`} className="h-10">
                          <SelectValue placeholder="Select teacher..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>No teacher assigned</SelectItem>
                          {teachers.map((teacher) => (
                            <SelectItem key={teacher.id} value={teacher.id}>
                              {teacher.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-end pt-2">
        <Button 
          onClick={handleSave}
          className="bg-indigo-600 hover:bg-indigo-700"
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}