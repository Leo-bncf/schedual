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
  GraduationCap
} from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import YearAdvancement from '../components/settings/YearAdvancement';
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
  const [inviteLink, setInviteLink] = useState('');
  const [showInviteLink, setShowInviteLink] = useState(false);
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

  const generateInviteLinkMutation = useMutation({
    mutationFn: async (email) => {
      const response = await base44.functions.invoke('generateInviteLink', { email });
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      return response.data;
    },
    onSuccess: (data) => {
      setInviteLink(data.inviteUrl);
      setShowInviteLink(true);
      toast.success('✅ Invitation link generated');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to generate invitation link');
    }
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
        <TabsList className="grid grid-cols-5 w-full max-w-4xl bg-slate-100 p-1 h-auto rounded-2xl">
          <TabsTrigger value="school" className="flex flex-col items-center gap-1.5 py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Building2 className="w-5 h-5" />
            <span className="text-xs font-medium">School Info</span>
          </TabsTrigger>
          <TabsTrigger value="admins" className="flex flex-col items-center gap-1.5 py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Users className="w-5 h-5" />
            <span className="text-xs font-medium">Admins</span>
          </TabsTrigger>
          <TabsTrigger value="academic" className="flex flex-col items-center gap-1.5 py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <GraduationCap className="w-5 h-5" />
            <span className="text-xs font-medium">Academic</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex flex-col items-center gap-1.5 py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <CreditCard className="w-5 h-5" />
            <span className="text-xs font-medium">Billing</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex flex-col items-center gap-1.5 py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
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
                                        const { data } = await base44.functions.invoke('removeSchoolAdmin', { admin_id: admin.id });
                                        if (data.success) {
                                          queryClient.invalidateQueries({ queryKey: ['schoolAdmins'] });
                                          toast.success('Administrator removed successfully');
                                        } else {
                                          toast.error(data.error || 'Failed to remove administrator');
                                        }
                                      } catch (error) {
                                        toast.error(error.message || 'Failed to remove administrator');
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

        <TabsContent value="academic">
          <div className="space-y-6">
            <YearAdvancement />
          </div>
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
      <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
        setInviteDialogOpen(open);
        if (!open) {
          setInviteEmail('');
          setInviteLink('');
          setShowInviteLink(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite School Admin</DialogTitle>
            <DialogDescription>
              {showInviteLink 
                ? 'Share this link with the new admin. They must create an account or log in to accept.'
                : 'Enter the email of the person you want to invite as an administrator.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!showInviteLink ? (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p className="font-semibold mb-1">How it works:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Enter the admin's email address</li>
                        <li>We'll generate a secure invitation link</li>
                        <li>Share the link with them via email or messaging</li>
                        <li>They create an account or log in</li>
                        <li>They're automatically added as admin</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invite-email">Admin Email Address</Label>
                  <Input 
                    id="invite-email"
                    type="email"
                    placeholder="admin@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800">
                      <strong>Available seats:</strong> {(school?.max_additional_users || 0) + 1 - schoolAdmins.length} / {(school?.max_additional_users || 0) + 1}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <Label>Invitation Link</Label>
                  <div className="p-3 bg-slate-50 border-2 border-slate-200 rounded-lg">
                    <p className="text-xs font-mono text-slate-600 break-all mb-3">{inviteLink}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink);
                        toast.success('Link copied to clipboard');
                      }}
                    >
                      Copy Link
                    </Button>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-green-800">
                      <p className="font-semibold mb-1">✓ Link generated successfully</p>
                      <p>Share this link with <strong>{inviteEmail}</strong>. It will expire in 30 days.</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setInviteDialogOpen(false);
              setInviteEmail('');
              setInviteLink('');
              setShowInviteLink(false);
            }}>
              {showInviteLink ? 'Close' : 'Cancel'}
            </Button>
            {!showInviteLink && (
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  if (inviteEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
                    generateInviteLinkMutation.mutate(inviteEmail);
                  } else {
                    toast.error('Please enter a valid email address');
                  }
                }}
                disabled={generateInviteLinkMutation.isPending || !inviteEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)}
              >
                {generateInviteLinkMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Generate Invite Link
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}