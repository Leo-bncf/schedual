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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Building2, 
  Clock, 
  Calendar, 
  Bell, 
  Shield,
  Save,
  Loader2,
  CheckCircle,
  CreditCard,
  Users,
  Mail,
  UserPlus,
  AlertCircle,
  XCircle,
  Info,
  Globe,
  MapPin,
  Hash,
  School,
  Timer,
  MoreHorizontal,
  Trash2,
  Plus,
  Filter,
  Search,
  Star
} from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import ConstraintCard from '../components/constraints/ConstraintCard';
import ConstraintBuilder from '../components/constraints/ConstraintBuilder';
import EmptyState from '../components/ui-custom/EmptyState';
import { toast } from 'sonner';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore',
  'Asia/Dubai', 'Australia/Sydney'
];

export default function Settings() {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [buyUsersDialogOpen, setBuyUsersDialogOpen] = useState(false);
  const [usersToBuy, setUsersToBuy] = useState(1);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [constraintDialogOpen, setConstraintDialogOpen] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: () => base44.entities.School.list(),
  });

  const school = schools[0];

  const { data: schoolAdmins = [], isLoading: isLoadingAdmins } = useQuery({
    queryKey: ['schoolAdmins', user?.school_id],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('getSchoolAdmins');
      return data?.admins || [];
    },
    enabled: !!user?.school_id,
  });

  const { data: constraints = [] } = useQuery({
    queryKey: ['constraints'],
    queryFn: () => base44.entities.Constraint.list(),
  });

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

  const inviteUserMutation = useMutation({
    mutationFn: async (email) => {
      console.log('Sending invitation to:', email);
      const response = await base44.functions.invoke('inviteSchoolAdmin', { email });
      console.log('Invitation response:', response);
      
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      return response.data;
    },
    onSuccess: (data) => {
      console.log('Invitation success:', data);
      queryClient.invalidateQueries({ queryKey: ['schoolAdmins'] });
      toast.success('✅ Admin access granted successfully!');
      setInviteEmail('');
      setInviteDialogOpen(false);
    },
    onError: (error) => {
      console.error('Invitation error:', error);
      toast.error(error.message || 'Failed to send invitation');
    }
  });

  const createConstraintMutation = useMutation({
    mutationFn: (data) => base44.entities.Constraint.create({ ...data, source: 'admin' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['constraints'] });
      setConstraintDialogOpen(false);
      setEditingConstraint(null);
      toast.success('Constraint created successfully');
    },
  });

  const updateConstraintMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Constraint.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['constraints'] });
      setConstraintDialogOpen(false);
      setEditingConstraint(null);
      toast.success('Constraint updated successfully');
    },
  });

  const deleteConstraintMutation = useMutation({
    mutationFn: (id) => base44.entities.Constraint.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['constraints'] });
      toast.success('Constraint deleted successfully');
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

  const handleBuyAdditionalUsers = async (quantity) => {
    setIsProcessing(true);
    try {
      const { data } = await base44.functions.invoke('createCheckout', {
        additional_users_only: true,
        quantity
      });
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout process');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsProcessing(true);
    try {
      const { data } = await base44.functions.invoke('createCheckout', {
        manage_subscription: true
      });
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert('Failed to open billing portal');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditConstraint = (constraint) => {
    setEditingConstraint(constraint);
    setConstraintDialogOpen(true);
  };

  const handleToggleConstraint = async (constraint) => {
    await updateConstraintMutation.mutateAsync({
      id: constraint.id,
      data: { is_active: !constraint.is_active }
    });
  };

  const handleWeightChange = async (constraint, weight) => {
    await updateConstraintMutation.mutateAsync({
      id: constraint.id,
      data: { weight }
    });
  };

  const handleSubmitConstraint = (data) => {
    if (editingConstraint) {
      updateConstraintMutation.mutate({ id: editingConstraint.id, data });
    } else {
      createConstraintMutation.mutate(data);
    }
  };

  const filteredConstraints = constraints.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const hardConstraints = filteredConstraints.filter(c => c.type === 'hard');
  const softConstraints = filteredConstraints.filter(c => c.type === 'soft');

  const isActive = school?.subscription_status === 'active';
  const isPastDue = school?.subscription_status === 'past_due';

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
        <TabsList className="grid grid-cols-5 w-full max-w-3xl bg-gradient-to-r from-slate-100 to-slate-200 p-1 h-auto">
          <TabsTrigger value="school" className="flex flex-col items-center gap-1.5 py-3 data-[state=active]:bg-white data-[state=active]:shadow-md">
            <Building2 className="w-5 h-5" />
            <span className="text-xs font-medium">School Info</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex flex-col items-center gap-1.5 py-3 data-[state=active]:bg-white data-[state=active]:shadow-md">
            <Calendar className="w-5 h-5" />
            <span className="text-xs font-medium">Schedule</span>
          </TabsTrigger>
          <TabsTrigger value="admins" className="flex flex-col items-center gap-1.5 py-3 data-[state=active]:bg-white data-[state=active]:shadow-md">
            <Users className="w-5 h-5" />
            <span className="text-xs font-medium">Admins</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex flex-col items-center gap-1.5 py-3 data-[state=active]:bg-white data-[state=active]:shadow-md">
            <CreditCard className="w-5 h-5" />
            <span className="text-xs font-medium">Billing</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex flex-col items-center gap-1.5 py-3 data-[state=active]:bg-white data-[state=active]:shadow-md">
            <Bell className="w-5 h-5" />
            <span className="text-xs font-medium">Alerts</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="school">
          <div className="space-y-6">
            {/* Basic Information */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
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
                    <Input 
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., International School of Geneva"
                      className="h-11"
                    />
                    <p className="text-xs text-slate-500">Official name of your institution</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code" className="flex items-center gap-2 text-sm font-semibold">
                      <Hash className="w-4 h-4 text-indigo-600" />
                      School Code *
                    </Label>
                    <Input 
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="e.g., ISG"
                      className="h-11"
                    />
                    <p className="text-xs text-slate-500">Short identifier for your school</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ib_school_code" className="flex items-center gap-2 text-sm font-semibold">
                      <Shield className="w-4 h-4 text-indigo-600" />
                      IB World School Code
                    </Label>
                    <Input 
                      id="ib_school_code"
                      value={formData.ib_school_code}
                      onChange={(e) => setFormData({ ...formData, ib_school_code: e.target.value })}
                      placeholder="e.g., 001234"
                      className="h-11"
                    />
                    <p className="text-xs text-slate-500">Official IB organization code</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="academic_year" className="flex items-center gap-2 text-sm font-semibold">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      Academic Year
                    </Label>
                    <Select 
                      value={formData.academic_year} 
                      onValueChange={(value) => setFormData({ ...formData, academic_year: value })}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
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

            {/* Location & Timezone */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50">
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
                  <Input 
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Education Street, City, Country"
                    className="h-11"
                  />
                  <p className="text-xs text-slate-500">Physical location of your school</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone" className="flex items-center gap-2 text-sm font-semibold">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    Timezone
                  </Label>
                  <Select 
                    value={formData.timezone} 
                    onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">Used for scheduling and notifications</p>
                </div>
              </CardContent>
            </Card>

            {/* System Information */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50">
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
                    <p className="text-sm font-mono text-slate-900 font-semibold mb-2">{school?.id || 'Not available'}</p>
                    <div className="flex items-start gap-2 text-xs text-slate-600">
                      <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <p>This unique ID is used internally for data imports and integrations. Keep it secure and only share with authorized personnel.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="schedule">
          <div className="space-y-6">
            {/* Daily Schedule */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <Clock className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Daily Schedule</CardTitle>
                    <CardDescription>Configure your school's daily timetable structure</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
                    <Label htmlFor="periods_per_day" className="flex items-center gap-2 text-sm font-semibold text-blue-900 mb-3">
                      <Hash className="w-4 h-4" />
                      Periods Per Day
                    </Label>
                    <Input 
                      id="periods_per_day"
                      type="number"
                      min="4"
                      max="12"
                      value={formData.periods_per_day}
                      onChange={(e) => setFormData({ ...formData, periods_per_day: parseInt(e.target.value) })}
                      className="h-12 text-lg font-semibold border-blue-300"
                    />
                    <p className="text-xs text-blue-700 mt-2">Total teaching periods (4-12)</p>
                  </div>

                  <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200">
                    <Label htmlFor="period_duration" className="flex items-center gap-2 text-sm font-semibold text-emerald-900 mb-3">
                      <Timer className="w-4 h-4" />
                      Period Length
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        id="period_duration"
                        type="number"
                        min="30"
                        max="90"
                        value={formData.period_duration_minutes}
                        onChange={(e) => setFormData({ ...formData, period_duration_minutes: parseInt(e.target.value) })}
                        className="h-12 text-lg font-semibold border-emerald-300"
                      />
                      <span className="text-lg font-semibold text-emerald-700">min</span>
                    </div>
                    <p className="text-xs text-emerald-700 mt-2">Duration per period (30-90 min)</p>
                  </div>

                  <div className="p-5 rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 border-2 border-violet-200">
                    <Label htmlFor="days_per_week" className="flex items-center gap-2 text-sm font-semibold text-violet-900 mb-3">
                      <Calendar className="w-4 h-4" />
                      School Week
                    </Label>
                    <Select 
                      value={String(formData.days_per_week)} 
                      onValueChange={(value) => setFormData({ ...formData, days_per_week: parseInt(value) })}
                    >
                      <SelectTrigger className="h-12 text-lg font-semibold border-violet-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 Days (Mon-Fri)</SelectItem>
                        <SelectItem value="6">6 Days (Mon-Sat)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-violet-700 mt-2">Teaching days per week</p>
                  </div>

                  <div className="p-5 rounded-xl bg-gradient-to-br from-rose-50 to-rose-100 border-2 border-rose-200">
                    <Label htmlFor="start_time" className="flex items-center gap-2 text-sm font-semibold text-rose-900 mb-3">
                      <Clock className="w-4 h-4" />
                      Start Time
                    </Label>
                    <Input 
                      id="start_time"
                      type="time"
                      value={formData.school_start_time}
                      onChange={(e) => setFormData({ ...formData, school_start_time: e.target.value })}
                      className="h-12 text-lg font-semibold border-rose-300"
                    />
                    <p className="text-xs text-rose-700 mt-2">First period begins at</p>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex gap-2">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-800">
                      <p className="font-semibold mb-1">Schedule Preview:</p>
                      <p>With your current settings, the school day runs from <strong>{formData.school_start_time}</strong> with <strong>{formData.periods_per_day}</strong> periods of <strong>{formData.period_duration_minutes}</strong> minutes each, over <strong>{formData.days_per_week}</strong> days per week.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* IB Requirements */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100">
                    <Shield className="w-5 h-5 text-indigo-700" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">IB Diploma Programme Requirements</CardTitle>
                    <CardDescription>Set teaching hours for HL and SL courses</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="p-6 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-bold text-purple-900 text-lg">Higher Level (HL)</p>
                        <p className="text-sm text-purple-700">Weekly teaching hours</p>
                      </div>
                      <div className="w-16 h-16 rounded-full bg-purple-200 flex items-center justify-center">
                        <span className="text-2xl font-bold text-purple-900">{formData.settings?.hl_hours || 6}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input 
                        type="number"
                        min="4"
                        max="10"
                        className="h-11 text-center font-semibold border-purple-300"
                        value={formData.settings?.hl_hours || 6}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          settings: { ...formData.settings, hl_hours: parseInt(e.target.value) }
                        })}
                      />
                      <span className="text-sm text-purple-700 font-medium">hours/week</span>
                    </div>
                    <p className="text-xs text-purple-600 mt-3">IB recommends 240 hours over 2 years (6h/week)</p>
                  </div>

                  <div className="p-6 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 border-2 border-teal-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-bold text-teal-900 text-lg">Standard Level (SL)</p>
                        <p className="text-sm text-teal-700">Weekly teaching hours</p>
                      </div>
                      <div className="w-16 h-16 rounded-full bg-teal-200 flex items-center justify-center">
                        <span className="text-2xl font-bold text-teal-900">{formData.settings?.sl_hours || 4}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input 
                        type="number"
                        min="3"
                        max="8"
                        className="h-11 text-center font-semibold border-teal-300"
                        value={formData.settings?.sl_hours || 4}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          settings: { ...formData.settings, sl_hours: parseInt(e.target.value) }
                        })}
                      />
                      <span className="text-sm text-teal-700 font-medium">hours/week</span>
                    </div>
                    <p className="text-xs text-teal-600 mt-3">IB recommends 150 hours over 2 years (4h/week)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scheduling Constraints */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-gradient-to-r from-rose-50 to-pink-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-rose-100">
                      <Shield className="w-5 h-5 text-rose-700" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Scheduling Constraints</CardTitle>
                      <CardDescription>Rules and preferences for schedule generation</CardDescription>
                    </div>
                  </div>
                  <Button onClick={() => setConstraintDialogOpen(true)} className="bg-rose-600 hover:bg-rose-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Constraint
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Search */}
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Search constraints..." 
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Stats */}
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200">
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Total</p>
                    <p className="text-2xl font-bold text-slate-900">{constraints.length}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200">
                    <p className="text-xs font-medium text-red-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Hard
                    </p>
                    <p className="text-2xl font-bold text-red-900">{hardConstraints.length}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200">
                    <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Star className="w-3 h-3" /> Soft
                    </p>
                    <p className="text-2xl font-bold text-amber-900">{softConstraints.length}</p>
                  </div>
                </div>

                {/* Constraints List */}
                <Tabs value={typeFilter} onValueChange={setTypeFilter}>
                  <TabsList className="bg-slate-100">
                    <TabsTrigger value="all">All ({constraints.length})</TabsTrigger>
                    <TabsTrigger value="hard">
                      <Shield className="w-4 h-4 mr-1" />
                      Hard ({hardConstraints.length})
                    </TabsTrigger>
                    <TabsTrigger value="soft">
                      <Star className="w-4 h-4 mr-1" />
                      Soft ({softConstraints.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="all" className="space-y-6 mt-6">
                    {hardConstraints.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Hard Constraints
                        </h4>
                        {hardConstraints.map(constraint => (
                          <ConstraintCard 
                            key={constraint.id}
                            constraint={constraint}
                            onEdit={handleEditConstraint}
                            onDelete={(c) => deleteConstraintMutation.mutate(c.id)}
                            onToggle={handleToggleConstraint}
                            onWeightChange={handleWeightChange}
                          />
                        ))}
                      </div>
                    )}

                    {softConstraints.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2">
                          <Star className="w-4 h-4" />
                          Soft Constraints
                        </h4>
                        {softConstraints.map(constraint => (
                          <ConstraintCard 
                            key={constraint.id}
                            constraint={constraint}
                            onEdit={handleEditConstraint}
                            onDelete={(c) => deleteConstraintMutation.mutate(c.id)}
                            onToggle={handleToggleConstraint}
                            onWeightChange={handleWeightChange}
                          />
                        ))}
                      </div>
                    )}

                    {filteredConstraints.length === 0 && (
                      <EmptyState 
                        icon={Shield}
                        title="No constraints yet"
                        description="Add scheduling rules to control how your timetable is generated."
                        action={() => setConstraintDialogOpen(true)}
                        actionLabel="Add First Constraint"
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="hard" className="space-y-3 mt-6">
                    {hardConstraints.map(constraint => (
                      <ConstraintCard 
                        key={constraint.id}
                        constraint={constraint}
                        onEdit={handleEditConstraint}
                        onDelete={(c) => deleteConstraintMutation.mutate(c.id)}
                        onToggle={handleToggleConstraint}
                        onWeightChange={handleWeightChange}
                      />
                    ))}
                    {hardConstraints.length === 0 && (
                      <EmptyState 
                        icon={Shield}
                        title="No hard constraints"
                        description="Hard constraints are strictly enforced during scheduling."
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="soft" className="space-y-3 mt-6">
                    {softConstraints.map(constraint => (
                      <ConstraintCard 
                        key={constraint.id}
                        constraint={constraint}
                        onEdit={handleEditConstraint}
                        onDelete={(c) => deleteConstraintMutation.mutate(c.id)}
                        onToggle={handleToggleConstraint}
                        onWeightChange={handleWeightChange}
                      />
                    ))}
                    {softConstraints.length === 0 && (
                      <EmptyState 
                        icon={Star}
                        title="No soft constraints"
                        description="Soft constraints are preferences the optimizer tries to satisfy."
                      />
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="admins">
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-violet-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100">
                    <Users className="w-5 h-5 text-indigo-700" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Administrator Management</CardTitle>
                    <CardDescription className="mt-1">
                      Manage who has admin access to your school. All admins have full permissions.
                    </CardDescription>
                  </div>
                </div>
                <Button
                  onClick={() => setInviteDialogOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700"
                  disabled={!school || schoolAdmins.length >= ((school?.max_additional_users || 0) + 1)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Invite Admin
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Seats Info */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                      <Users className="w-7 h-7 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-900">
                        {schoolAdmins?.length || 0} / {(school?.max_additional_users || 0) + 1}
                      </p>
                      <p className="text-sm text-blue-700 font-medium">
                        Admin seats used
                      </p>
                    </div>
                  </div>
                  {schoolAdmins && schoolAdmins.length >= ((school?.max_additional_users || 0) + 1) && (
                    <Button
                      onClick={() => setBuyUsersDialogOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Buy More Seats
                    </Button>
                  )}
                </div>
              </div>

              {/* Admin List */}
              <div className="space-y-3">
                {isLoadingAdmins ? (
                  <div className="text-center py-12">
                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-sm text-slate-500">Loading administrators...</p>
                  </div>
                ) : schoolAdmins?.length > 0 ? (
                  schoolAdmins.map((admin) => (
                    <Card key={admin.id} className="border-2 border-slate-200 hover:border-indigo-300 transition-all duration-200">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
                              <span className="text-white font-bold text-xl">
                                {admin.full_name?.charAt(0)?.toUpperCase() || admin.email?.charAt(0)?.toUpperCase() || 'A'}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 text-lg">{admin.full_name || 'Administrator'}</p>
                              <p className="text-sm text-slate-500">{admin.email}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <Badge className="bg-indigo-100 text-indigo-700 border-0 text-xs">
                                  Administrator
                                </Badge>
                                {admin.email === user?.email && (
                                  <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                                    You
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          {admin.email !== user?.email && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9">
                                  <MoreHorizontal className="w-5 h-5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-rose-600 focus:text-rose-600"
                                  onClick={async () => {
                                    if (confirm(`Remove ${admin.full_name || admin.email} as administrator?\n\nThey will lose all access to school management. This action cannot be undone.`)) {
                                      try {
                                        await base44.entities.User.update(admin.id, { school_id: null });
                                        queryClient.invalidateQueries({ queryKey: ['schoolAdmins'] });
                                        toast.success('Administrator removed successfully');
                                      } catch (error) {
                                        toast.error('Failed to remove administrator');
                                      }
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Remove Admin Access
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <Users className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="font-medium">No administrators found</p>
                    <p className="text-sm mt-1">Invite admins to manage your school</p>
                  </div>
                )}
              </div>

              {/* Important Notice */}
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">⚠️ Admin Permissions</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>All admins have <strong>full access</strong> to manage students, teachers, subjects, and schedules</li>
                      <li>Admins can <strong>add or remove other admins</strong> (including you)</li>
                      <li>Only grant admin access to <strong>trusted individuals</strong></li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Subscription & Billing
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Manage your subscription, users, and payment details
                  </CardDescription>
                </div>
                {isActive && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-0">
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Active
                  </Badge>
                )}
                {isPastDue && (
                  <Badge className="bg-amber-100 text-amber-700 border-0">
                    <AlertCircle className="w-4 h-4 mr-1.5" />
                    Payment Required
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isActive ? (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
                      <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">Plan</p>
                      <p className="text-xl font-bold text-blue-900">Yearly</p>
                      <p className="text-xs text-blue-600 mt-1">€187/month</p>
                    </div>
                    <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200">
                      <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide mb-1">Next Billing</p>
                      <p className="text-xl font-bold text-emerald-900">
                        {school.subscription_end_date 
                          ? new Date(school.subscription_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'N/A'
                        }
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200">
                      <p className="text-xs font-medium text-violet-700 uppercase tracking-wide mb-1">Extra Users</p>
                      <p className="text-xl font-bold text-violet-900">
                        {school.max_additional_users || 0}
                      </p>
                      <p className="text-xs text-violet-600 mt-1">additional seats</p>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      className="w-full h-12 font-medium border-2"
                      onClick={handleManageSubscription}
                      disabled={isProcessing}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Manage Subscription
                    </Button>
                    
                    <Button 
                      variant="outline"
                      className="w-full h-12 font-medium border-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                      onClick={() => setBuyUsersDialogOpen(true)}
                      disabled={isProcessing}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Buy Additional Users
                    </Button>

                    <Button 
                      variant="outline"
                      className="w-full h-12 font-medium border-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 sm:col-span-2"
                      onClick={() => setInviteDialogOpen(true)}
                      disabled={isProcessing || !school?.max_additional_users || schoolAdmins.length >= (school.max_additional_users + 1)}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Invite School Admin ({schoolAdmins.length}/{(school?.max_additional_users || 0) + 1})
                    </Button>
                  </div>

                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-xs text-blue-800">
                      <strong>Note:</strong> "Manage Subscription" opens Stripe's portal for payment methods, invoices, and cancellation.
                    </p>
                  </div>

                  {/* Current Admins List */}
                  {schoolAdmins.length > 0 && (
                    <div className="mt-6 p-4 rounded-lg border-2 border-slate-200 bg-slate-50">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          School Administrators ({schoolAdmins.length}/{(school?.max_additional_users || 0) + 1})
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {schoolAdmins.map((admin, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                                <span className="text-white font-semibold text-sm">
                                  {admin.full_name?.charAt(0) || admin.email?.charAt(0) || 'A'}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">{admin.full_name || 'Admin User'}</p>
                                <p className="text-sm text-slate-500">{admin.email}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-blue-700 border-blue-300">
                              Admin
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">No Active Subscription</h3>
                  <p className="text-slate-600 mb-4 max-w-md mx-auto">
                    Subscribe now to unlock all features
                  </p>
                  <p className="text-sm text-slate-600">
                    Contact support at <a href="mailto:support@schedual-pro.com" className="text-blue-700 font-medium hover:underline">support@schedual-pro.com</a>
                  </p>
                </div>
              )}
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
                  <Switch defaultChecked className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-rose-500" />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-700">AI Recommendations</p>
                    <p className="text-sm text-slate-500">Receive AI advisor suggestions and insights</p>
                  </div>
                  <Switch defaultChecked className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-rose-500" />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-700">Schedule Published</p>
                    <p className="text-sm text-slate-500">Notify when a new schedule is published</p>
                  </div>
                  <Switch defaultChecked className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-rose-500" />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-700">Weekly Summary</p>
                    <p className="text-sm text-slate-500">Receive weekly scheduling summary reports</p>
                  </div>
                  <Switch className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-rose-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>

      {/* Buy Additional Users Dialog */}
      <Dialog open={buyUsersDialogOpen} onOpenChange={setBuyUsersDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purchase Additional User Seats</DialogTitle>
            <DialogDescription>
              Add more admin accounts for your school. Each additional user costs €200/year.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Number of Additional Users</Label>
              <Input 
                id="quantity"
                type="number"
                min="1"
                max="50"
                value={usersToBuy}
                onChange={(e) => setUsersToBuy(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-600">Additional Users</span>
                <span className="font-semibold">{usersToBuy}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-600">Price per user</span>
                <span className="font-semibold">€200/year</span>
              </div>
              <div className="border-t border-slate-200 mt-3 pt-3 flex justify-between items-center">
                <span className="font-bold text-lg">Total</span>
                <span className="font-bold text-2xl text-blue-900">€{usersToBuy * 200}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyUsersDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-blue-900 hover:bg-blue-800"
              onClick={() => {
                handleBuyAdditionalUsers(usersToBuy);
                setBuyUsersDialogOpen(false);
              }}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Proceed to Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Admin Dialog */}
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <UserPlus className="w-6 h-6 text-indigo-600" />
              Add School Administrator
            </DialogTitle>
            <DialogDescription>
              Grant admin access to a colleague who already has an account on Schedual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {/* Important Notice */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Info className="w-5 h-5 text-blue-600" />
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-blue-900 text-sm">Account Required</p>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    The person you want to add must <strong>already have a Schedual account</strong>. If they don't have one yet, ask them to register at <a href="https://schedual-pro.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">schedual-pro.com</a> first.
                  </p>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    Once they're registered, enter their email below to instantly grant them admin access to your school.
                  </p>
                </div>
              </div>
            </div>

            {/* Available Seats */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-900">
                    {(school?.max_additional_users || 0) + 1 - schoolAdmins.length} seats available
                  </p>
                  <p className="text-sm text-emerald-700">
                    {schoolAdmins.length} of {(school?.max_additional_users || 0) + 1} admin seats used
                  </p>
                </div>
              </div>
            </div>
            
            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="invite-email" className="text-sm font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-600" />
                Registered User's Email
              </Label>
              <Input 
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-11 text-base"
              />
              <p className="text-xs text-slate-500 flex items-start gap-1.5">
                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>Enter the email address they used to create their Schedual account</span>
              </p>
            </div>

            {schoolAdmins.length > 0 && (
              <div className="space-y-2">
                <Label>Current Admins</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {schoolAdmins.map((admin, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{admin.full_name || admin.email}</p>
                        <p className="text-xs text-slate-500 truncate">{admin.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setInviteDialogOpen(false);
              setInviteEmail('');
            }}>
              Cancel
            </Button>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => {
                console.log('Button clicked, email:', inviteEmail);
                if (inviteEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
                  console.log('Email valid, calling mutation');
                  inviteUserMutation.mutate(inviteEmail);
                } else {
                  console.log('Email invalid or empty');
                  toast.error('Please enter a valid email address');
                }
              }}
              disabled={inviteUserMutation.isPending || !inviteEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)}
            >
              {inviteUserMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding Admin...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Grant Admin Access
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Constraint Dialog */}
      <Dialog open={constraintDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setConstraintDialogOpen(false);
          setEditingConstraint(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConstraint ? 'Edit Constraint' : 'Create New Constraint'}
            </DialogTitle>
            <DialogDescription>
              {editingConstraint 
                ? 'Modify the constraint details and settings.' 
                : 'Define a scheduling rule or preference using templates or custom settings.'
              }
            </DialogDescription>
          </DialogHeader>
          <ConstraintBuilder 
            onSubmit={handleSubmitConstraint}
            initialData={editingConstraint}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}