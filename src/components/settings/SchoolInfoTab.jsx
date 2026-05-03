import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Calendar, CalendarDays, Clock, Globe, Hash, Info, MapPin, School, Shield } from 'lucide-react';

const ALL_DAYS = [
  { value: 'MONDAY', label: 'Mon' },
  { value: 'TUESDAY', label: 'Tue' },
  { value: 'WEDNESDAY', label: 'Wed' },
  { value: 'THURSDAY', label: 'Thu' },
  { value: 'FRIDAY', label: 'Fri' },
];
import { TIMEZONES } from '@/components/settings/SettingsConstants';

export default function SchoolInfoTab({ formData, setFormData, school }) {
  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm bg-white rounded-xl">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <School className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <CardTitle className="text-lg">Basic Information</CardTitle>
              <CardDescription>Essential details about your school</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="w-4 h-4 text-indigo-600" />
                School Name *
              </Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., International School of Geneva" className="h-11" />
              <p className="text-xs text-slate-500">Official name of your institution</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="code" className="flex items-center gap-2 text-sm font-semibold">
                <Hash className="w-4 h-4 text-indigo-600" />
                School Code *
              </Label>
              <Input id="code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="e.g., ISG" className="h-11" />
              <p className="text-xs text-slate-500">Short identifier for your school</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ib_school_code" className="flex items-center gap-2 text-sm font-semibold">
                <Shield className="w-4 h-4 text-indigo-600" />
                IB World School Code
              </Label>
              <Input id="ib_school_code" value={formData.ib_school_code} onChange={(e) => setFormData({ ...formData, ib_school_code: e.target.value })} placeholder="e.g., 001234" className="h-11" />
              <p className="text-xs text-slate-500">Official IB organization code</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="academic_year" className="flex items-center gap-2 text-sm font-semibold">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Academic Year
              </Label>
              <Select value={formData.academic_year} onValueChange={(value) => setFormData({ ...formData, academic_year: value })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2023-2024">2023-2024</SelectItem>
                  <SelectItem value="2024-2025">2024-2025</SelectItem>
                  <SelectItem value="2025-2026">2025-2026</SelectItem>
                  <SelectItem value="2026-2027">2026-2027</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Current academic year</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm bg-white rounded-xl">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <Globe className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <CardTitle className="text-lg">Location & Timezone</CardTitle>
              <CardDescription>Where your school is located</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="address" className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="w-4 h-4 text-emerald-600" />
              School Address
            </Label>
            <Input id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="123 Education Street, City, Country" className="h-11" />
            <p className="text-xs text-slate-500">Physical location of your school</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone" className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="w-4 h-4 text-emerald-600" />
              Timezone
            </Label>
            <Select value={formData.timezone} onValueChange={(value) => setFormData({ ...formData, timezone: value })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">Used for scheduling and notifications</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm bg-white rounded-xl">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Clock className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <CardTitle className="text-lg">Block Duration</CardTitle>
              <CardDescription>Choose one duration in minutes for all timetable blocks.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="period_duration_minutes" className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="w-4 h-4 text-amber-600" />
                Unit Block Duration
              </Label>
              <Input id="period_duration_minutes" type="number" min="15" step="5" value={formData.period_duration_minutes} onChange={(e) => setFormData({ ...formData, period_duration_minutes: Number(e.target.value || 60) })} className="h-11" />
              <p className="text-xs text-slate-500">Example: 60, 55, 45 minutes. This value applies to all blocks.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm bg-white rounded-xl">
        <CardHeader className="bg-gradient-to-r from-rose-50 to-pink-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-100">
              <CalendarDays className="w-5 h-5 text-rose-700" />
            </div>
            <div>
              <CardTitle className="text-lg">Schedule Configuration</CardTitle>
              <CardDescription>Core settings used when generating timetables</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="day_start_time" className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="w-4 h-4 text-rose-600" />
                School Day Start Time
              </Label>
              <Input
                id="day_start_time"
                type="time"
                value={formData.day_start_time}
                onChange={(e) => setFormData({ ...formData, day_start_time: e.target.value })}
                className="h-11"
              />
              <p className="text-xs text-slate-500">First block of the day begins at this time</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="periods_per_day" className="flex items-center gap-2 text-sm font-semibold">
                <Hash className="w-4 h-4 text-rose-600" />
                Periods Per Day
              </Label>
              <Input
                id="periods_per_day"
                type="number"
                min="1"
                max="20"
                value={formData.periods_per_day}
                onChange={(e) => setFormData({ ...formData, periods_per_day: Number(e.target.value || 10) })}
                className="h-11"
              />
              <p className="text-xs text-slate-500">Number of teaching periods in a school day</p>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="w-4 h-4 text-rose-600" />
                Teaching Days
              </Label>
              <div className="flex flex-wrap gap-2">
                {ALL_DAYS.map((day) => {
                  const active = formData.days_of_week?.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => {
                        const current = formData.days_of_week || [];
                        const next = active
                          ? current.filter((d) => d !== day.value)
                          : [...current, day.value].sort((a, b) => ALL_DAYS.findIndex(x => x.value === a) - ALL_DAYS.findIndex(x => x.value === b));
                        if (next.length > 0) setFormData({ ...formData, days_of_week: next });
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                        active
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">Select the days your school operates</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm bg-white rounded-xl">
        <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-100">
              <Info className="w-5 h-5 text-violet-700" />
            </div>
            <div>
              <CardTitle className="text-lg">System Information</CardTitle>
              <CardDescription>Read-only system identifiers</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">School ID</Label>
            <div className="p-4 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border-2 border-slate-200">
              <p className="text-sm font-mono text-slate-900 font-semibold mb-2">{school?.school_id || school?.id || 'Not available'}</p>
              <div className="flex items-start gap-2 text-xs text-slate-600">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <p>This is your school's visible identifier (used for imports and integrations). Keep it secure and only share with authorized personnel.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}