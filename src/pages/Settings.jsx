import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Building2, Bell, Save, Loader2, CheckCircle, Users, GraduationCap, Zap, Link as LinkIcon } from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import YearAdvancement from '../components/settings/YearAdvancement';
import { TIER_LIMITS, getAdminSeatLimit, getTierLimits } from '@/lib/tierLimits';
import ScholrIntegrationCard from '@/components/settings/ScholrIntegrationCard';
import SchoolInfoTab from '@/components/settings/SchoolInfoTab';
import AdminsTab from '@/components/settings/AdminsTab';
import SubscriptionTab from '@/components/settings/SubscriptionTab';
import NotificationsTab from '@/components/settings/NotificationsTab';
import InviteAdminDialog from '@/components/settings/InviteAdminDialog';
import { toast } from 'sonner';

const TIERS = TIER_LIMITS;

export default function Settings() {
  const [isSaving, setIsSaving] = useState(false);
  const [stripeNoticeShown, setStripeNoticeShown] = useState(false);
  const [saved, setSaved] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const [inviteLink, setInviteLink] = useState('');
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [showTierOptions, setShowTierOptions] = useState(false);
  const [showAddOns, setShowAddOns] = useState(false);
  const [pendingRemoveAdmin, setPendingRemoveAdmin] = useState(null);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['schools', user?.school_id],
    enabled: !!user?.school_id,
    queryFn: () => base44.entities.School.filter({ id: user.school_id }),
  });

  const school = schools[0];
  const schoolRecordId = school?.id;
  const sharedTier = getTierLimits(school?.subscription_tier);
  const currentTier = school?.subscription_tier ? TIERS[school.subscription_tier] : null;
  const tierStudentLimit = sharedTier?.studentLimit ?? currentTier?.limits?.students ?? null;
  const tierSavedVersionsLimit = sharedTier?.savedVersionsLimit;
  const tierAdminSeatLimit = getAdminSeatLimit(school?.subscription_tier, school?.max_admin_seats ?? 3);
  const effectiveAdminSeatLimit = tierAdminSeatLimit;

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
    period_duration_minutes: 60,
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
        period_duration_minutes: school.period_duration_minutes || 60,
        days_per_week: school.days_per_week || 5,
        school_start_time: school.school_start_time || '08:00',
        settings: school.settings || {}
      });
    }
  }, [school]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeStatus = params.get('stripe');

    if (!stripeStatus || stripeNoticeShown) return;

    if (stripeStatus === 'success') {
      toast.success('Payment completed. Your subscription is being activated.');
      queryClient.invalidateQueries({ queryKey: ['schools'] });
    }

    if (stripeStatus === 'cancelled') {
      toast.error('Checkout was cancelled.');
    }

    params.delete('stripe');
    params.delete('tier');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
    window.history.replaceState({}, '', nextUrl);
    setStripeNoticeShown(true);
  }, [queryClient, stripeNoticeShown]);

  const createSchoolMutation = useMutation({
    mutationFn: (data) => base44.entities.School.create({ ...data, school_id: user?.school_id }),
    onError: (error) => {
      toast.error(error?.message || 'Unable to create school settings.');
    },
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
      toast.error('Please fill in School Name and School Code');
      return;
    }
    setIsSaving(true);
    try {
      if (schoolRecordId) {
        await updateSchoolMutation.mutateAsync({ id: schoolRecordId, data: formData });
      } else {
        throw new Error('School record not found for this account.');
      }
    } catch (error) {
      console.error('Error saving school:', error);
      toast.error(error?.message || 'Failed to save school settings. Please try again.');
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
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full max-w-5xl bg-white border border-slate-200 shadow-sm p-1 h-auto rounded-xl">
          <TabsTrigger value="school" className="flex flex-col items-center gap-1.5 py-3 rounded-lg data-[state=active]:bg-slate-50 data-[state=active]:text-indigo-600 transition-all">
            <Building2 className="w-5 h-5" />
            <span className="text-xs font-medium">School Info</span>
          </TabsTrigger>
          <TabsTrigger value="admins" className="flex flex-col items-center gap-1.5 py-3 rounded-lg data-[state=active]:bg-slate-50 data-[state=active]:text-indigo-600 transition-all">
            <Users className="w-5 h-5" />
            <span className="text-xs font-medium">Admins</span>
          </TabsTrigger>
          <TabsTrigger value="academic" className="flex flex-col items-center gap-1.5 py-3 rounded-lg data-[state=active]:bg-slate-50 data-[state=active]:text-indigo-600 transition-all">
            <GraduationCap className="w-5 h-5" />
            <span className="text-xs font-medium">Academic</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex flex-col items-center gap-1.5 py-3 rounded-lg data-[state=active]:bg-slate-50 data-[state=active]:text-indigo-600 transition-all">
            <Zap className="w-5 h-5" />
            <span className="text-xs font-medium">Tier</span>
          </TabsTrigger>
          <TabsTrigger value="scholr" className="flex flex-col items-center gap-1.5 py-3 rounded-lg data-[state=active]:bg-slate-50 data-[state=active]:text-indigo-600 transition-all">
            <LinkIcon className="w-5 h-5" />
            <span className="text-xs font-medium">Scholr</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex flex-col items-center gap-1.5 py-3 rounded-lg data-[state=active]:bg-slate-50 data-[state=active]:text-indigo-600 transition-all">
            <Bell className="w-5 h-5" />
            <span className="text-xs font-medium">Alerts</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="school">
          <SchoolInfoTab formData={formData} setFormData={setFormData} school={school} />
        </TabsContent>



        <TabsContent value="admins">
          <AdminsTab
            school={school}
            schoolAdmins={schoolAdmins}
            isLoadingAdmins={isLoadingAdmins}
            effectiveAdminSeatLimit={effectiveAdminSeatLimit}
            user={user}
            onInvite={() => setInviteDialogOpen(true)}
            onRemoveAdmin={(admin) => setPendingRemoveAdmin(admin)}
          />
        </TabsContent>

        <TabsContent value="academic">
          <div className="space-y-6">
            <YearAdvancement />
          </div>
        </TabsContent>



        <TabsContent value="subscription">
          <SubscriptionTab
            school={school}
            schoolAdmins={schoolAdmins}
            tiers={TIERS}
            sharedTier={sharedTier}
            tierStudentLimit={tierStudentLimit}
            tierSavedVersionsLimit={tierSavedVersionsLimit}
            effectiveAdminSeatLimit={effectiveAdminSeatLimit}
            showTierOptions={showTierOptions}
            setShowTierOptions={setShowTierOptions}
            showAddOns={showAddOns}
            setShowAddOns={setShowAddOns}
          />
        </TabsContent>

        <TabsContent value="scholr">
          <ScholrIntegrationCard />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>


      </Tabs>

      <InviteAdminDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        inviteEmail={inviteEmail}
        setInviteEmail={setInviteEmail}
        inviteLink={inviteLink}
        setInviteLink={setInviteLink}
        showInviteLink={showInviteLink}
        setShowInviteLink={setShowInviteLink}
        generateInviteLinkMutation={generateInviteLinkMutation}
        effectiveAdminSeatLimit={effectiveAdminSeatLimit}
        schoolAdmins={schoolAdmins}
      />

      <AlertDialog open={!!pendingRemoveAdmin} onOpenChange={(open) => { if (!open) setPendingRemoveAdmin(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove administrator?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingRemoveAdmin?.full_name || pendingRemoveAdmin?.email}</strong> will immediately lose all access to school management. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={async () => {
                try {
                  const { data } = await base44.functions.invoke('removeSchoolAdmin', { admin_id: pendingRemoveAdmin.id });
                  if (data.success) {
                    queryClient.invalidateQueries({ queryKey: ['schoolAdmins'] });
                    toast.success('Administrator removed successfully');
                  } else {
                    toast.error(data.error || 'Failed to remove administrator');
                  }
                } catch (error) {
                  toast.error(error.message || 'Failed to remove administrator');
                } finally {
                  setPendingRemoveAdmin(null);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}