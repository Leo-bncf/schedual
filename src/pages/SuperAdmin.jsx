import React, { useState } from 'react';
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
import { Building2, Users, GraduationCap, Plus, Pencil, Trash2, Calendar, Crown, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageHeader from '../components/ui-custom/PageHeader';
import StatCard from '../components/ui-custom/StatCard';
import DataTable from '../components/ui-custom/DataTable';

export default function SuperAdmin() {
  const [isSchoolDialogOpen, setIsSchoolDialogOpen] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [schoolFormData, setSchoolFormData] = useState({
    name: '',
    code: '',
    ib_school_code: '',
    address: '',
    timezone: 'UTC',
    academic_year: '2024-2025'
  });
  const [userFormData, setUserFormData] = useState({
    email: '',
    school_id: '',
    role: 'user'
  });

  const queryClient = useQueryClient();

  const { data: schools = [], isLoading: loadingSchools } = useQuery({
    queryKey: ['allSchools'],
    queryFn: () => base44.entities.School.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: allTeachers = [] } = useQuery({
    queryKey: ['allTeachers'],
    queryFn: () => base44.entities.Teacher.list(),
  });

  const { data: allStudents = [] } = useQuery({
    queryKey: ['allStudents'],
    queryFn: () => base44.entities.Student.list(),
  });

  const { data: allSchedules = [] } = useQuery({
    queryKey: ['allSchedules'],
    queryFn: () => base44.entities.ScheduleVersion.list(),
  });

  const createSchoolMutation = useMutation({
    mutationFn: (data) => base44.entities.School.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allSchools'] });
      setIsSchoolDialogOpen(false);
      resetSchoolForm();
    },
  });

  const updateSchoolMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.School.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allSchools'] });
      setIsSchoolDialogOpen(false);
      resetSchoolForm();
    },
  });

  const deleteSchoolMutation = useMutation({
    mutationFn: (id) => base44.entities.School.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allSchools'] }),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      setIsUserDialogOpen(false);
      setUserFormData({ email: '', school_id: '', role: 'user' });
    },
  });

  const resetSchoolForm = () => {
    setSchoolFormData({
      name: '',
      code: '',
      ib_school_code: '',
      address: '',
      timezone: 'UTC',
      academic_year: '2024-2025'
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
      academic_year: school.academic_year || '2024-2025'
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

  const getSchoolStats = (schoolId) => {
    const users = allUsers.filter(u => u.school_id === schoolId).length;
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
          <p className="font-medium text-slate-900">{row.name}</p>
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
              Edit
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
        const school = schools.find(s => s.id === row.school_id);
        return school ? school.name : <Badge variant="outline">Unassigned</Badge>;
      }
    },
    {
      header: 'Role',
      cell: (row) => (
        <Badge className={row.role === 'admin' ? 'bg-purple-100 text-purple-700 border-0' : 'bg-slate-100 text-slate-600 border-0'}>
          {row.role === 'admin' ? <Crown className="w-3 h-3 mr-1" /> : null}
          {row.role}
        </Badge>
      )
    },
    {
      header: '',
      cell: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setUserFormData({
              email: row.email,
              school_id: row.school_id || '',
              role: row.role || 'user'
            });
            setIsUserDialogOpen(true);
          }}
        >
          Assign
        </Button>
      )
    }
  ];

  const totalUsers = allUsers.length;
  const totalTeachers = allTeachers.length;
  const totalStudents = allStudents.length;
  const totalSchedules = allSchedules.length;

  return (
    <div className="space-y-6">
      <PageHeader 
        title={<div className="flex items-center gap-2"><Crown className="w-6 h-6 text-amber-500" /> Super Admin Panel</div>}
        description="Manage all schools, users, and platform-wide settings"
        actions={
          <Button onClick={() => setIsSchoolDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            Add School
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Schools" value={schools.length} icon={Building2} />
        <StatCard title="Total Users" value={totalUsers} icon={Users} />
        <StatCard title="Total Teachers" value={totalTeachers} icon={Users} />
        <StatCard title="Total Students" value={totalStudents} icon={GraduationCap} />
      </div>

      <Tabs defaultValue="schools" className="space-y-4">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="schools">Schools</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
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
                <h4 className="font-semibold text-blue-900 mb-2">📋 How to add users to a new school:</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Create the school in the "Schools" tab</li>
                  <li>Invite users via Base44's user invite system (Dashboard → Settings → Invite Users)</li>
                  <li>Once invited users log in, assign them to the school using the "Assign User to School" button below</li>
                </ol>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button onClick={() => setIsUserDialogOpen(true)} variant="outline">
                <Users className="w-4 h-4 mr-2" />
                Assign User to School
              </Button>
            </div>
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

        <TabsContent value="analytics">
          <div className="grid gap-4">
            {schools.map(school => {
              const stats = getSchoolStats(school.id);
              return (
                <Card key={school.id} className="border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">{school.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-slate-500">Users</p>
                        <p className="text-2xl font-semibold text-slate-900">{stats.users}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Teachers</p>
                        <p className="text-2xl font-semibold text-slate-900">{stats.teachers}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Students</p>
                        <p className="text-2xl font-semibold text-slate-900">{stats.students}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Schedules</p>
                        <p className="text-2xl font-semibold text-slate-900">{stats.schedules}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
    </div>
  );
}