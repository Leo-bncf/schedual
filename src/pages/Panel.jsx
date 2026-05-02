import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, Plus, Pencil, Trash2, Crown, MoreHorizontal, BarChart3, ShieldCheck, Search, TrendingUp, Activity, Eye, AlertTriangle, Mail, Send } from 'lucide-react';
import { Textarea } from "@/components/ui/textarea";
import AgentTrainingSection from '../components/ai-training/AgentTrainingSection';
import AutomationDashboard from '../components/admin/AutomationDashboard';
import AnalyticsDashboard from '../components/admin/AnalyticsDashboard';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageHeader from '../components/ui-custom/PageHeader';
import StatCard from '../components/ui-custom/StatCard';
import DataTable from '../components/ui-custom/DataTable';

export default function Panel() {
  const [isSchoolDialogOpen, setIsSchoolDialogOpen] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isCreateSchoolForUserOpen, setIsCreateSchoolForUserOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [schoolFormData, setSchoolFormData] = useState({
    name: '', code: '', ib_school_code: '', address: '',
    timezone: 'UTC', academic_year: '2024-2025', stripe_customer_id: ''
  });
  const [userFormData, setUserFormData] = useState({ email: '', school_id: '', role: 'user' });
  const [newSchoolFormData, setNewSchoolFormData] = useState({
    name: '', code: '', ib_school_code: '', address: '',
    timezone: 'UTC', academic_year: '2024-2025', user_email: '', user_role: 'admin'
  });

  const [isSeatsDialogOpen, setIsSeatsDialogOpen] = useState(false);
  const [seatsTargetSchool, setSeatsTargetSchool] = useState(null);
  const [seatsToAdd, setSeatsToAdd] = useState(1);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'school'|'user', item }
  const [confirmNameInput, setConfirmNameInput] = useState('');

  // School drill-down
  const [drilldown, setDrilldown] = useState(null);

  // Search
  const [schoolSearch, setSchoolSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // Broadcast email
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ subject: '', message: '', target_status: 'active' });

  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = new URLSearchParams(location.search).get('tab') || 'schools';

  const { data: schools = [], isLoading: loadingSchools } = useQuery({
    queryKey: ['allSchools'],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('adminManageSchool', { action: 'list' });
      return data.schools || [];
    },
    refetchInterval: 5000,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('adminManageUser', { action: 'list' });
      return data.users || [];
    },
  });

  const { data: allTeachers = [] } = useQuery({
    queryKey: ['allTeachers'],
    queryFn: async () => {
      try {
        const { data } = await base44.functions.invoke('adminGetAllData', { entityType: 'Teacher' });
        return data.records || [];
      } catch { return []; }
    },
  });

  const { data: allStudents = [] } = useQuery({
    queryKey: ['allStudents'],
    queryFn: async () => {
      try {
        const { data } = await base44.functions.invoke('adminGetAllData', { entityType: 'Student' });
        return data.records || [];
      } catch { return []; }
    },
  });

  const { data: allSchedules = [] } = useQuery({
    queryKey: ['allSchedules'],
    queryFn: async () => {
      try {
        const { data } = await base44.functions.invoke('adminGetAllData', { entityType: 'ScheduleVersion' });
        return data.records || [];
      } catch { return []; }
    },
  });

  const { data: auditLogs = [], isLoading: loadingAudit } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: async () => {
      try {
        const { data } = await base44.functions.invoke('adminGetAllData', { entityType: 'AuditLog' });
        return data.records || [];
      } catch { return []; }
    },
  });

  const { data: stripePrices, isLoading: loadingPrices } = useQuery({
    queryKey: ['stripePrices'],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('adminGetStripePrices');
      return data.prices || {};
    },
    staleTime: 10 * 60 * 1000, // cache 10 min — prices don't change often
  });

  // ─── Mutations ────────────────────────────────────────────────────────────

  const createSchoolMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('adminManageSchool', { action: 'create', data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allSchools'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      setIsSchoolDialogOpen(false);
      resetSchoolForm();
      toast.success('School created successfully');
    },
    onError: (error) => {
      const msg = error?.response?.data?.error || error?.data?.error || error.message;
      toast.error('Failed to create school: ' + msg);
    }
  });

  const createSchoolForUserMutation = useMutation({
    mutationFn: async (data) => {
      const { data: result } = await base44.functions.invoke('adminManageSchool', {
        action: 'create',
        data: {
          name: data.name, code: data.code, ib_school_code: data.ib_school_code,
          address: data.address, timezone: data.timezone, academic_year: data.academic_year
        }
      });
      const user = allUsers.find(u => u.email === data.user_email);
      if (user && result.school) {
        const updateResponse = await base44.functions.invoke('adminManageUser', {
          action: 'update', userId: user.id,
          data: { school_id: result.school.id }
        });
        return { school: result.school, requiresReauth: updateResponse.data?.requiresReauth, userEmail: data.user_email };
      }
      return { school: result.school };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['allSchools'] });
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      setIsCreateSchoolForUserOpen(false);
      setNewSchoolFormData({ name: '', code: '', ib_school_code: '', address: '', timezone: 'UTC', academic_year: '2024-2025', user_email: '', user_role: 'admin' });
      toast.success('School created' + (data.requiresReauth ? ` — ${data.userEmail} must log out and back in` : ''));
    },
    onError: (error) => {
      toast.error('Failed: ' + (error.message || 'Unknown error'));
    }
  });

  const updateSchoolMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await base44.functions.invoke('adminManageSchool', { action: 'update', schoolId: id, data });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allSchools'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      setIsSchoolDialogOpen(false);
      resetSchoolForm();
      toast.success('School updated');
    },
    onError: (error) => {
      const msg = error?.response?.data?.error || error?.data?.error || error.message;
      toast.error('Failed to update school: ' + msg);
    }
  });

  const deleteSchoolMutation = useMutation({
    mutationFn: async (id) => {
      const response = await base44.functions.invoke('adminManageSchool', { action: 'delete', schoolId: id });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allSchools'] });
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      queryClient.invalidateQueries({ queryKey: ['allStudents'] });
      queryClient.invalidateQueries({ queryKey: ['allTeachers'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      toast.success('School and all its data deleted');
    },
    onError: (error) => toast.error('Failed to delete school: ' + (error.message || 'Unknown error'))
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => base44.functions.invoke('adminManageUser', { action: 'update', userId: id, data }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      setIsUserDialogOpen(false);
      setUserFormData({ email: '', school_id: '', role: 'user' });
      if (response.data?.requiresReauth) {
        toast.success('User updated — they must log out and back in to access their school dashboard');
      } else {
        toast.success('User updated');
      }
    },
    onError: (error) => {
      const msg = error?.response?.data?.error || error?.data?.error || error.message;
      toast.error('Failed to update user: ' + msg);
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('adminManageUser', { action: 'delete', userId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      toast.success('User deleted');
    },
    onError: (error) => toast.error('Failed to delete user: ' + (error.message || 'Unknown error'))
  });

  const broadcastMutation = useMutation({
    mutationFn: (form) => base44.functions.invoke('adminBroadcastEmail', form),
    onSuccess: (response) => {
      const { sent, total } = response.data || {};
      toast.success(`Sent to ${sent} of ${total} admin email${total !== 1 ? 's' : ''}`);
      setIsBroadcastOpen(false);
      setBroadcastForm({ subject: '', message: '', target_status: 'active' });
    },
    onError: (error) => toast.error('Broadcast failed: ' + (error.message || 'Unknown error'))
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const resetSchoolForm = () => {
    setSchoolFormData({ name: '', code: '', ib_school_code: '', address: '', timezone: 'UTC', academic_year: '2024-2025', stripe_customer_id: '' });
    setEditingSchool(null);
  };

  const handleEditSchool = (school) => {
    setEditingSchool(school);
    setSchoolFormData({
      name: school.name || '', code: school.code || '', ib_school_code: school.ib_school_code || '',
      address: school.address || '', timezone: school.timezone || 'UTC',
      academic_year: school.academic_year || '2024-2025', stripe_customer_id: school.stripe_customer_id || ''
    });
    setIsSchoolDialogOpen(true);
  };

  const handleSchoolSubmit = (e) => {
    e.preventDefault();
    if (editingSchool) {
      updateSchoolMutation.mutate({ id: editingSchool.id, data: schoolFormData });
    } else {
      createSchoolMutation.mutate(schoolFormData);
    }
  };

  const handleUserAssign = () => {
    const user = allUsers.find(u => u.email === userFormData.email);
    if (user) {
      updateUserMutation.mutate({ id: user.id, data: { school_id: userFormData.school_id, role: userFormData.role } });
    }
  };

  const handleDeleteSchool = (school) => {
    setDeleteConfirm({ type: 'school', item: school });
    setConfirmNameInput('');
  };

  const handleDeleteUser = (user) => {
    setDeleteConfirm({ type: 'user', item: user });
    setConfirmNameInput('');
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm.type === 'school') {
      deleteSchoolMutation.mutate(deleteConfirm.item.id);
    } else {
      deleteUserMutation.mutate(deleteConfirm.item.id);
    }
    setDeleteConfirm(null);
    setConfirmNameInput('');
  };

  const getUserSchoolId = (user) => user?.school_id || user?.data?.school_id || null;
  const getUserRole = (user) => user?.role || user?.data?.role || 'user';

  const getSchoolStats = (schoolId) => ({
    users: allUsers.filter(u => getUserSchoolId(u) === schoolId).length,
    teachers: allTeachers.filter(t => t.school_id === schoolId).length,
    students: allStudents.filter(s => s.school_id === schoolId).length,
    schedules: allSchedules.filter(s => s.school_id === schoolId).length,
  });

  // ─── Revenue calculations (real Stripe prices) ──────────────────────────���─

  const activeSchools = useMemo(() => schools.filter(s => s.subscription_status === 'active'), [schools]);
  const pausedSchools = useMemo(() => schools.filter(s => s.subscription_status === 'paused'), [schools]);

  // monthly_cents from Stripe, divided by 100 to get the display amount
  const tierMonthlyCents = useMemo(() => ({
    tier1: stripePrices?.tier1?.monthly_cents ?? null,
    tier2: stripePrices?.tier2?.monthly_cents ?? null,
    tier3: stripePrices?.tier3?.monthly_cents ?? null,
  }), [stripePrices]);

  // Use first non-null currency found, default to 'eur'
  const currency = useMemo(() => {
    const c = Object.values(stripePrices || {}).find(p => p?.currency)?.currency;
    return c || 'eur';
  }, [stripePrices]);

  const formatMoney = (cents) => {
    if (cents == null) return '—';
    return new Intl.NumberFormat('en', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: 0 }).format(cents / 100);
  };

  const mrr = useMemo(() => {
    if (!stripePrices) return null;
    return activeSchools.reduce((acc, s) => acc + (tierMonthlyCents[s.subscription_tier] ?? 0), 0);
  }, [activeSchools, tierMonthlyCents, stripePrices]);

  // ─── Filtered data ────────────────────────────────────────────────────────

  const filteredSchools = useMemo(() => {
    if (!schoolSearch) return schools;
    const q = schoolSearch.toLowerCase();
    return schools.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.code?.toLowerCase().includes(q) ||
      s.ib_school_code?.toLowerCase().includes(q)
    );
  }, [schools, schoolSearch]);

  const filteredUsers = useMemo(() => {
    if (!userSearch) return allUsers;
    const q = userSearch.toLowerCase();
    return allUsers.filter(u =>
      u.email?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q)
    );
  }, [allUsers, userSearch]);

  const sortedAuditLogs = useMemo(() =>
    [...auditLogs].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 200),
    [auditLogs]
  );

  // ─── Table columns ────────────────────────────────────────────────────────

  const schoolColumns = [
    {
      header: 'School',
      cell: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900">{row.name}</p>
            {row.subscription_status === 'active'
              ? <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Active</Badge>
              : <Badge variant="outline" className="text-slate-600 text-xs">{row.subscription_status || 'Inactive'}</Badge>
            }
          </div>
          <p className="text-sm text-slate-500">{row.code}</p>
        </div>
      )
    },
    { header: 'IB Code', cell: (row) => row.ib_school_code || '-' },
    { header: 'Tier', cell: (row) => <Badge variant="outline">{row.subscription_tier || '-'}</Badge> },
    {
      header: 'Users',
      cell: (row) => <Badge variant="outline">{getSchoolStats(row.id).users} users</Badge>
    },
    {
      header: 'Teachers',
      cell: (row) => <span className="text-slate-600">{getSchoolStats(row.id).teachers}</span>
    },
    {
      header: 'Students',
      cell: (row) => <span className="text-slate-600">{getSchoolStats(row.id).students}</span>
    },
    {
      header: '',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setDrilldown(row)} title="View details">
            <Eye className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEditSchool(row)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSeatsTargetSchool(row); setSeatsToAdd(1); setIsSeatsDialogOpen(true); }}>
                <Users className="w-4 h-4 mr-2" />
                Add Admin Slots
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const activating = row.subscription_status !== 'active';
                  const newStatus = activating ? 'active' : 'paused';
                  const now = new Date();
                  const nextYear = new Date(now);
                  nextYear.setFullYear(now.getFullYear() + 1);
                  const updates = { subscription_status: newStatus };
                  if (activating) {
                    updates.subscription_tier = row.subscription_tier || 'tier2';
                    updates.subscription_start_date = row.subscription_start_date || now.toISOString();
                    updates.subscription_current_period_end = nextYear.toISOString();
                  }
                  updateSchoolMutation.mutate({ id: row.id, data: updates });
                }}
              >
                {row.subscription_status === 'active' ? '⏸️ Pause Subscription' : '✓ Activate Subscription'}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-rose-600" onClick={() => handleDeleteSchool(row)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete School
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    }
  ];

  const userColumns = [
    {
      header: 'User',
      cell: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.full_name}</p>
          <p className="text-sm text-slate-500">{row.email}</p>
        </div>
      )
    },
    {
      header: 'School',
      cell: (row) => {
        const school = schools.find(s => s.id === getUserSchoolId(row));
        return school ? school.name : <Badge variant="outline">Unassigned</Badge>;
      }
    },
    {
      header: 'Role',
      cell: (row) => (
        <Badge className={getUserRole(row) === 'admin' ? 'bg-blue-100 text-blue-900 border-0' : 'bg-slate-100 text-slate-600 border-0'}>
          {getUserRole(row) === 'admin' ? <Crown className="w-3 h-3 mr-1" /> : null}
          {getUserRole(row)}
        </Badge>
      )
    },
    {
      header: '',
      cell: (row) => (
        <div className="flex gap-2">
          {!getUserSchoolId(row) && (
            <Button
              variant="default" size="sm"
              className="bg-blue-900 hover:bg-blue-800"
              onClick={() => {
                setNewSchoolFormData({ ...newSchoolFormData, user_email: row.email });
                setIsCreateSchoolForUserOpen(true);
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              Create School
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setUserFormData({ email: row.email, school_id: getUserSchoolId(row) || '', role: getUserRole(row) });
                  setIsUserDialogOpen(true);
                }}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Assign to School
              </DropdownMenuItem>
              <DropdownMenuItem className="text-rose-600" onClick={() => handleDeleteUser(row)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    }
  ];

  const subscriptionColumns = [
    {
      header: 'School',
      cell: (row) => <div><p className="font-medium">{row.name}</p><p className="text-xs text-slate-500">{row.code}</p></div>
    },
    {
      header: 'Status',
      cell: (row) => {
        const colors = {
          active: 'bg-emerald-100 text-emerald-700',
          paused: 'bg-amber-100 text-amber-700',
          canceled: 'bg-rose-100 text-rose-700',
        };
        return (
          <Badge className={`border-0 ${colors[row.subscription_status] || 'bg-slate-100 text-slate-600'}`}>
            {row.subscription_status || 'incomplete'}
          </Badge>
        );
      }
    },
    {
      header: 'Tier',
      cell: (row) => <Badge variant="outline">{row.subscription_tier || '-'}</Badge>
    },
    {
      header: 'MRR',
      cell: (row) => {
        if (row.subscription_status !== 'active') return <span className="text-slate-400">—</span>;
        const cents = tierMonthlyCents[row.subscription_tier];
        return <span className="font-medium text-emerald-700">{cents != null ? formatMoney(cents) : '—'}</span>;
      }
    },
    {
      header: 'Renewal',
      cell: (row) => row.subscription_current_period_end
        ? new Date(row.subscription_current_period_end).toLocaleDateString()
        : '-'
    }
  ];

  const ACTION_COLORS = {
    create_school: 'bg-emerald-100 text-emerald-700',
    update_school: 'bg-blue-100 text-blue-700',
    delete_school: 'bg-rose-100 text-rose-700',
    assign_user: 'bg-indigo-100 text-indigo-700',
    delete_user: 'bg-rose-100 text-rose-700',
    create_schedule: 'bg-emerald-100 text-emerald-700',
    delete_schedule: 'bg-rose-100 text-rose-700',
    run_optimization: 'bg-violet-100 text-violet-700',
  };

  const auditColumns = [
    {
      header: 'Date',
      cell: (row) => <span className="text-sm text-slate-500">{row.created_date ? new Date(row.created_date).toLocaleString() : '-'}</span>
    },
    {
      header: 'Actor',
      cell: (row) => <span className="text-sm font-medium">{row.user_email || '-'}</span>
    },
    {
      header: 'Action',
      cell: (row) => (
        <Badge className={`border-0 text-xs ${ACTION_COLORS[row.action] || 'bg-slate-100 text-slate-600'}`}>
          {row.action}
        </Badge>
      )
    },
    {
      header: 'Entity',
      cell: (row) => (
        <span className="text-sm text-slate-600">
          {row.entity_type}{row.entity_id ? ` · ${row.entity_id.slice(0, 8)}…` : ''}
        </span>
      )
    },
    {
      header: 'Details',
      cell: (row) => row.metadata
        ? <span className="text-xs text-slate-400 truncate max-w-xs block">{JSON.stringify(row.metadata)}</span>
        : null
    }
  ];

  const totalUsers = allUsers.filter(u => getUserSchoolId(u)).length;
  const totalTeachers = allTeachers.length;
  const totalStudents = allStudents.length;

  const confirmTarget = deleteConfirm?.type === 'school' ? deleteConfirm?.item?.name : deleteConfirm?.item?.email;

  // How many admin emails will receive the broadcast
  const broadcastRecipientCount = useMemo(() => {
    const targetSchoolIds = new Set(
      schools
        .filter(s => broadcastForm.target_status === 'all' || s.subscription_status === broadcastForm.target_status)
        .map(s => s.id)
    );
    const adminEmails = new Set(
      allUsers
        .filter(u => {
          const sid = getUserSchoolId(u);
          return sid && targetSchoolIds.has(sid) && getUserRole(u) === 'admin' && u.email;
        })
        .map(u => u.email)
    );
    return adminEmails.size;
  }, [schools, allUsers, broadcastForm.target_status]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={<div className="flex items-center gap-2"><Crown className="w-6 h-6 text-amber-500" /> Admin Panel</div>}
        description="Manage all schools, users, and platform-wide settings"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsBroadcastOpen(true)}>
              <Mail className="w-4 h-4 mr-2" />
              Send Announcement
            </Button>
            <Button onClick={() => setIsSchoolDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Add School
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Schools" value={schools.length} icon={Building2} />
        <StatCard title="Active Schools" value={activeSchools.length} icon={Activity} />
        <StatCard
          title="MRR"
          value={loadingPrices ? '…' : mrr != null ? formatMoney(mrr * 100) : '—'}
          icon={TrendingUp}
        />
        <StatCard title="Unassigned Users" value={allUsers.filter(u => !getUserSchoolId(u)).length} icon={Users} />
      </div>

      <Card className="border-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xl">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-blue-50">
                <Crown className="w-3.5 h-3.5" />
                Super Admin Workspace
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight">Platform control center</h2>
              <p className="mt-2 max-w-2xl text-sm text-blue-50/90">
                Manage schools, users, analytics, automation and platform operations from one modern dashboard.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="text-xs text-blue-100">Schools</div>
                <div className="mt-1 text-2xl font-semibold">{schools.length}</div>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="text-xs text-blue-100">Users</div>
                <div className="mt-1 text-2xl font-semibold">{totalUsers}</div>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="text-xs text-blue-100">Teachers</div>
                <div className="mt-1 text-2xl font-semibold">{totalTeachers}</div>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="text-xs text-blue-100">Students</div>
                <div className="mt-1 text-2xl font-semibold">{totalStudents}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => navigate(`?tab=${value}`)} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-3 rounded-3xl bg-transparent p-0 lg:grid-cols-4">
          <TabsTrigger value="schools" className="group rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-slate-100 p-2 text-slate-600 group-data-[state=active]:bg-blue-100 group-data-[state=active]:text-blue-700"><Building2 className="w-4 h-4" /></div>
              <div><div className="font-semibold">Schools</div><div className="text-xs text-slate-500">Manage clients</div></div>
            </div>
          </TabsTrigger>
          <TabsTrigger value="users" className="group rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-slate-100 p-2 text-slate-600 group-data-[state=active]:bg-blue-100 group-data-[state=active]:text-blue-700"><Users className="w-4 h-4" /></div>
              <div><div className="font-semibold">Users</div><div className="text-xs text-slate-500">Assignments & roles</div></div>
            </div>
          </TabsTrigger>
          <TabsTrigger value="revenue" className="group rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-slate-100 p-2 text-slate-600 group-data-[state=active]:bg-blue-100 group-data-[state=active]:text-blue-700"><TrendingUp className="w-4 h-4" /></div>
              <div><div className="font-semibold">Revenue</div><div className="text-xs text-slate-500">MRR & tiers</div></div>
            </div>
          </TabsTrigger>
          <TabsTrigger value="auditlog" className="group rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-slate-100 p-2 text-slate-600 group-data-[state=active]:bg-blue-100 group-data-[state=active]:text-blue-700"><ShieldCheck className="w-4 h-4" /></div>
              <div><div className="font-semibold">Audit Log</div><div className="text-xs text-slate-500">Action history</div></div>
            </div>
          </TabsTrigger>
        </TabsList>

        {/* ── Schools ───────────────────────────────────────────────────── */}
        <TabsContent value="schools">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search schools by name or code…"
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
              />
            </div>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <DataTable columns={schoolColumns} data={filteredSchools} isLoading={loadingSchools} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Users ─────────────────────────────────────────────────────── */}
        <TabsContent value="users">
          <div className="space-y-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <h4 className="font-semibold text-blue-900 mb-2">📋 Workflow for new clients:</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>User signs up / logs in to the platform</li>
                  <li>Find them below and click "Create School"</li>
                  <li>Fill in school details — they're auto-assigned as admin</li>
                </ol>
              </CardContent>
            </Card>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search users by name or email…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <DataTable columns={userColumns} data={filteredUsers} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Revenue ───────────────────────────────────────────────────── */}
        <TabsContent value="revenue">
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Active Schools" value={activeSchools.length} icon={Building2} />
              <StatCard
                title="MRR"
                value={loadingPrices ? '…' : mrr != null ? formatMoney(mrr * 100) : '—'}
                icon={TrendingUp}
              />
              <StatCard title="Paused Schools" value={pausedSchools.length} icon={Activity} />
              <StatCard
                title="Avg / School"
                value={loadingPrices ? '…' : (mrr != null && activeSchools.length > 0) ? formatMoney((mrr / activeSchools.length) * 100) : '—'}
                icon={BarChart3}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader><CardTitle>Tier Breakdown</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {['tier1', 'tier2', 'tier3'].map(tier => {
                    const count = activeSchools.filter(s => s.subscription_tier === tier).length;
                    const monthlyCents = tierMonthlyCents[tier];
                    const revenueCents = count * (monthlyCents ?? 0);
                    const pct = activeSchools.length > 0 ? Math.round((count / activeSchools.length) * 100) : 0;
                    const labels = { tier1: 'Starter', tier2: 'Growth', tier3: 'Scale' };
                    const priceLabel = loadingPrices ? '…' : monthlyCents != null ? formatMoney(monthlyCents) + '/mo' : '—';
                    return (
                      <div key={tier}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">
                            {labels[tier]} <span className="text-slate-400 font-normal">({tier} · {priceLabel})</span>
                          </span>
                          <span className="text-slate-500">
                            {count} school{count !== 1 ? 's' : ''} ·{' '}
                            <span className="font-medium text-slate-700">
                              {loadingPrices ? '…' : formatMoney(revenueCents)}/mo
                            </span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader><CardTitle>Subscription Status</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { status: 'active', label: 'Active', color: 'bg-emerald-500' },
                    { status: 'paused', label: 'Paused', color: 'bg-amber-500' },
                    { status: 'canceled', label: 'Canceled', color: 'bg-rose-500' },
                    { status: 'incomplete', label: 'Incomplete / Trial', color: 'bg-slate-400' },
                  ].map(({ status, label, color }) => {
                    const count = schools.filter(s => (s.subscription_status || 'incomplete') === status).length;
                    const pct = schools.length > 0 ? Math.round((count / schools.length) * 100) : 0;
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{label}</span>
                          <span className="text-slate-500">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle>All Subscriptions</CardTitle></CardHeader>
              <CardContent className="p-0">
                <DataTable columns={subscriptionColumns} data={schools} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Audit Log ─────────────────────────────────────────────────── */}
        <TabsContent value="auditlog">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Action History</CardTitle>
                <span className="text-sm text-slate-400">Last {sortedAuditLogs.length} entries</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable columns={auditColumns} data={sortedAuditLogs} isLoading={loadingAudit} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Delete Confirmation Dialog ──────────────────────────────────────── */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) { setDeleteConfirm(null); setConfirmNameInput(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              {deleteConfirm?.type === 'school' ? 'Delete School' : 'Delete User'}
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                {deleteConfirm?.type === 'school'
                  ? 'This will permanently delete the school and all its data — students, teachers, subjects, rooms, and schedules. Users will be unassigned but their accounts are kept.'
                  : 'This will permanently delete the user account.'
                }
              </span>
              <span className="block">
                Type <strong className="text-slate-900">{confirmTarget}</strong> to confirm.
              </span>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmNameInput}
            onChange={(e) => setConfirmNameInput(e.target.value)}
            placeholder={confirmTarget}
            className="border-rose-200 focus-visible:ring-rose-400"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteConfirm(null); setConfirmNameInput(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmNameInput !== confirmTarget || deleteSchoolMutation.isPending || deleteUserMutation.isPending}
              onClick={handleConfirmDelete}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── School Drill-down Dialog ────────────────────────────────────────── */}
      <Dialog open={!!drilldown} onOpenChange={(open) => { if (!open) setDrilldown(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              {drilldown?.name}
              {drilldown?.subscription_status === 'active'
                ? <Badge className="bg-emerald-100 text-emerald-700 border-0">Active</Badge>
                : <Badge variant="outline">{drilldown?.subscription_status || 'Inactive'}</Badge>
              }
            </DialogTitle>
          </DialogHeader>
          {drilldown && (() => {
            const stats = getSchoolStats(drilldown.id);
            const admins = allUsers.filter(u => getUserSchoolId(u) === drilldown.id);
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  {[
                    { label: 'School Code', value: drilldown.code || '-' },
                    { label: 'IB Code', value: drilldown.ib_school_code || '-' },
                    { label: 'Timezone', value: drilldown.timezone || '-' },
                    { label: 'Academic Year', value: drilldown.academic_year || '-' },
                    { label: 'Tier', value: drilldown.subscription_tier || '-' },
                    { label: 'Renewal', value: drilldown.subscription_current_period_end ? new Date(drilldown.subscription_current_period_end).toLocaleDateString() : '-' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">{label}</p>
                      <p className="font-medium text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Admins', value: stats.users },
                    { label: 'Teachers', value: stats.teachers },
                    { label: 'Students', value: stats.students },
                    { label: 'Schedules', value: stats.schedules },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-indigo-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-indigo-700">{value}</p>
                      <p className="text-xs text-indigo-500 mt-1">{label}</p>
                    </div>
                  ))}
                </div>

                {admins.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-2">Admin Users</p>
                    <div className="space-y-2">
                      {admins.map(u => (
                        <div key={u.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                          <Badge className={getUserRole(u) === 'admin' ? 'bg-blue-100 text-blue-900 border-0 text-xs' : 'bg-slate-100 text-slate-600 border-0 text-xs'}>
                            {getUserRole(u)}
                          </Badge>
                          <span className="font-medium text-sm">{u.full_name}</span>
                          <span className="text-slate-400 text-sm">·</span>
                          <span className="text-slate-500 text-sm">{u.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Edit / Create School Dialog ─────────────────────────────────────── */}
      <Dialog open={isSchoolDialogOpen} onOpenChange={(open) => { if (!open) resetSchoolForm(); setIsSchoolDialogOpen(open); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSchool ? 'Edit School' : 'Create New School'}</DialogTitle>
            <DialogDescription>
              {editingSchool ? 'Update school information.' : 'Add a new client school to the platform.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSchoolSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">School Name *</Label>
                <Input id="name" value={schoolFormData.name} onChange={(e) => setSchoolFormData({ ...schoolFormData, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">School Code *</Label>
                <Input id="code" value={schoolFormData.code} onChange={(e) => setSchoolFormData({ ...schoolFormData, code: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ib_school_code">IB School Code</Label>
              <Input id="ib_school_code" value={schoolFormData.ib_school_code} onChange={(e) => setSchoolFormData({ ...schoolFormData, ib_school_code: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={schoolFormData.address} onChange={(e) => setSchoolFormData({ ...schoolFormData, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={schoolFormData.timezone} onValueChange={(v) => setSchoolFormData({ ...schoolFormData, timezone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['UTC', 'America/New_York', 'Europe/London', 'Europe/Paris', 'Asia/Dubai'].map(tz => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Academic Year</Label>
                <Select value={schoolFormData.academic_year} onValueChange={(v) => setSchoolFormData({ ...schoolFormData, academic_year: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024-2025">2024-2025</SelectItem>
                    <SelectItem value="2025-2026">2025-2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { resetSchoolForm(); setIsSchoolDialogOpen(false); }}>Cancel</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                {editingSchool ? 'Save Changes' : 'Create School'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Assign User Dialog ──────────────────────────────────────────────── */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign User to School</DialogTitle>
            <DialogDescription>Update user's school assignment and role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>User Email *</Label>
              <Input type="email" value={userFormData.email} onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>School *</Label>
              <Select value={userFormData.school_id} onValueChange={(v) => setUserFormData({ ...userFormData, school_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select school…" /></SelectTrigger>
                <SelectContent>
                  {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={userFormData.role} onValueChange={(v) => setUserFormData({ ...userFormData, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUserAssign} className="bg-indigo-600 hover:bg-indigo-700">Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create School for User Dialog ───────────────────────────────────── */}
      <Dialog open={isCreateSchoolForUserOpen} onOpenChange={setIsCreateSchoolForUserOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create School for User</DialogTitle>
            <DialogDescription>Create a new school and assign {newSchoolFormData.user_email} as the admin</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createSchoolForUserMutation.mutate(newSchoolFormData); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>School Name *</Label>
                <Input value={newSchoolFormData.name} onChange={(e) => setNewSchoolFormData({ ...newSchoolFormData, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>School Code *</Label>
                <Input value={newSchoolFormData.code} onChange={(e) => setNewSchoolFormData({ ...newSchoolFormData, code: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>IB School Code</Label>
              <Input value={newSchoolFormData.ib_school_code} onChange={(e) => setNewSchoolFormData({ ...newSchoolFormData, ib_school_code: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={newSchoolFormData.address} onChange={(e) => setNewSchoolFormData({ ...newSchoolFormData, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={newSchoolFormData.timezone} onValueChange={(v) => setNewSchoolFormData({ ...newSchoolFormData, timezone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['UTC', 'America/New_York', 'Europe/London', 'Europe/Paris', 'Asia/Dubai'].map(tz => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Academic Year</Label>
                <Select value={newSchoolFormData.academic_year} onValueChange={(v) => setNewSchoolFormData({ ...newSchoolFormData, academic_year: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024-2025">2024-2025</SelectItem>
                    <SelectItem value="2025-2026">2025-2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateSchoolForUserOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={createSchoolForUserMutation.isPending}>
                Create School & Assign User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Broadcast Email Dialog ─────────────────────────────────────────── */}
      <Dialog open={isBroadcastOpen} onOpenChange={(open) => { if (!open) setIsBroadcastOpen(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-indigo-600" />
              Send Announcement to Clients
            </DialogTitle>
            <DialogDescription>
              Sends a branded email to all admin users of the selected schools.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Audience</Label>
              <Select
                value={broadcastForm.target_status}
                onValueChange={(v) => setBroadcastForm({ ...broadcastForm, target_status: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active subscribers only</SelectItem>
                  <SelectItem value="all">All schools (active + paused)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                {broadcastRecipientCount} admin email{broadcastRecipientCount !== 1 ? 's' : ''} will receive this message
              </p>
            </div>
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                value={broadcastForm.subject}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, subject: e.target.value })}
                placeholder="e.g. New feature: Advanced constraints"
              />
            </div>
            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                value={broadcastForm.message}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                placeholder="Write your announcement here…"
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBroadcastOpen(false)}>Cancel</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={!broadcastForm.subject || !broadcastForm.message || broadcastRecipientCount === 0 || broadcastMutation.isPending}
              onClick={() => broadcastMutation.mutate(broadcastForm)}
            >
              {broadcastMutation.isPending ? 'Sending…' : `Send to ${broadcastRecipientCount} recipient${broadcastRecipientCount !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Admin Slots Dialog ──────────────────────────────────────────── */}
      <Dialog open={isSeatsDialogOpen} onOpenChange={setIsSeatsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Admin Slots</DialogTitle>
            <DialogDescription>Increase the admin seat limit for {seatsTargetSchool?.name || 'this school'}.</DialogDescription>
          </DialogHeader>
          {seatsTargetSchool && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div><p className="text-xs text-slate-500">Current limit</p><p className="text-lg font-semibold">{seatsTargetSchool.max_admin_seats ?? 0}</p></div>
                <div><p className="text-xs text-slate-500">Admins used</p><p className="text-lg font-semibold">{allUsers.filter(u => getUserSchoolId(u) === seatsTargetSchool.id && getUserRole(u) === 'admin').length}</p></div>
                <div><p className="text-xs text-slate-500">New total</p><p className="text-lg font-semibold">{(seatsTargetSchool.max_admin_seats ?? 0) + (Number(seatsToAdd) || 0)}</p></div>
              </div>
              <div className="space-y-2">
                <Label>Add slots</Label>
                <Input type="number" min={1} value={seatsToAdd} onChange={(e) => setSeatsToAdd(Number(e.target.value) || 1)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSeatsDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const current = seatsTargetSchool?.max_admin_seats ?? 0;
                updateSchoolMutation.mutate({ id: seatsTargetSchool.id, data: { max_admin_seats: current + (Number(seatsToAdd) || 0) } });
                setIsSeatsDialogOpen(false);
                setSeatsTargetSchool(null);
                setSeatsToAdd(1);
              }}
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={!seatsTargetSchool || (Number(seatsToAdd) || 0) < 1}
            >
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
