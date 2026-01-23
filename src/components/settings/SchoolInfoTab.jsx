import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Building2, 
  Clock, 
  Calendar, 
  Globe, 
  MapPin, 
  Hash, 
  Shield, 
  Info,
  GraduationCap,
  Timer
} from 'lucide-react';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore',
  'Asia/Dubai', 'Australia/Sydney'
];

const LEVELS = [
  { id: 'pyp', label: 'PYP', color: 'emerald' },
  { id: 'myp', label: 'MYP', color: 'blue' },
  { id: 'dp1', label: 'DP1', color: 'violet' },
  { id: 'dp2', label: 'DP2', color: 'rose' }
];

export default function SchoolInfoTab({ formData, setFormData, school }) {
  const [testConfig, setTestConfig] = useState({
    pyp: { hours: 2, per_week: 1, supervisor_teacher_id: '' },
    myp: { hours: 2, per_week: 1, supervisor_teacher_id: '' },
    dp1: { hours: 3, per_week: 1, supervisor_teacher_id: '' },
    dp2: { hours: 3, per_week: 1, supervisor_teacher_id: '' }
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => base44.entities.Teacher.list(),
  });

  useEffect(() => {
    if (school?.settings?.test_config) {
      setTestConfig(school.settings.test_config);
    }
  }, [school]);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        test_config: testConfig
      }
    }));
  }, [testConfig]);

  const updateTestConfig = (level, field, value) => {
    setTestConfig(prev => ({
      ...prev,
      [level]: {
        ...prev[level],
        [field]: value
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Basic Information - Compact Grid */}
      <Card className="border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-900 text-white">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl">School Information</CardTitle>
              <CardDescription>Basic details about your institution</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">School Name *</Label>
            <Input 
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="International School of Geneva"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code" className="text-sm font-medium">School Code *</Label>
            <Input 
              id="code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="ISG"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ib_school_code" className="text-sm font-medium">IB School Code</Label>
            <Input 
              id="ib_school_code"
              value={formData.ib_school_code}
              onChange={(e) => setFormData({ ...formData, ib_school_code: e.target.value })}
              placeholder="001234"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm font-medium">Address</Label>
            <Input 
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="City, Country"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone" className="text-sm font-medium">Timezone</Label>
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
          <div className="space-y-2">
            <Label htmlFor="academic_year" className="text-sm font-medium">Academic Year</Label>
            <Select 
              value={formData.academic_year} 
              onValueChange={(value) => setFormData({ ...formData, academic_year: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2023-2024">2023-2024</SelectItem>
                <SelectItem value="2024-2025">2024-2025</SelectItem>
                <SelectItem value="2025-2026">2025-2026</SelectItem>
                <SelectItem value="2026-2027">2026-2027</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Daily Schedule Configuration */}
      <Card className="border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600 text-white">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Daily Schedule Configuration</CardTitle>
              <CardDescription>Define your school's daily schedule structure</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label htmlFor="periods_per_day" className="text-sm font-medium flex items-center gap-2">
                <Hash className="w-4 h-4 text-blue-600" />
                Periods per Day
              </Label>
              <Input 
                id="periods_per_day"
                type="number"
                min="1"
                max="12"
                value={formData.periods_per_day}
                onChange={(e) => setFormData({ ...formData, periods_per_day: parseInt(e.target.value) || 8 })}
                className="text-lg font-semibold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="days_per_week" className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Days per Week
              </Label>
              <Select 
                value={String(formData.days_per_week)} 
                onValueChange={(value) => setFormData({ ...formData, days_per_week: parseInt(value) })}
              >
                <SelectTrigger className="text-lg font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 days</SelectItem>
                  <SelectItem value="6">6 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="school_start_time" className="text-sm font-medium flex items-center gap-2">
                <Timer className="w-4 h-4 text-blue-600" />
                School Start Time
              </Label>
              <Input 
                id="school_start_time"
                type="time"
                value={formData.school_start_time}
                onChange={(e) => setFormData({ ...formData, school_start_time: e.target.value })}
                className="text-lg font-semibold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Timer className="w-4 h-4 text-slate-400" />
                Period Duration
              </Label>
              <div className="h-10 px-3 rounded-md border border-slate-200 bg-slate-50 flex items-center">
                <span className="text-lg font-semibold text-slate-600">60 min</span>
              </div>
              <p className="text-xs text-slate-500">Fixed at 60 minutes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test & Assessment Slots by Level */}
      <Card className="border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-600 text-white">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Test & Assessment Slots by Level</CardTitle>
              <CardDescription>Configure dedicated test/exam periods for each IB programme level</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {LEVELS.map((level) => (
              <div 
                key={level.id}
                className="p-5 rounded-xl border-2 border-slate-200 hover:border-slate-300 transition-all bg-gradient-to-br from-white to-slate-50"
              >
                <div className="grid lg:grid-cols-3 gap-4 items-end">
                  <div>
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-${level.color}-100 mb-3`}>
                      <span className={`text-sm font-bold text-${level.color}-700`}>{level.label}</span>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Hours per Test Period</Label>
                      <Input 
                        type="number"
                        min="1"
                        max="4"
                        step="0.5"
                        value={testConfig[level.id]?.hours || 2}
                        onChange={(e) => updateTestConfig(level.id, 'hours', parseFloat(e.target.value) || 2)}
                        className="font-semibold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Test Periods per Week</Label>
                    <Select
                      value={String(testConfig[level.id]?.per_week || 1)}
                      onValueChange={(value) => updateTestConfig(level.id, 'per_week', parseInt(value))}
                    >
                      <SelectTrigger className="font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 per week</SelectItem>
                        <SelectItem value="2">2 per week</SelectItem>
                        <SelectItem value="3">3 per week</SelectItem>
                        <SelectItem value="4">4 per week</SelectItem>
                        <SelectItem value="5">5 per week</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Supervisor Teacher</Label>
                    <Select
                      value={testConfig[level.id]?.supervisor_teacher_id || ''}
                      onValueChange={(value) => updateTestConfig(level.id, 'supervisor_teacher_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select supervisor..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>No supervisor</SelectItem>
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
            ))}
          </div>

          <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">How it works</p>
                <p className="text-xs">Test slots are automatically created as special "subjects" in the schedule. The supervisor teacher oversees these assessment periods for their assigned level.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Info - Compact */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4" />
            School ID
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-3 rounded-lg bg-slate-100 border border-slate-200">
            <p className="text-sm font-mono text-slate-900 font-semibold">{school?.id || 'Not available'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}