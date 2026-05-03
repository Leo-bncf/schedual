import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, Plus, Pencil, Trash2, Crown, MoreHorizontal, BarChart3, ShieldCheck, Search, TrendingUp, Activity, Eye, AlertTriangle, Mail, Send, Cpu, RefreshCw, CheckCircle2, XCircle, Clock, Terminal, Wifi, WifiOff, HardDrive, Server } from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import StatCard from '../components/ui-custom/StatCard';
import DataTable from '../components/ui-custom/DataTable';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatMoney = (cents, currency = 'eur') => {
  if (cents == null) return '—';
  return Intl.NumberFormat('en', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(cents / 100);
};

const getUserSchoolId = (u) => u?.school_id ?? u?.schoolId ?? null;
const getUserRole = (u) => u?.role ?? u?.user_role ?? null;

const TIER_COLORS = {
  tier1: 'bg-slate-100 text-slate-700',
  tier2: 'bg-blue-100 text-blue-700',
  tier3: 'bg-purple-100 text-purple-700',
};

const STATUS_COLORS = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  trial: 'bg-sky-100 text-sky-700',
  cancelled: 'bg-red-100 text-red-700',
};

const ACTION_TERMINAL_COLORS = {
  create_school: 'text-emerald-400',
  update_school: 'text-blue-400',
  delete_school: 'text-rose-400',
  assign_user: 'text-indigo-400',
  delete_user: 'text-rose-400',
  default: 'text-slate-400',
};

function getActionColor(action) {
  const key = action?.toLowerCase?.() ?? '';
  return ACTION_TERMINAL_COLORS[key] ?? ACTION_TERMINAL_COLORS.default;
}

function formatLogTimestamp(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-CA', { hour12: false }).replace(',', '');
  } catch {
    return ts;
  }
}

function formatTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString('en-GB');
  } catch {
    return '';
  }
}

function shortId(id) {
  if (!id) return '—';
  return String(id).slice(0, 8);
}

// ---------------------------------------------------------------------------
// Panel component
// ---------------------------------------------------------------------------

export default function Panel() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Active tab
  const [activeTab, setActiveTab] = useState('schools');

  // Search
  const [schoolSearch, setSchoolSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // School dialog
  const [isSchoolDialogOpen, setIsSchoolDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [schoolFormData, setSchoolFormData] = useState({
    name: '',
    ib_code: '',
    subscription_tier: 'tier1',
    subscription_status: 'active',
    contact_email: '',
    country: '',
    max_admin_seats: 1,
  });

  // User assign dialog
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [userFormData, setUserFormData] = useState({ school_id: '' });
  const [assigningUser, setAssigningUser] = useState(null);

  // Create school for user
  const [isCreateSchoolForUserOpen, setIsCreateSchoolForUserOpen] = useState(false);
  const [newSchoolFormData, setNewSchoolFormData] = useState({
    name: '',
    ib_code: '',
    subscription_tier: 'tier1',
    contact_email: '',
    country: '',
  });
  const [targetUser, setTargetUser] = useState(null);

  // Add admin slots
  const [isSeatsDialogOpen, setIsSeatsDialogOpen] = useState(false);
  const [seatsTargetSchool, setSeatsTargetSchool] = useState(null);
  const [seatsToAdd, setSeatsToAdd] = useState(1);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'school'|'user', item }
  const [confirmNameInput, setConfirmNameInput] = useState('');

  // School drilldown
  const [drilldown, setDrilldown] = useState(null);

  // Email form (replaces broadcast dialog)
  const [emailForm, setEmailForm] = useState({
    subject: '',
    message: '',
    target_status: 'active',
  });

  // Logs terminal ref for auto-scroll
  const logsEndRef = useRef(null);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const { data: schoolsData, isLoading: loadingSchools } = useQuery({
    queryKey: ['adminSchools'],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('adminManageSchool', { action: 'list' });
      return data?.schools ?? [];
    },
    staleTime: 30_000,
  });
  const schools = schoolsData ?? [];

  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('adminManageUser', { action: 'list' });
      return data?.users ?? [];
    },
    staleTime: 30_000,
  });
  const allUsers = usersData ?? [];

  const { data: stripePrices } = useQuery({
    queryKey: ['adminStripePrices'],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('adminGetStripePrices');
      return data?.prices ?? null;
    },
    staleTime: 5 * 60_000,
  });

  const { data: teachersData } = useQuery({
    queryKey: ['adminTeachers'],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('adminGetAllData', { entityType: 'Teacher' });
      return data?.records ?? [];
    },
    staleTime: 60_000,
  });
  const allTeachers = teachersData ?? [];

  const { data: studentsData } = useQuery({
    queryKey: ['adminStudents'],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('adminGetAllData', { entityType: 'Student' });
      return data?.records ?? [];
    },
    staleTime: 60_000,
  });
  const allStudents = studentsData ?? [];

  const {
    data: optaStatus,
    isLoading: loadingOpta,
    isError: optaIsError,
    error: optaErr,
    refetch: refetchOpta,
    dataUpdatedAt: optaUpdatedAt,
  } = useQuery({
    queryKey: ['optaPlannerStatus'],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('adminOptaPlannerStatus');
      if (!data || data.error) throw new Error(data?.error || 'Failed to connect to OptaPlanner service');
      return data;
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
    retry: 1,
  });

  const {
    data: auditLogs = [],
    isLoading: loadingAudit,
    dataUpdatedAt: logsUpdatedAt,
  } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: async () => {
      try {
        const { data } = await base44.functions.invoke('adminGetAllData', { entityType: 'AuditLog' });
        return data?.records ?? [];
      } catch {
        return [];
      }
    },
    refetchInterval: 10_000,
  });

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const activeSchools = useMemo(() => schools.filter(s => s.subscription_status === 'active'), [schools]);
  const pausedSchools = useMemo(() => schools.filter(s => s.subscription_status === 'paused'), [schools]);

  const tierMonthlyCents = useMemo(() => {
    if (!stripePrices) return {};
    return {
      tier1: stripePrices.tier1?.monthly_cents ?? 0,
      tier2: stripePrices.tier2?.monthly_cents ?? 0,
      tier3: stripePrices.tier3?.monthly_cents ?? 0,
    };
  }, [stripePrices]);

  const currency = stripePrices?.tier1?.currency ?? 'eur';

  // mrr is in CENTS — formatMoney(mrr) divides by 100 internally. Do NOT multiply by 100.
  const mrr = useMemo(() => {
    if (!stripePrices) return null;
    return activeSchools.reduce((acc, s) => acc + (tierMonthlyCents[s.subscription_tier] ?? 0), 0);
  }, [activeSchools, tierMonthlyCents, stripePrices]);

  const getSchoolStats = (schoolId) => ({
    teachers: allTeachers.filter(t => t.school_id === schoolId).length,
    students: allStudents.filter(s => s.school_id === schoolId).length,
    users: allUsers.filter(u => getUserSchoolId(u) === schoolId).length,
  });

  const filteredSchools = useMemo(() => {
    const q = schoolSearch.toLowerCase();
    return schools.filter(s =>
      !q ||
      s.name?.toLowerCase().includes(q) ||
      s.ib_code?.toLowerCase().includes(q)
    );
  }, [schools, schoolSearch]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    return allUsers.filter(u =>
      !q ||
      u.email?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q)
    );
  }, [allUsers, userSearch]);

  const unassignedUsers = useMemo(() => allUsers.filter(u => !getUserSchoolId(u)), [allUsers]);

  // Broadcast recipient count — filter by school_id presence, not role (roles may be stale in DB)
  const recipientSchoolIds = useMemo(() => {
    return new Set(
      schools
        .filter(s =>
          emailForm.target_status === 'all'
            ? ['active', 'paused'].includes(s.subscription_status)
            : s.subscription_status === emailForm.target_status
        )
        .map(s => s.id)
    );
  }, [schools, emailForm.target_status]);

  const broadcastRecipientCount = useMemo(() => {
    const emails = new Set(
      allUsers
        .filter(u => {
          const sid = getUserSchoolId(u);
          return sid && recipientSchoolIds.has(sid) && u.email;
        })
        .map(u => u.email)
    );
    return emails.size;
  }, [allUsers, recipientSchoolIds]);

  const recipientSchoolCount = recipientSchoolIds.size;

  // Tier breakdown for revenue tab
  const tierBreakdown = useMemo(() => {
    const counts = { tier1: 0, tier2: 0, tier3: 0 };
    activeSchools.forEach(s => {
      if (counts[s.subscription_tier] !== undefined) counts[s.subscription_tier]++;
    });
    return counts;
  }, [activeSchools]);

  // OptaPlanner derived — operator-precedence-safe constraint extraction
  const solverInfo = useMemo(() => {
    const info = optaStatus?.solver_info?.data;
    if (!info) return { hard: [], soft: [], constraints: [] };
    const hard = info.hardConstraints ?? (Array.isArray(info.constraints) ? info.constraints.filter(c => c.type === 'HARD') : []);
    const soft = info.softConstraints ?? (Array.isArray(info.constraints) ? info.constraints.filter(c => c.type === 'SOFT') : []);
    const constraints = [
      ...hard.map(c => ({ ...c, type: 'HARD' })),
      ...soft.map(c => ({ ...c, type: 'SOFT' })),
    ];
    return { hard, soft, constraints };
  }, [optaStatus]);

  const solveHistory = useMemo(() => optaStatus?.solve_history ?? [], [optaStatus]);

  // Sorted audit logs newest-first
  const sortedLogs = useMemo(() => {
    return [...auditLogs].sort((a, b) => {
      const ta = new Date(a.created_at ?? a.timestamp ?? 0).getTime();
      const tb = new Date(b.created_at ?? b.timestamp ?? 0).getTime();
      return tb - ta;
    });
  }, [auditLogs]);

  // Auto-scroll logs terminal to bottom when new entries arrive
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sortedLogs.length]);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const schoolMutation = useMutation({
    mutationFn: async ({ action, payload }) => {
      const { data } = await base44.functions.invoke('adminManageSchool', { action, ...payload });
      return data;
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
      const label = action === 'create' ? 'created' : action === 'update' ? 'updated' : 'deleted';
      toast.success(`School ${label} successfully`);
      setIsSchoolDialogOpen(false);
      resetSchoolForm();
    },
    onError: (err) => toast.error(err.message ?? 'School operation failed'),
  });

  const userMutation = useMutation({
    mutationFn: async ({ action, payload }) => {
      const { data } = await base44.functions.invoke('adminManageUser', { action, ...payload });
      return data;
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success(`User ${action === 'delete' ? 'deleted' : 'updated'} successfully`);
      setIsUserDialogOpen(false);
    },
    onError: (err) => toast.error(err.message ?? 'User operation failed'),
  });

  const broadcastMutation = useMutation({
    mutationFn: async (form) => {
      const { data } = await base44.functions.invoke('adminBroadcastEmail', {
        subject: form.subject,
        message: form.message,
        target_status: form.target_status,
      });
      return data;
    },
    onSuccess: (data) => {
      const { sent, total } = data || {};
      toast.success(`Broadcast sent! ${sent ?? '?'} of ${total ?? '?'} emails delivered.`);
      setEmailForm({ subject: '', message: '', target_status: 'active' });
    },
    onError: (err) => toast.error(err.message ?? 'Broadcast failed'),
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const resetSchoolForm = () => {
    setSchoolFormData({
      name: '',
      ib_code: '',
      subscription_tier: 'tier1',
      subscription_status: 'active',
      contact_email: '',
      country: '',
      max_admin_seats: 1,
    });
    setEditingSchool(null);
  };

  const handleEditSchool = (school) => {
    setEditingSchool(school);
    setSchoolFormData({
      name: school.name ?? '',
      ib_code: school.ib_code ?? '',
      subscription_tier: school.subscription_tier ?? 'tier1',
      subscription_status: school.subscription_status ?? 'active',
      contact_email: school.contact_email ?? '',
      country: school.country ?? '',
      max_admin_seats: school.max_admin_seats ?? 1,
    });
    setIsSchoolDialogOpen(true);
  };

  const handleSchoolSubmit = () => {
    if (!schoolFormData.name.trim()) {
      toast.error('School name is required');
      return;
    }
    if (editingSchool) {
      schoolMutation.mutate({ action: 'update', payload: { id: editingSchool.id, data: schoolFormData } });
    } else {
      schoolMutation.mutate({ action: 'create', payload: { data: schoolFormData } });
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
    if (!deleteConfirm) return;
    const { type, item } = deleteConfirm;
    const expectedName = type === 'school' ? item.name : (item.full_name ?? item.email);
    if (confirmNameInput.trim() !== expectedName) {
      toast.error('Name does not match');
      return;
    }
    if (type === 'school') {
      schoolMutation.mutate({ action: 'delete', payload: { id: item.id } });
    } else {
      userMutation.mutate({ action: 'delete', payload: { userId: item.id } });
    }
    setDeleteConfirm(null);
    setConfirmNameInput('');
  };

  const handleUserAssign = () => {
    if (!assigningUser || !userFormData.school_id) {
      toast.error('Please select a school');
      return;
    }
    userMutation.mutate({
      action: 'update',
      payload: { userId: assigningUser.id, data: { school_id: userFormData.school_id, role: 'admin' } },
    });
    setAssigningUser(null);
    setUserFormData({ school_id: '' });
  };

  const handleCreateSchoolForUser = async () => {
    if (!newSchoolFormData.name.trim()) {
      toast.error('School name is required');
      return;
    }
    try {
      const { data } = await base44.functions.invoke('adminManageSchool', {
        action: 'create',
        ...newSchoolFormData,
      });
      const newSchoolId = data?.school?.id ?? data?.id;
      if (newSchoolId && targetUser) {
        await base44.functions.invoke('adminManageUser', {
          action: 'update',
          userId: targetUser.id,
          data: { school_id: newSchoolId, role: 'admin' },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['adminSchools'] });
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success('School created and user assigned');
      setIsCreateSchoolForUserOpen(false);
      setTargetUser(null);
      setNewSchoolFormData({ name: '', ib_code: '', subscription_tier: 'tier1', contact_email: '', country: '' });
    } catch (err) {
      toast.error(err.message ?? 'Failed to create school');
    }
  };

  const handleAddSeats = () => {
    if (!seatsTargetSchool) return;
    const newSeats = (seatsTargetSchool.max_admin_seats ?? 1) + Number(seatsToAdd);
    schoolMutation.mutate({
      action: 'update',
      payload: {
        id: seatsTargetSchool.id,
        data: { max_admin_seats: newSeats },
      },
    });
    setIsSeatsDialogOpen(false);
    setSeatsTargetSchool(null);
    setSeatsToAdd(1);
  };

  const handleToggleSchoolStatus = (school) => {
    const next = school.subscription_status === 'active' ? 'paused' : 'active';
    schoolMutation.mutate({
      action: 'update',
      payload: { id: school.id, data: { subscription_status: next } },
    });
  };

  // ---------------------------------------------------------------------------
  // Table column definitions
  // ---------------------------------------------------------------------------

  const schoolColumns = [
    {
      header: 'School',
      cell: (s) => (
        <div>
          <p className="font-medium text-slate-900">{s.name}</p>
          <Badge className={`mt-1 text-xs ${STATUS_COLORS[s.subscription_status] ?? 'bg-slate-100 text-slate-600'}`}>
            {s.subscription_status}
          </Badge>
        </div>
      ),
    },
    {
      header: 'IB Code',
      cell: (s) => <span className="font-mono text-sm text-slate-600">{s.ib_code ?? '—'}</span>,
    },
    {
      header: 'Tier',
      cell: (s) => (
        <Badge className={`text-xs ${TIER_COLORS[s.subscription_tier] ?? 'bg-slate-100 text-slate-600'}`}>
          {s.subscription_tier}
        </Badge>
      ),
    },
    {
      header: 'Users',
      cell: (s) => getSchoolStats(s.id).users,
    },
    {
      header: 'Teachers',
      cell: (s) => getSchoolStats(s.id).teachers,
    },
    {
      header: 'Students',
      cell: (s) => getSchoolStats(s.id).students,
    },
    {
      header: 'Actions',
      cell: (s) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDrilldown(s)}>
            <Eye className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEditSchool(s)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSeatsTargetSchool(s); setSeatsToAdd(1); setIsSeatsDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Add Admin Slots
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleSchoolStatus(s)}>
                <Activity className="mr-2 h-4 w-4" />
                {s.subscription_status === 'active' ? 'Pause' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-rose-600" onClick={() => handleDeleteSchool(s)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const userColumns = [
    {
      header: 'User',
      cell: (u) => (
        <div>
          <p className="font-medium text-slate-900">{u.full_name ?? u.email}</p>
          <p className="text-xs text-slate-500">{u.email}</p>
        </div>
      ),
    },
    {
      header: 'School',
      cell: (u) => {
        const sid = getUserSchoolId(u);
        const school = schools.find(s => s.id === sid);
        return school
          ? <span className="text-sm text-slate-700">{school.name}</span>
          : <Badge className="bg-slate-100 text-slate-500 text-xs">Unassigned</Badge>;
      },
    },
    {
      header: 'Role',
      cell: (u) => {
        const role = getUserRole(u);
        return (
          <Badge className={`text-xs ${role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
            {role ?? 'user'}
          </Badge>
        );
      },
    },
    {
      header: 'Actions',
      cell: (u) => {
        const sid = getUserSchoolId(u);
        return (
          <div className="flex items-center gap-1">
            {!sid && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setTargetUser(u); setIsCreateSchoolForUserOpen(true); }}
              >
                <Plus className="mr-1 h-3 w-3" /> Create School
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  setAssigningUser(u);
                  setUserFormData({ school_id: '' });
                  setIsUserDialogOpen(true);
                }}>
                  <Building2 className="mr-2 h-4 w-4" /> Assign to School
                </DropdownMenuItem>
                <DropdownMenuItem className="text-rose-600" onClick={() => handleDeleteUser(u)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  // ---------------------------------------------------------------------------
  // Revenue helpers
  // ---------------------------------------------------------------------------

  const subscriptionRows = useMemo(() => {
    return schools.map(s => ({
      ...s,
      monthly_revenue: tierMonthlyCents[s.subscription_tier] ?? 0,
    }));
  }, [schools, tierMonthlyCents]);

  const revenueColumns = [
    {
      header: 'School',
      cell: (s) => <span className="font-medium text-slate-900">{s.name}</span>,
    },
    {
      header: 'Tier',
      cell: (s) => (
        <Badge className={`text-xs ${TIER_COLORS[s.subscription_tier] ?? 'bg-slate-100 text-slate-600'}`}>
          {s.subscription_tier}
        </Badge>
      ),
    },
    {
      header: 'Status',
      cell: (s) => (
        <Badge className={`text-xs ${STATUS_COLORS[s.subscription_status] ?? 'bg-slate-100 text-slate-600'}`}>
          {s.subscription_status}
        </Badge>
      ),
    },
    {
      header: 'MRR',
      cell: (s) => formatMoney(s.monthly_revenue, currency),
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Super Admin Panel"
          subtitle="Manage schools, users, revenue and system health"
          icon={<ShieldCheck className="h-6 w-6 text-indigo-600" />}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
          {/* Tab list */}
          <TabsList className="grid h-auto w-full grid-cols-3 gap-2 rounded-3xl bg-transparent p-0 lg:grid-cols-6">
            {/* Schools */}
            <TabsTrigger
              value="schools"
              className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium data-[state=active]:border-indigo-300 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700"
            >
              <Building2 className="h-4 w-4 shrink-0" />
              <span>Schools</span>
              {schools.length > 0 && (
                <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                  {schools.length}
                </span>
              )}
            </TabsTrigger>

            {/* Users */}
            <TabsTrigger
              value="users"
              className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium data-[state=active]:border-indigo-300 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700"
            >
              <Users className="h-4 w-4 shrink-0" />
              <span>Users</span>
              {unassignedUsers.length > 0 && (
                <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
                  {unassignedUsers.length}
                </span>
              )}
            </TabsTrigger>

            {/* Revenue */}
            <TabsTrigger
              value="revenue"
              className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium data-[state=active]:border-indigo-300 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700"
            >
              <TrendingUp className="h-4 w-4 shrink-0" />
              <span>Revenue</span>
            </TabsTrigger>

            {/* Solver — colored dot indicator */}
            <TabsTrigger
              value="solver"
              className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium data-[state=active]:border-indigo-300 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700"
            >
              <Cpu className="h-4 w-4 shrink-0" />
              <span>Solver</span>
              <span className={`h-2 w-2 rounded-full shrink-0 ${
                optaIsError
                  ? 'bg-rose-500'
                  : optaStatus?.health?.ok
                    ? 'bg-emerald-500'
                    : 'bg-slate-300'
              }`} />
            </TabsTrigger>

            {/* Logs */}
            <TabsTrigger
              value="logs"
              className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium data-[state=active]:border-indigo-300 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700"
            >
              <Terminal className="h-4 w-4 shrink-0" />
              <span>Logs</span>
              {auditLogs.length > 0 && (
                <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                  {auditLogs.length}
                </span>
              )}
            </TabsTrigger>

            {/* Emails */}
            <TabsTrigger
              value="emails"
              className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium data-[state=active]:border-indigo-300 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700"
            >
              <Mail className="h-4 w-4 shrink-0" />
              <span>Emails</span>
            </TabsTrigger>
          </TabsList>

          {/* -------------------------------------------------------------- */}
          {/* SCHOOLS TAB                                                     */}
          {/* -------------------------------------------------------------- */}
          <TabsContent value="schools" className="mt-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search schools..."
                  value={schoolSearch}
                  onChange={e => setSchoolSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                onClick={() => { resetSchoolForm(); setIsSchoolDialogOpen(true); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Plus className="mr-2 h-4 w-4" /> Add School
              </Button>
            </div>
            <DataTable
              data={filteredSchools}
              columns={schoolColumns}
              isLoading={loadingSchools}
              emptyMessage="No schools found"
            />
          </TabsContent>

          {/* -------------------------------------------------------------- */}
          {/* USERS TAB                                                       */}
          {/* -------------------------------------------------------------- */}
          <TabsContent value="users" className="mt-6">
            {unassignedUsers.length > 0 && (
              <Card className="mb-4 border-amber-200 bg-amber-50">
                <CardContent className="flex items-center gap-3 py-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-800">
                    <span className="font-semibold">{unassignedUsers.length} user{unassignedUsers.length !== 1 ? 's' : ''}</span>
                    {' '}without a school assignment. Review and assign below.
                  </p>
                </CardContent>
              </Card>
            )}
            <div className="mb-4 flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <DataTable
              data={filteredUsers}
              columns={userColumns}
              isLoading={loadingUsers}
              emptyMessage="No users found"
            />
          </TabsContent>

          {/* -------------------------------------------------------------- */}
          {/* REVENUE TAB                                                     */}
          {/* -------------------------------------------------------------- */}
          <TabsContent value="revenue" className="mt-6 space-y-6">
            {/* Stat cards — MRR fixed: formatMoney(mrr) not formatMoney(mrr * 100) */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                title="Active Schools"
                value={activeSchools.length}
                icon={<Building2 className="h-5 w-5 text-emerald-600" />}
              />
              <StatCard
                title="Monthly Revenue"
                value={mrr != null ? formatMoney(mrr, currency) : '—'}
                icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}
              />
              <StatCard
                title="Paused Schools"
                value={pausedSchools.length}
                icon={<Activity className="h-5 w-5 text-amber-600" />}
              />
              <StatCard
                title="Avg / School"
                value={
                  mrr != null && activeSchools.length > 0
                    ? formatMoney(Math.round(mrr / activeSchools.length), currency)
                    : '—'
                }
                icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
              />
            </div>

            {/* Breakdown cards */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tier Distribution (Active Schools)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(['tier1', 'tier2', 'tier3']).map(tier => {
                    const count = tierBreakdown[tier] ?? 0;
                    const pct = activeSchools.length > 0 ? Math.round((count / activeSchools.length) * 100) : 0;
                    return (
                      <div key={tier}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="font-medium capitalize">{tier}</span>
                          <span className="text-slate-500">
                            {count} school{count !== 1 ? 's' : ''} · {formatMoney(tierMonthlyCents[tier] ?? 0, currency)}/mo
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-indigo-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Subscription Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(['active', 'paused', 'trial', 'cancelled']).map(status => {
                    const count = schools.filter(s => s.subscription_status === status).length;
                    const pct = schools.length > 0 ? Math.round((count / schools.length) * 100) : 0;
                    const barColor = {
                      active: 'bg-emerald-500',
                      paused: 'bg-amber-500',
                      trial: 'bg-sky-500',
                      cancelled: 'bg-rose-500',
                    }[status] ?? 'bg-slate-400';
                    return (
                      <div key={status}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="font-medium capitalize">{status}</span>
                          <span className="text-slate-500">{count} school{count !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className={`h-2 rounded-full transition-all ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Subscriptions table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">All Subscriptions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <DataTable
                  data={subscriptionRows}
                  columns={revenueColumns}
                  isLoading={loadingSchools}
                  emptyMessage="No subscription data"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* -------------------------------------------------------------- */}
          {/* SOLVER TAB                                                      */}
          {/* -------------------------------------------------------------- */}
          <TabsContent value="solver" className="mt-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">OptaPlanner Status</h2>
                {optaStatus?.base_url && (
                  <p className="mt-0.5 font-mono text-xs text-slate-400">{optaStatus.base_url}</p>
                )}
                {optaUpdatedAt > 0 && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    Last checked {formatTime(optaUpdatedAt)}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchOpta()} disabled={loadingOpta}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loadingOpta ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Error banner — shown when query throws */}
            {optaIsError && (
              <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                <div>
                  <p className="font-medium text-rose-800">Could not reach OptaPlanner service</p>
                  <p className="mt-1 text-sm text-rose-600">
                    {optaErr?.message ?? 'An unknown error occurred'}
                  </p>
                </div>
              </div>
            )}

            {!optaIsError && (
              <>
                {/* Health stat cards */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card>
                    <CardContent className="flex items-center gap-4 py-5">
                      {optaStatus?.health?.ok
                        ? <Wifi className="h-8 w-8 text-emerald-500" />
                        : <WifiOff className="h-8 w-8 text-rose-400" />}
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Health</p>
                        <p className={`text-lg font-bold ${optaStatus?.health?.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {optaStatus?.health?.ok ? 'Online' : optaStatus ? 'Unreachable' : '—'}
                        </p>
                        {optaStatus?.health?.error && (
                          <p className="mt-0.5 text-xs text-rose-500">{optaStatus.health.error}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="flex items-center gap-4 py-5">
                      <Clock className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Response Time</p>
                        <p className="text-lg font-bold text-slate-800">
                          {optaStatus?.health?.ms != null ? `${optaStatus.health.ms} ms` : '—'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="flex items-center gap-4 py-5">
                      <CheckCircle2 className={`h-8 w-8 ${optaStatus?.version?.ok ? 'text-emerald-500' : 'text-slate-300'}`} />
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Version</p>
                        <p className="text-lg font-bold text-slate-800">
                          {optaStatus?.version?.data?.version ?? '—'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Server performance cards */}
                {(() => {
                  const m = optaStatus?.sys_metrics?.data;
                  const cpuPct = m?.cpu_percent ?? null;
                  const memPct = m?.memory?.percent ?? null;
                  const memUsed = m?.memory?.used_mb ?? null;
                  const memTotal = m?.memory?.total_mb ?? null;
                  const jvmRss = m?.jvm?.rss_mb ?? null;
                  const jvmPeak = m?.jvm?.peak_mb ?? null;
                  if (!m) return null;
                  const cpuColor = cpuPct > 80 ? 'text-rose-600' : cpuPct > 50 ? 'text-amber-600' : 'text-emerald-600';
                  const memColor = memPct > 80 ? 'text-rose-600' : memPct > 60 ? 'text-amber-600' : 'text-emerald-600';
                  return (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Card>
                        <CardContent className="flex items-center gap-4 py-5">
                          <Cpu className="h-8 w-8 text-violet-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">CPU Usage</p>
                            <p className={`text-lg font-bold ${cpuColor}`}>
                              {cpuPct != null ? `${cpuPct}%` : '—'}
                            </p>
                            <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100">
                              <div className={`h-1.5 rounded-full ${cpuPct > 80 ? 'bg-rose-500' : cpuPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                   style={{ width: `${Math.min(cpuPct ?? 0, 100)}%` }} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="flex items-center gap-4 py-5">
                          <HardDrive className="h-8 w-8 text-blue-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">System RAM</p>
                            <p className={`text-lg font-bold ${memColor}`}>
                              {memPct != null ? `${memPct}%` : '—'}
                            </p>
                            <p className="text-xs text-slate-400">
                              {memUsed != null ? `${Math.round(memUsed)} / ${Math.round(memTotal)} MB` : ''}
                            </p>
                            <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                              <div className={`h-1.5 rounded-full ${memPct > 80 ? 'bg-rose-500' : memPct > 60 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                   style={{ width: `${Math.min(memPct ?? 0, 100)}%` }} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="flex items-center gap-4 py-5">
                          <Server className="h-8 w-8 text-indigo-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">JVM Heap (RSS)</p>
                            <p className="text-lg font-bold text-slate-800">
                              {jvmRss != null ? `${Math.round(jvmRss)} MB` : '—'}
                            </p>
                            <p className="text-xs text-slate-400">
                              {jvmPeak != null ? `Peak: ${Math.round(jvmPeak)} MB` : ''}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}

                {/* Server config */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Server Configuration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {optaStatus?.version?.data && Object.keys(optaStatus.version.data).length > 0 ? (
                      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                        {Object.entries(optaStatus.version.data).map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{k}</dt>
                            <dd className="mt-0.5 font-mono text-sm text-slate-800">{String(v)}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-sm italic text-slate-400">No version data — server may be unreachable</p>
                    )}
                  </CardContent>
                </Card>

                {/* Active constraints */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Active Constraints</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {solverInfo.constraints.length > 0 ? (
                      <div className="space-y-2">
                        {solverInfo.constraints.map((c, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                            <span className="text-sm font-medium text-slate-800">
                              {c.name ?? c.id ?? `Constraint ${i + 1}`}
                            </span>
                            <Badge className={`text-xs ${c.type === 'HARD' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                              {c.type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm italic text-slate-400">No constraints data — server may be unreachable</p>
                    )}
                  </CardContent>
                </Card>

                {/* Solve history */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Solve History</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {solveHistory.length > 0 ? (
                      <DataTable
                        data={solveHistory}
                        columns={[
                          {
                            header: 'Generated',
                            cell: (r) => <span className="text-xs text-slate-500">{r.generated_at ? new Date(r.generated_at).toLocaleString() : '—'}</span>,
                          },
                          {
                            header: 'Notes',
                            cell: (r) => <span className="text-xs text-slate-600">{r.notes ?? '—'}</span>,
                          },
                          {
                            header: 'Programmes',
                            cell: (r) => (
                              <span className="text-xs text-slate-600">
                                {Array.isArray(r.programmes) ? r.programmes.join(', ') : r.programmes ?? '—'}
                              </span>
                            ),
                          },
                          {
                            header: 'Slots',
                            cell: (r) => <span className="text-xs text-slate-500">{Array.isArray(r.solver_timeslots) ? r.solver_timeslots.length : '—'}</span>,
                          },
                        ]}
                        emptyMessage="No solve runs recorded yet"
                      />
                    ) : (
                      <div className="px-6 py-8 text-center text-sm italic text-slate-400">
                        No solve runs recorded yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* -------------------------------------------------------------- */}
          {/* LOGS TAB                                                        */}
          {/* -------------------------------------------------------------- */}
          <TabsContent value="logs" className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">System Logs</h2>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live — updates every 10s
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['auditLogs'] })}
                disabled={loadingAudit}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loadingAudit ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Stats line */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-medium text-slate-600">{auditLogs.length} events</span>
              <span>·</span>
              <span>Last updated {logsUpdatedAt > 0 ? formatTime(logsUpdatedAt) : '—'}</span>
            </div>

            {/* Terminal */}
            <div className="h-[500px] overflow-y-auto rounded-2xl bg-slate-950 p-4 font-mono text-xs leading-relaxed">
              {loadingAudit && auditLogs.length === 0 ? (
                <p className="text-slate-500">Loading logs...</p>
              ) : sortedLogs.length === 0 ? (
                <p className="text-slate-500">No log entries found.</p>
              ) : (
                sortedLogs.map((log, i) => {
                  const action = log.action ?? log.event_type ?? log.type ?? '';
                  const actor = log.actor_email ?? log.user_email ?? log.performed_by ?? '—';
                  const entityId = log.entity_id ?? log.resource_id ?? log.target_id ?? '';
                  const ts = log.created_at ?? log.timestamp ?? '';
                  const meta = log.metadata ?? log.details ?? log.extra ?? null;
                  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
                  const actionColor = getActionColor(action);

                  return (
                    <div
                      key={log.id ?? i}
                      className="flex flex-wrap items-baseline gap-x-1 rounded px-1 py-0.5 transition-colors hover:bg-slate-900"
                    >
                      <span className="text-slate-500">[{formatLogTimestamp(ts)}]</span>
                      <span className={`font-semibold ${actionColor}`}>[{action || 'EVENT'}]</span>
                      <span className="text-blue-300">{actor}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-slate-300">{shortId(entityId)}</span>
                      {metaStr && (
                        <span className="break-all text-slate-500">{metaStr}</span>
                      )}
                    </div>
                  );
                })
              )}
              {/* Auto-scroll anchor — scrolled to on new entries */}
              <div ref={logsEndRef} />
            </div>
          </TabsContent>

          {/* -------------------------------------------------------------- */}
          {/* EMAILS TAB                                                      */}
          {/* -------------------------------------------------------------- */}
          <TabsContent value="emails" className="mt-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Broadcast Email</h2>
              <p className="mt-1 text-sm text-slate-500">
                Send a message to administrators across your schools.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              {/* Form — 3 cols */}
              <div className="space-y-4 lg:col-span-3">
                <Card>
                  <CardContent className="space-y-5 pt-6">
                    {/* Audience */}
                    <div className="space-y-1.5">
                      <Label htmlFor="email-audience">Audience</Label>
                      <Select
                        value={emailForm.target_status}
                        onValueChange={v => setEmailForm(f => ({ ...f, target_status: v }))}
                      >
                        <SelectTrigger id="email-audience">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active subscribers only</SelectItem>
                          <SelectItem value="all">All schools (active + paused)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Subject */}
                    <div className="space-y-1.5">
                      <Label htmlFor="email-subject">Subject</Label>
                      <Input
                        id="email-subject"
                        placeholder="e.g. Important update from Schedual"
                        value={emailForm.subject}
                        onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))}
                      />
                    </div>

                    {/* Message */}
                    <div className="space-y-1.5">
                      <Label htmlFor="email-message">Message</Label>
                      <Textarea
                        id="email-message"
                        placeholder="Write your message here..."
                        rows={8}
                        value={emailForm.message}
                        onChange={e => setEmailForm(f => ({ ...f, message: e.target.value }))}
                        className="resize-none"
                      />
                    </div>

                    {/* Send button */}
                    <Button
                      className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
                      disabled={
                        broadcastMutation.isPending ||
                        !emailForm.subject.trim() ||
                        !emailForm.message.trim() ||
                        broadcastRecipientCount === 0
                      }
                      onClick={() => broadcastMutation.mutate(emailForm)}
                    >
                      {broadcastMutation.isPending ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {broadcastMutation.isPending ? 'Sending...' : 'Send Broadcast'}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Preview — 2 cols */}
              <div className="space-y-4 lg:col-span-2">
                <Card className="border-indigo-100 bg-indigo-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base text-indigo-800">
                      <Users className="h-4 w-4" />
                      Recipient Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-3xl font-bold text-indigo-700">{broadcastRecipientCount}</p>
                    <p className="text-sm text-indigo-600">
                      admin{broadcastRecipientCount !== 1 ? 's' : ''} across{' '}
                      <span className="font-semibold">{recipientSchoolCount}</span>{' '}
                      school{recipientSchoolCount !== 1 ? 's' : ''} will receive this email
                    </p>
                    <div className="border-t border-indigo-200 pt-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-indigo-500">
                        Audience
                      </p>
                      <Badge className="bg-indigo-100 text-indigo-700 text-xs">
                        {emailForm.target_status === 'all'
                          ? 'Active + Paused schools'
                          : 'Active subscribers only'}
                      </Badge>
                    </div>
                    {broadcastRecipientCount === 0 && (
                      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                        <p className="text-xs text-amber-700">
                          No matching recipients found for the selected audience.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm text-slate-500">Tips</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-slate-500">
                      Keep subject lines under 60 characters for best deliverability.
                    </p>
                    <p className="text-xs text-slate-500">
                      Plain text messages have higher open rates.
                    </p>
                    <p className="text-xs text-slate-500">
                      The backend authenticates recipients independently of this preview count.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* DIALOGS                                                             */}
      {/* ------------------------------------------------------------------ */}

      {/* School create / edit */}
      <Dialog
        open={isSchoolDialogOpen}
        onOpenChange={v => { setIsSchoolDialogOpen(v); if (!v) resetSchoolForm(); }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSchool ? 'Edit School' : 'Add School'}</DialogTitle>
            <DialogDescription>
              {editingSchool ? 'Update school details below.' : 'Fill in the details to add a new school.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>School Name *</Label>
              <Input
                value={schoolFormData.name}
                onChange={e => setSchoolFormData(f => ({ ...f, name: e.target.value }))}
                placeholder="International School of..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>IB Code</Label>
                <Input
                  value={schoolFormData.ib_code}
                  onChange={e => setSchoolFormData(f => ({ ...f, ib_code: e.target.value }))}
                  placeholder="e.g. 000123"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input
                  value={schoolFormData.country}
                  onChange={e => setSchoolFormData(f => ({ ...f, country: e.target.value }))}
                  placeholder="e.g. France"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={schoolFormData.contact_email}
                onChange={e => setSchoolFormData(f => ({ ...f, contact_email: e.target.value }))}
                placeholder="admin@school.edu"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Subscription Tier</Label>
                <Select
                  value={schoolFormData.subscription_tier}
                  onValueChange={v => setSchoolFormData(f => ({ ...f, subscription_tier: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tier1">Tier 1</SelectItem>
                    <SelectItem value="tier2">Tier 2</SelectItem>
                    <SelectItem value="tier3">Tier 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={schoolFormData.subscription_status}
                  onValueChange={v => setSchoolFormData(f => ({ ...f, subscription_status: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Admin Seats</Label>
              <Input
                type="number"
                min={1}
                value={schoolFormData.max_admin_seats}
                onChange={e => setSchoolFormData(f => ({ ...f, max_admin_seats: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsSchoolDialogOpen(false); resetSchoolForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleSchoolSubmit}
              disabled={schoolMutation.isPending}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {schoolMutation.isPending ? 'Saving...' : editingSchool ? 'Save Changes' : 'Create School'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign user to school */}
      <Dialog
        open={isUserDialogOpen}
        onOpenChange={v => {
          setIsUserDialogOpen(v);
          if (!v) { setAssigningUser(null); setUserFormData({ school_id: '' }); }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign to School</DialogTitle>
            <DialogDescription>
              Select a school to assign{' '}
              <strong>{assigningUser?.full_name ?? assigningUser?.email}</strong> to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select
              value={userFormData.school_id}
              onValueChange={v => setUserFormData({ school_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a school..." />
              </SelectTrigger>
              <SelectContent>
                {schools.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleUserAssign}
              disabled={!userFormData.school_id || userMutation.isPending}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {userMutation.isPending ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create school for user */}
      <Dialog
        open={isCreateSchoolForUserOpen}
        onOpenChange={v => {
          setIsCreateSchoolForUserOpen(v);
          if (!v) {
            setTargetUser(null);
            setNewSchoolFormData({ name: '', ib_code: '', subscription_tier: 'tier1', contact_email: '', country: '' });
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create School for User</DialogTitle>
            <DialogDescription>
              A new school will be created and{' '}
              <strong>{targetUser?.full_name ?? targetUser?.email}</strong> will be assigned as its administrator.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>School Name *</Label>
              <Input
                value={newSchoolFormData.name}
                onChange={e => setNewSchoolFormData(f => ({ ...f, name: e.target.value }))}
                placeholder="International School of..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>IB Code</Label>
                <Input
                  value={newSchoolFormData.ib_code}
                  onChange={e => setNewSchoolFormData(f => ({ ...f, ib_code: e.target.value }))}
                  placeholder="000123"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input
                  value={newSchoolFormData.country}
                  onChange={e => setNewSchoolFormData(f => ({ ...f, country: e.target.value }))}
                  placeholder="France"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={newSchoolFormData.contact_email}
                onChange={e => setNewSchoolFormData(f => ({ ...f, contact_email: e.target.value }))}
                placeholder="admin@school.edu"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subscription Tier</Label>
              <Select
                value={newSchoolFormData.subscription_tier}
                onValueChange={v => setNewSchoolFormData(f => ({ ...f, subscription_tier: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tier1">Tier 1</SelectItem>
                  <SelectItem value="tier2">Tier 2</SelectItem>
                  <SelectItem value="tier3">Tier 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateSchoolForUserOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateSchoolForUser}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Create &amp; Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add admin slots */}
      <Dialog
        open={isSeatsDialogOpen}
        onOpenChange={v => {
          setIsSeatsDialogOpen(v);
          if (!v) { setSeatsTargetSchool(null); setSeatsToAdd(1); }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Admin Slots</DialogTitle>
            <DialogDescription>
              Add additional admin slots to <strong>{seatsTargetSchool?.name}</strong>.
              Current slots: <strong>{seatsTargetSchool?.max_admin_seats ?? 1}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label>Slots to Add</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={seatsToAdd}
              onChange={e => setSeatsToAdd(Number(e.target.value))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSeatsDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddSeats}
              disabled={schoolMutation.isPending}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {schoolMutation.isPending ? 'Saving...' : `Add ${seatsToAdd} Slot${seatsToAdd !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation — type name to confirm */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={v => { if (!v) { setDeleteConfirm(null); setConfirmNameInput(''); } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-rose-700">Confirm Deletion</DialogTitle>
            <DialogDescription>
              This action is irreversible. Type{' '}
              <strong className="text-slate-900">
                {deleteConfirm?.type === 'school'
                  ? deleteConfirm.item.name
                  : deleteConfirm?.item?.full_name ?? deleteConfirm?.item?.email}
              </strong>{' '}
              to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={confirmNameInput}
              onChange={e => setConfirmNameInput(e.target.value)}
              placeholder="Type name to confirm..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteConfirm(null); setConfirmNameInput(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                confirmNameInput.trim() !==
                  (deleteConfirm?.type === 'school'
                    ? deleteConfirm?.item?.name
                    : deleteConfirm?.item?.full_name ?? deleteConfirm?.item?.email) ||
                schoolMutation.isPending ||
                userMutation.isPending
              }
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* School drilldown */}
      <Dialog open={!!drilldown} onOpenChange={v => { if (!v) setDrilldown(null); }}>
        {drilldown && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                {drilldown.name}
              </DialogTitle>
              <DialogDescription>School details and statistics</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Users', value: getSchoolStats(drilldown.id).users },
                  { label: 'Teachers', value: getSchoolStats(drilldown.id).teachers },
                  { label: 'Students', value: getSchoolStats(drilldown.id).students },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                    <p className="text-2xl font-bold text-slate-900">{value}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>

              {/* Detail fields */}
              <dl className="space-y-2 text-sm">
                {[
                  ['IB Code', drilldown.ib_code],
                  ['Country', drilldown.country],
                  ['Contact', drilldown.contact_email],
                  ['Tier', drilldown.subscription_tier],
                  ['Status', drilldown.subscription_status],
                  ['Admin Seats', drilldown.max_admin_seats],
                  ['MRR', stripePrices != null ? formatMoney(tierMonthlyCents[drilldown.subscription_tier] ?? 0, currency) : null],
                ]
                  .filter(([, v]) => v != null && v !== '')
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-slate-50 pb-1">
                      <dt className="text-slate-400">{k}</dt>
                      <dd className="font-medium text-slate-800">{String(v)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { handleEditSchool(drilldown); setDrilldown(null); }}>
                <Pencil className="mr-2 h-4 w-4" /> Edit School
              </Button>
              <Button onClick={() => setDrilldown(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
