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
  XCircle
} from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
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

  const { data: schoolAdmins = [] } = useQuery({
    queryKey: ['schoolAdmins', user?.school_id],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('getSchoolAdmins');
      return data?.admins || [];
    },
    enabled: !!user?.school_id && school?.subscription_status === 'active',
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
      await base44.users.inviteUser(email, 'admin');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schoolAdmins'] });
      toast.success('Invitation sent successfully');
      setInviteEmail('');
      setInviteDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send invitation');
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
        <TabsList className="bg-slate-100">
          <TabsTrigger value="school" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            School Info
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Schedule Settings
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Subscription
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite School Admin</DialogTitle>
            <DialogDescription>
              Invite another administrator to manage your school. They will have full admin access to your school only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Available Seats: {(school?.max_additional_users || 0) + 1 - schoolAdmins.length} / {(school?.max_additional_users || 0) + 1}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    {schoolAdmins.length} admin(s) currently invited
                  </p>
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
              <p className="text-xs text-slate-500">
                They will receive an invitation email to join as a school administrator
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
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => inviteUserMutation.mutate(inviteEmail)}
              disabled={inviteUserMutation.isPending || !inviteEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)}
            >
              {inviteUserMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}