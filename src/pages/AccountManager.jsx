import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Building2, Shield, Save } from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import { toast } from 'sonner';

export default function AccountManager() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: ''
  });

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    onSuccess: (data) => {
      setFormData({
        full_name: data.full_name || '',
        email: data.email || ''
      });
    }
  });

  const { data: school } = useQuery({
    queryKey: ['userSchool', user?.school_id],
    queryFn: async () => {
      if (!user?.school_id) return null;
      const schools = await base44.entities.School.list();
      return schools.find(s => s.id === user.school_id);
    },
    enabled: !!user?.school_id
  });

  const updateUserMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setIsEditing(false);
      toast.success('Profile updated successfully');
    },
    onError: () => {
      toast.error('Failed to update profile');
    }
  });

  const handleSave = () => {
    updateUserMutation.mutate({
      full_name: formData.full_name
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Account Manager"
        description="Manage your account information and settings"
      />

      <div className="grid gap-6 max-w-4xl">
        {/* User Information */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              {isEditing ? (
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              ) : (
                <p className="text-slate-900 font-medium">{user?.full_name || 'Not set'}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <p className="text-slate-600">{user?.email}</p>
              </div>
              <p className="text-xs text-slate-500">Email cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <p className="text-slate-900 font-medium capitalize">{user?.role || 'user'}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              {isEditing ? (
                <>
                  <Button onClick={handleSave} disabled={updateUserMutation.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      full_name: user?.full_name || '',
                      email: user?.email || ''
                    });
                  }}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)}>
                  Edit Profile
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* School Information */}
        {school && (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                School Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>School Name</Label>
                <p className="text-slate-900 font-medium">{school.name}</p>
              </div>

              <div className="space-y-2">
                <Label>School Code</Label>
                <p className="text-slate-600">{school.code}</p>
              </div>

              {school.ib_school_code && (
                <div className="space-y-2">
                  <Label>IB School Code</Label>
                  <p className="text-slate-600">{school.ib_school_code}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Academic Year</Label>
                <p className="text-slate-600">{school.academic_year}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}