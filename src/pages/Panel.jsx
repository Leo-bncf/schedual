import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, GraduationCap, Plus, Pencil, Trash2, Calendar, Crown, MoreHorizontal, Brain, BarChart3, Bot, ShieldCheck } from 'lucide-react';
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
  const [selectedUser, setSelectedUser] = useState(null);
  const [schoolFormData, setSchoolFormData] = useState({
    name: '',
    code: '',
    ib_school_code: '',
    address: '',
    timezone: 'UTC',
    academic_year: '2024-2025',
    stripe_customer_id: ''
  });
  const [userFormData, setUserFormData] = useState({
    email: '',
    school_id: '',
    role: 'user'
  });
  const [newSchoolFormData, setNewSchoolFormData] = useState({
    name: '',
    code: '',
    ib_school_code: '',
    address: '',
    timezone: 'UTC',
    academic_year: '2024-2025',
    user_email: '',
    user_role: 'admin'
  });

  const [isSeatsDialogOpen, setIsSeatsDialogOpen] = useState(false);
  const [seatsTargetSchool, setSeatsTargetSchool] = useState(null);
  const [seatsToAdd, setSeatsToAdd] = useState(1);

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
    refetchInterval: 5000, // Auto-refetch every 5 seconds to catch webhook updates
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
      } catch (error) {
        console.error('Error fetching teachers:', error);
        return [];
      }
    },
  });

  const { data: allStudents = [] } = useQuery({
    queryKey: ['allStudents'],
    queryFn: async () => {
      try {
        const { data } = await base44.functions.invoke('adminGetAllData', { entityType: 'Student' });
        return data.records || [];
      } catch (error) {
        console.error('Error fetching students:', error);
        return [];
      }
    },
  });

  const { data: allSchedules = [] } = useQuery({
    queryKey: ['allSchedules'],
    queryFn: async () => {
      try {
        const { data } = await base44.functions.invoke('adminGetAllData', { entityType: 'ScheduleVersion' });
        return data.records || [];
      } catch (error) {
        console.error('Error fetching schedules:', error);
        return [];
      }
    },
  });

  const { data: loginSessions = [] } = useQuery({
    queryKey: ['loginSessions'],
    queryFn: async () => {
      try {
        const { data } = await base44.functions.invoke('adminGetAllData', { entityType: 'LoginSession' });
        return data.records || [];
      } catch (error) {
        console.error('Error fetching login sessions:', error);
        return [];
      }
    },
  });

  const createSchoolMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('adminManageSchool', { action: 'create', data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allSchools'] });
      setIsSchoolDialogOpen(false);
      resetSchoolForm();
    },
    onError: (error) => {
      console.error('Create school error:', error);
      const apiMsg = error?.response?.data?.error || error?.data?.error;
      alert('Failed to create school: ' + (apiMsg || error.message || 'Unknown error'));
    }
  });

  const createSchoolForUserMutation = useMutation({
    mutationFn: async (data) => {
      // Create school first
      const { data: result } = await base44.functions.invoke('adminManageSchool', {
        action: 'create',
        data: {
          name: data.name,
          code: data.code,
          ib_school_code: data.ib_school_code,
          address: data.address,
          timezone: data.timezone,
          academic_year: data.academic_year
        }
      });
      
      // Then assign user to school
      const user = allUsers.find(u => u.email === data.user_email);
      if (user && result.school) {
        const updateResponse = await base44.functions.invoke('adminManageUser', {
          action: 'update',
          userId: user.id,
          data: { school_id: result.school.id }
        });
        
        return { school: result.school, requiresReauth: updateResponse.data?.requiresReauth, userEmail: data.user_email };
      }
      
      return { school: result.school };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['allSchools'] });
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      setIsCreateSchoolForUserOpen(false);
      setNewSchoolFormData({
        name: '',
        code: '',
        ib_school_code: '',
        address: '',
        timezone: 'UTC',
        academic_year: '2024-2025',
        user_email: '',
        user_role: 'admin'
      });
      
      if (data.requiresReauth) {
        alert(`✅ School created! IMPORTANT: ${data.userEmail} must log out and log back in to access their school dashboard and create subjects.`);
      }
    },
  });

  const updateSchoolMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // Pass CSRF from provider header automatically set in app
      const response = await base44.functions.invoke('adminManageSchool', { action: 'update', schoolId: id, data });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allSchools'] });
      setIsSchoolDialogOpen(false);
      resetSchoolForm();
    },
    onError: (error) => {
      console.error('Update school error:', error);
      const apiMsg = error?.response?.data?.error || error?.data?.error;
      alert('Failed to update school: ' + (apiMsg || error.message || 'Unknown error'));
    }
  });

  const deleteSchoolMutation = useMutation({
    mutationFn: async (id) => {
      const response = await base44.functions.invoke('adminManageSchool', { action: 'delete', schoolId: id });
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allSchools'] }),
    onError: (error) => {
      console.error('Delete school error:', error);
      alert('Failed to delete school: ' + (error.message || 'Unknown error'));
    }
  });

  const updateUserMutation = useMutation({
     mutationFn: ({ id, data }) => base44.functions.invoke('adminManageUser', { action: 'update', userId: id, data }),
     onSuccess: (response) => {
       queryClient.invalidateQueries({ queryKey: ['allUsers'] });
       setIsUserDialogOpen(false);

       if (response.data?.requiresReauth) {
         const user = allUsers.find(u => u.id === response.config?.userId);
         alert(`✅ User updated! IMPORTANT: ${user?.email || 'The user'} must log out and log back in to access their school dashboard.`);
       }

       setUserFormData({ email: '', school_id: '', role: 'user' });
     },
     onError: (error) => {
       console.error('Update user error:', error);
       const apiMsg = error?.response?.data?.error || error?.data?.error;
       alert('Failed to update user: ' + (apiMsg || error.message || 'Unknown error'));
     }
   });

  const deleteUserMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('adminManageUser', { action: 'delete', userId: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allUsers'] }),
  });

  const resetSchoolForm = () => {
    setSchoolFormData({
      name: '',
      code: '',
      ib_school_code: '',
      address: '',
      timezone: 'UTC',
      academic_year: '2024-2025',
      stripe_customer_id: ''
    });
    setEditingSchool(null);
  };

  const handleEditSchool = (school) => {
    setEditingSchool(school);
    setSchoolFormData({
      name: school.name || '',
      code: school.code || '',
      ib_school_code: school.ib_school_code || '',
      address: school.address || '',
      timezone: school.timezone || 'UTC',
      academic_year: school.academic_year || '2024-2025',
      stripe_customer_id: school.stripe_customer_id || ''
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
      updateUserMutation.mutate({
        id: user.id,
        data: { school_id: userFormData.school_id, role: userFormData.role }
      });
    }
  };

  const getUserSchoolId = (user) => user?.school_id || user?.data?.school_id || null;
  const getUserRole = (user) => user?.role || user?.data?.role || 'user';

  const getSchoolStats = (schoolId) => {
    const users = allUsers.filter(u => getUserSchoolId(u) === schoolId).length;
    const teachers = allTeachers.filter(t => t.school_id === schoolId).length;
    const students = allStudents.filter(s => s.school_id === schoolId).length;
    const schedules = allSchedules.filter(s => s.school_id === schoolId).length;
    return { users, teachers, students, schedules };
  };

  const schoolColumns = [
    {
      header: 'School',
      cell: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900">{row.name}</p>
            {row.subscription_status === 'active' ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Active</Badge>
            ) : (
              <Badge variant="outline" className="text-slate-600 text-xs">Inactive</Badge>
            )}
          </div>
          <p className="text-sm text-slate-500">{row.code}</p>
        </div>
      )
    },
    {
      header: 'IB Code',
      accessor: 'ib_school_code',
      cell: (row) => row.ib_school_code || '-'
    },
    {
      header: 'Users',
      cell: (row) => {
        const stats = getSchoolStats(row.id);
        return <Badge variant="outline">{stats.users} users</Badge>;
      }
    },
    {
      header: 'Teachers',
      cell: (row) => {
        const stats = getSchoolStats(row.id);
        return <span className="text-slate-600">{stats.teachers}</span>;
      }
    },
    {
      header: 'Students',
      cell: (row) => {
        const stats = getSchoolStats(row.id);
        return <span className="text-slate-600">{stats.students}</span>;
      }
    },
    {
      header: 'Schedules',
      cell: (row) => {
        const stats = getSchoolStats(row.id);
        return <span className="text-slate-600">{stats.schedules}</span>;
      }
    },
    {
      header: '',
      cell: (row) => (
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

                updateSchoolMutation.mutate({ 
                  id: row.id, 
                  data: updates
                });
              }}
            >
              {row.subscription_status === 'active' ? '⏸️ Pause Subscription' : '✓ Activate Subscription'}
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-rose-600"
              onClick={() => deleteSchoolMutation.mutate(row.id)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
              variant="default"
              size="sm"
              className="bg-blue-900 hover:bg-blue-800"
              onClick={() => {
                setNewSchoolFormData({
                  ...newSchoolFormData,
                  user_email: row.email
                });
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
                  setUserFormData({
                    email: row.email,
                    school_id: getUserSchoolId(row) || '',
                    role: getUserRole(row)
                  });
                  setIsUserDialogOpen(true);
                }}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Assign to School
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-rose-600"
                onClick={() => deleteUserMutation.mutate(row.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    }
  ];

  const totalUsers = allUsers.filter(u => getUserSchoolId(u)).length; // Only users assigned to schools
  const totalTeachers = allTeachers.length;
  const totalStudents = allStudents.length;

  return (
    <div className="space-y-6">
      <PageHeader 
        title={<div className="flex items-center gap-2"><Crown className="w-6 h-6 text-amber-500" /> Admin Panel</div>}
        description="Manage all schools, users, and platform-wide settings"
        actions={
          <Button onClick={() => setIsSchoolDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            Add School
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Schools" value={schools.length} icon={Building2} />
        <StatCard title="Total Users" value={totalUsers} icon={Users} />
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
        <TabsList className="grid h-auto w-full grid-cols-2 gap-3 rounded-3xl bg-transparent p-0 lg:grid-cols-3 xl:grid-cols-6">
          <TabsTrigger value="schools" className="group rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-slate-100 p-2 text-slate-600 group-data-[state=active]:bg-blue-100 group-data-[state=active]:text-blue-700"><Building2 className="w-4 h-4" /></div>
              <div>
                <div className="font-semibold">Schools</div>
                <div className="text-xs text-slate-500">Manage clients</div>
              </div>
            </div>
          </TabsTrigger>
          <TabsTrigger value="users" className="group rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-slate-100 p-2 text-slate-600 group-data-[state=active]:bg-blue-100 group-data-[state=active]:text-blue-700"><Users className="w-4 h-4" /></div>
              <div>
                <div className="font-semibold">Users</div>
                <div className="text-xs text-slate-500">Assignments & roles</div>
              </div>
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schools">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <DataTable 
                columns={schoolColumns}
                data={schools}
                isLoading={loadingSchools}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <div className="space-y-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <h4 className="font-semibold text-blue-900 mb-2">📋 Workflow for new clients:</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Users first connect/login to the platform</li>
                  <li>Find the user in the list below and click "Create School" next to their name</li>
                  <li>Fill in the school details - the user will be automatically assigned as admin</li>
                </ol>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <DataTable 
                  columns={userColumns}
                  data={allUsers}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      </Tabs>

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
                <Input 
                  id="name"
                  value={schoolFormData.name}
                  onChange={(e) => setSchoolFormData({ ...schoolFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">School Code *</Label>
                <Input 
                  id="code"
                  value={schoolFormData.code}
                  onChange={(e) => setSchoolFormData({ ...schoolFormData, code: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ib_school_code">IB School Code</Label>
              <Input 
                id="ib_school_code"
                value={schoolFormData.ib_school_code}
                onChange={(e) => setSchoolFormData({ ...schoolFormData, ib_school_code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input 
                id="address"
                value={schoolFormData.address}
                onChange={(e) => setSchoolFormData({ ...schoolFormData, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select 
                  value={schoolFormData.timezone} 
                  onValueChange={(value) => setSchoolFormData({ ...schoolFormData, timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">America/New_York</SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                    <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                    <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="academic_year">Academic Year</Label>
                <Select 
                  value={schoolFormData.academic_year} 
                  onValueChange={(value) => setSchoolFormData({ ...schoolFormData, academic_year: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024-2025">2024-2025</SelectItem>
                    <SelectItem value="2025-2026">2025-2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { resetSchoolForm(); setIsSchoolDialogOpen(false); }}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                {editingSchool ? 'Save Changes' : 'Create School'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign User to School</DialogTitle>
            <DialogDescription>
              Update user's school assignment and role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userEmail">User Email *</Label>
              <Input 
                id="userEmail"
                type="email"
                value={userFormData.email}
                onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userSchool">School *</Label>
              <Select 
                value={userFormData.school_id} 
                onValueChange={(value) => setUserFormData({ ...userFormData, school_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select school..." />
                </SelectTrigger>
                <SelectContent>
                  {schools.map(school => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="userRole">Role</Label>
              <Select 
                value={userFormData.role} 
                onValueChange={(value) => setUserFormData({ ...userFormData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUserAssign} className="bg-indigo-600 hover:bg-indigo-700">
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateSchoolForUserOpen} onOpenChange={setIsCreateSchoolForUserOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create School for User</DialogTitle>
            <DialogDescription>
              Create a new school and assign {newSchoolFormData.user_email} as the admin
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createSchoolForUserMutation.mutate(newSchoolFormData); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newName">School Name *</Label>
                <Input 
                  id="newName"
                  value={newSchoolFormData.name}
                  onChange={(e) => setNewSchoolFormData({ ...newSchoolFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newCode">School Code *</Label>
                <Input 
                  id="newCode"
                  value={newSchoolFormData.code}
                  onChange={(e) => setNewSchoolFormData({ ...newSchoolFormData, code: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newIbCode">IB School Code</Label>
              <Input 
                id="newIbCode"
                value={newSchoolFormData.ib_school_code}
                onChange={(e) => setNewSchoolFormData({ ...newSchoolFormData, ib_school_code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newAddress">Address</Label>
              <Input 
                id="newAddress"
                value={newSchoolFormData.address}
                onChange={(e) => setNewSchoolFormData({ ...newSchoolFormData, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newTimezone">Timezone</Label>
                <Select 
                  value={newSchoolFormData.timezone} 
                  onValueChange={(value) => setNewSchoolFormData({ ...newSchoolFormData, timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">America/New_York</SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                    <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                    <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newYear">Academic Year</Label>
                <Select 
                  value={newSchoolFormData.academic_year} 
                  onValueChange={(value) => setNewSchoolFormData({ ...newSchoolFormData, academic_year: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024-2025">2024-2025</SelectItem>
                    <SelectItem value="2025-2026">2025-2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newUserRole">User Role</Label>
              <Select 
                value={newSchoolFormData.user_role} 
                onValueChange={(value) => setNewSchoolFormData({ ...newSchoolFormData, user_role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (Recommended)</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateSchoolForUserOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={createSchoolForUserMutation.isPending}>
                Create School & Assign User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSeatsDialogOpen} onOpenChange={setIsSeatsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Admin Slots</DialogTitle>
            <DialogDescription>
              Increase the admin seat limit for {seatsTargetSchool?.name || 'this school'}.
            </DialogDescription>
          </DialogHeader>
          {seatsTargetSchool && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Current limit</p>
                  <p className="text-lg font-semibold text-slate-900">{seatsTargetSchool.max_admin_seats ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Admins used</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {allUsers.filter(u => getUserSchoolId(u) === seatsTargetSchool.id && getUserRole(u) === 'admin').length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">New total</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {(seatsTargetSchool.max_admin_seats ?? 0) + (Number(seatsToAdd) || 0)}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seatsAdd">Add slots</Label>
                <Input
                  id="seatsAdd"
                  type="number"
                  min={1}
                  value={seatsToAdd}
                  onChange={(e) => setSeatsToAdd(Number(e.target.value) || 1)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsSeatsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const current = seatsTargetSchool?.max_admin_seats ?? 0;
                const qty = Number(seatsToAdd) || 0;
                updateSchoolMutation.mutate({ id: seatsTargetSchool.id, data: { max_admin_seats: current + qty } });
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