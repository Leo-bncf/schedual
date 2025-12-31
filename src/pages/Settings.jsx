import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  Clock, 
  Calendar, 
  Bell, 
  Shield,
  Save,
  Loader2,
  CheckCircle,
  Brain
} from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import AgentTrainingSection from '../components/ai-training/AgentTrainingSection';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore',
  'Asia/Dubai', 'Australia/Sydney'
];

export default function Settings() {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: () => base44.entities.School.list(),
  });

  const school = schools[0];

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    ib_school_code: '',
    address: '',
    timezone: 'UTC',
    academic_year: '2024-2025',
    periods_per_day: 8,
    period_duration_minutes: 45,
    days_per_week: 5,
    school_start_time: '08:00',
    settings: {}
  });

  useEffect(() => {
    if (school) {
      setFormData({
        name: school.name || '',
        code: school.code || '',
        ib_school_code: school.ib_school_code || '',
        address: school.address || '',
        timezone: school.timezone || 'UTC',
        academic_year: school.academic_year || '2024-2025',
        periods_per_day: school.periods_per_day || 8,
        period_duration_minutes: school.period_duration_minutes || 45,
        days_per_week: school.days_per_week || 5,
        school_start_time: school.school_start_time || '08:00',
        settings: school.settings || {}
      });
    }
  }, [school]);

  const createSchoolMutation = useMutation({
    mutationFn: (data) => base44.entities.School.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const updateSchoolMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.School.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      alert('Please fill in School Name and School Code');
      return;
    }
    setIsSaving(true);
    try {
      if (school) {
        await updateSchoolMutation.mutateAsync({ id: school.id, data: formData });
      } else {
        await createSchoolMutation.mutateAsync(formData);
      }
    } catch (error) {
      console.error('Error saving school:', error);
      alert('Failed to save school settings. Please try again.');
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Settings"
        description="Configure your school and scheduling preferences"
        actions={
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
        }
      />

      <Tabs defaultValue="school" className="space-y-6">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="school" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            School Info
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Schedule Settings
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="ai-training" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            AI Training
          </TabsTrigger>
        </TabsList>

        <TabsContent value="school">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>School Information</CardTitle>
              <CardDescription>Basic information about your school</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">School Name *</Label>
                  <Input 
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., International School of Geneva"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">School Code *</Label>
                  <Input 
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., ISG"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ib_school_code">IB World School Code</Label>
                  <Input 
                    id="ib_school_code"
                    value={formData.ib_school_code}
                    onChange={(e) => setFormData({ ...formData, ib_school_code: e.target.value })}
                    placeholder="e.g., 001234"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select 
                    value={formData.timezone} 
                    onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input 
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="School address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="academic_year">Current Academic Year</Label>
                <Select 
                  value={formData.academic_year} 
                  onValueChange={(value) => setFormData({ ...formData, academic_year: value })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2023-2024">2023-2024</SelectItem>
                    <SelectItem value="2024-2025">2024-2025</SelectItem>
                    <SelectItem value="2025-2026">2025-2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>School ID</Label>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-sm font-mono text-slate-700">{school?.id || 'Not available'}</p>
                  <p className="text-xs text-slate-500 mt-1">Use this ID when uploading documents to import data</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Schedule Configuration</CardTitle>
              <CardDescription>Define your school's daily schedule structure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="periods_per_day">Periods Per Day</Label>
                  <Input 
                    id="periods_per_day"
                    type="number"
                    min="4"
                    max="12"
                    value={formData.periods_per_day}
                    onChange={(e) => setFormData({ ...formData, periods_per_day: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="period_duration">Period Duration (min)</Label>
                  <Input 
                    id="period_duration"
                    type="number"
                    min="30"
                    max="90"
                    value={formData.period_duration_minutes}
                    onChange={(e) => setFormData({ ...formData, period_duration_minutes: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="days_per_week">Days Per Week</Label>
                  <Select 
                    value={String(formData.days_per_week)} 
                    onValueChange={(value) => setFormData({ ...formData, days_per_week: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 (Mon-Fri)</SelectItem>
                      <SelectItem value="6">6 (Mon-Sat)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_time">School Start Time</Label>
                  <Input 
                    id="start_time"
                    type="time"
                    value={formData.school_start_time}
                    onChange={(e) => setFormData({ ...formData, school_start_time: e.target.value })}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium text-slate-900 mb-4">IB Diploma Requirements</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                    <div>
                      <p className="font-medium text-slate-700">HL Hours Per Week</p>
                      <p className="text-sm text-slate-500">Standard: 6 hours</p>
                    </div>
                    <Input 
                      type="number"
                      className="w-20"
                      value={formData.settings?.hl_hours || 6}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        settings: { ...formData.settings, hl_hours: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                    <div>
                      <p className="font-medium text-slate-700">SL Hours Per Week</p>
                      <p className="text-sm text-slate-500">Standard: 4 hours</p>
                    </div>
                    <Input 
                      type="number"
                      className="w-20"
                      value={formData.settings?.sl_hours || 4}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        settings: { ...formData.settings, sl_hours: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Configure how you receive updates and alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-700">Schedule Conflict Alerts</p>
                    <p className="text-sm text-slate-500">Get notified when scheduling conflicts are detected</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-700">AI Recommendations</p>
                    <p className="text-sm text-slate-500">Receive AI advisor suggestions and insights</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-700">Schedule Published</p>
                    <p className="text-sm text-slate-500">Notify when a new schedule is published</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-700">Weekly Summary</p>
                    <p className="text-sm text-slate-500">Receive weekly scheduling summary reports</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-training">
          <div className="space-y-6">
            <AgentTrainingSection 
              agentName="student_importer"
              agentTitle="Student Importer"
              agentDescription="Train AI to extract student data from documents"
            />
            <AgentTrainingSection 
              agentName="teacher_importer"
              agentTitle="Teacher Importer"
              agentDescription="Train AI to extract teacher data from documents"
            />
            <AgentTrainingSection 
              agentName="room_importer"
              agentTitle="Room Importer"
              agentDescription="Train AI to extract room data from documents"
            />
            <AgentTrainingSection 
              agentName="subject_importer"
              agentTitle="Subject Importer"
              agentDescription="Train AI to extract subject data from documents"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}