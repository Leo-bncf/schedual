import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Mail, Shield, Trash2 } from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import DataTable from '../components/ui-custom/DataTable';

export default function UserManagement() {
  const getUserSchoolId = (user) => user?.school_id || user?.data?.school_id || null;
  const getUserRole = (user) => user?.role || user?.data?.role || 'user';
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    school_id: '',
    role: 'user'
  });

  const queryClient = useQueryClient();

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: schools = [] } = useQuery({
    queryKey: ['schools'],
    queryFn: () => base44.entities.School.list(),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsDialogOpen(false);
      setFormData({ email: '', full_name: '', school_id: '', role: 'user' });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id) => base44.entities.User.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const handleSave = () => {
    if (!formData.email || !formData.full_name || !formData.school_id) {
      alert('Please fill in all required fields');
      return;
    }
    // Since we can't create users directly, we need to find the user by email and update them
    const user = users.find(u => u.email === formData.email);
    if (user) {
      updateUserMutation.mutate({
        id: user.id,
        data: {
          school_id: formData.school_id,
          role: formData.role
        }
      });
    } else {
      alert('User must be invited first through the invite system, then you can assign them to a school here.');
    }
  };

  const columns = [
    {
      header: 'Name',
      accessor: 'full_name',
      cell: (user) => (
        <div>
          <p className="font-medium text-slate-900">{user.full_name}</p>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>
      )
    },
    {
      header: 'School',
      accessor: 'school_id',
      cell: (user) => {
        const school = schools.find(s => s.id === getUserSchoolId(user));
        return school ? school.name : <Badge variant="outline">Not Assigned</Badge>;
      }
    },
    {
      header: 'Role',
      accessor: 'role',
      cell: (user) => (
        <Badge className={getUserRole(user) === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}>
          {getUserRole(user)}
        </Badge>
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      cell: (user) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFormData({
                email: user.email,
                full_name: user.full_name,
                school_id: getUserSchoolId(user) || '',
                role: getUserRole(user)
              });
              setIsDialogOpen(true);
            }}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            onClick={() => {
              if (confirm(`Are you sure you want to delete ${user.full_name}?`)) {
                deleteUserMutation.mutate(user.id);
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="User Management"
        description="Assign users to schools and manage access"
        actions={
          <Button onClick={() => setIsDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            Assign User to School
          </Button>
        }
      />

      <Card className="border-0 shadow-sm p-4 bg-blue-50 border-l-4 border-blue-400">
        <div className="flex gap-3">
          <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">How to add users</p>
            <p className="text-sm text-blue-700 mt-1">
              Users must first be invited through the Base44 invite system. Once they create an account, 
              you can assign them to a school here.
            </p>
          </div>
        </div>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <DataTable 
            columns={columns}
            data={users}
            isLoading={loadingUsers}
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign User to School</DialogTitle>
            <DialogDescription>
              Update user's school assignment and role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">User Email *</Label>
              <Input 
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="school">School *</Label>
              <Select 
                value={formData.school_id} 
                onValueChange={(value) => setFormData({ ...formData, school_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a school..." />
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
              <Label htmlFor="role">Role</Label>
              <Select 
                value={formData.role} 
                onValueChange={(value) => setFormData({ ...formData, role: value })}
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
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}