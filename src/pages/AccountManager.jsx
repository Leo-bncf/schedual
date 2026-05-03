import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { User, Mail, Building2, Shield, Lock, Trash2, KeyRound, AlertTriangle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import TwoFactorSetup from '../components/auth/TwoFactorSetup';

export default function AccountManager() {
  const queryClient = useQueryClient();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailChangePending, setEmailChangePending] = useState(false);
  const [emailConfirmCode, setEmailConfirmCode] = useState('');
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [isToggling2FA, setIsToggling2FA] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    newEmail: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    deleteConfirmPassword: ''
  });

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: school } = useQuery({
    queryKey: ['userSchool', user?.school_id],
    queryFn: async () => {
      if (!user?.school_id) return null;
      const schools = await base44.entities.School.filter({ id: user.school_id });
      return schools[0] || null;
    },
    enabled: !!user?.school_id
  });

  const updateNameMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setIsEditingName(false);
      toast.success('Name updated successfully');
    },
    onError: () => {
      toast.error('Failed to update name');
    }
  });

  const updateEmailMutation = useMutation({
    mutationFn: async (newEmail) => {
      const { data } = await base44.functions.invoke('updateUserEmail', { newEmail });
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setEmailChangePending(true);
      toast.success('Verification code sent to your new email address');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send verification');
    }
  });

  const confirmEmailMutation = useMutation({
    mutationFn: async (code) => {
      const { data } = await base44.functions.invoke('verifyEmailCode', {
        email: user?.email,
        code,
      });
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setIsEditingEmail(false);
      setEmailChangePending(false);
      setEmailConfirmCode('');
      setFormData(f => ({ ...f, newEmail: '' }));
      toast.success('Email address updated successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Incorrect code');
    }
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }) => {
      // This would require backend implementation
      await base44.functions.invoke('updateUserPassword', { currentPassword, newPassword });
    },
    onSuccess: () => {
      setIsEditingPassword(false);
      setFormData({ ...formData, currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password updated successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update password');
    }
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (confirmPassword) => {
      await base44.functions.invoke('deleteUserAccount', { confirmPassword });
    },
    onSuccess: () => {
      toast.success('Account deleted successfully');
      setTimeout(() => {
        base44.auth.logout();
      }, 1500);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete account');
    }
  });

  const handle2FAToggle = async (enabled) => {
    if (enabled) {
      // Enable 2FA - show setup dialog
      setShow2FASetup(true);
    } else {
      // Disable 2FA
      setIsToggling2FA(true);
      try {
        await base44.functions.invoke('disable2FA');
        queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        toast.success('2FA disabled successfully');
      } catch (error) {
        toast.error(error.message || 'Failed to disable 2FA');
      } finally {
        setIsToggling2FA(false);
      }
    }
  };

  const handle2FASetupComplete = () => {
    setShow2FASetup(false);
    queryClient.invalidateQueries({ queryKey: ['currentUser'] });
  };

  const handleUpdateName = () => {
    if (!formData.full_name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    updateNameMutation.mutate({ full_name: formData.full_name });
  };

  const handleUpdateEmail = () => {
    if (!formData.newEmail.trim() || !formData.newEmail.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }
    updateEmailMutation.mutate(formData.newEmail);
  };

  const handleUpdatePassword = () => {
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (formData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    updatePasswordMutation.mutate({
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword
    });
  };

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        full_name: user.full_name || '',
        email: user.email || ''
      }));
    }
  }, [user]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }


  return (
    <div className="h-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-slate-600 mt-2">Manage your account information and security</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="school">School</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-900" />
                Personal Information
              </CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Full Name */}
              <div className="space-y-3">
                <Label htmlFor="full_name">Full Name</Label>
                {isEditingName ? (
                  <div className="flex gap-2">
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="flex-1"
                    />
                    <Button onClick={handleUpdateName} disabled={updateNameMutation.isPending}>
                      Save
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsEditingName(false);
                        setFormData({ ...formData, full_name: user?.full_name || '' });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <p className="text-slate-900 font-medium">{user?.full_name || 'Not set'}</p>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingName(true)}>
                      Edit
                    </Button>
                  </div>
                )}
              </div>

              {/* Role */}
              <div className="space-y-3">
                <Label>Role</Label>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Shield className="w-5 h-5 text-blue-900" />
                  <p className="text-slate-900 font-medium capitalize">{user?.role || 'user'}</p>
                </div>
              </div>

              {/* Account Created */}
              <div className="space-y-3">
                <Label>Member Since</Label>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-slate-900">{new Date(user?.created_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6 mt-6">
          {/* Email Change */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-900" />
                Email Address
              </CardTitle>
              <CardDescription>Change your email address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Current Email</Label>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <p className="text-slate-900">{user?.email}</p>
                </div>
              </div>

              {isEditingEmail ? (
                emailChangePending ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">
                      A 6-digit code was sent to <strong>{formData.newEmail}</strong>. Enter it below to confirm.
                    </p>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={emailConfirmCode}
                      onChange={(e) => setEmailConfirmCode(e.target.value.replace(/\D/g, ''))}
                      className="font-mono tracking-widest text-center text-xl"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => confirmEmailMutation.mutate(emailConfirmCode)}
                        disabled={confirmEmailMutation.isPending || emailConfirmCode.length !== 6}
                        className="bg-blue-900 hover:bg-blue-800"
                      >
                        {confirmEmailMutation.isPending ? 'Verifying...' : 'Confirm'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditingEmail(false);
                          setEmailChangePending(false);
                          setEmailConfirmCode('');
                          setFormData(f => ({ ...f, newEmail: '' }));
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label htmlFor="new_email">New Email Address</Label>
                    <Input
                      id="new_email"
                      type="email"
                      placeholder="Enter new email"
                      value={formData.newEmail}
                      onChange={(e) => setFormData({ ...formData, newEmail: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleUpdateEmail} disabled={updateEmailMutation.isPending} className="bg-blue-900 hover:bg-blue-800">
                        {updateEmailMutation.isPending ? 'Sending...' : 'Send Confirmation'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditingEmail(false);
                          setFormData(f => ({ ...f, newEmail: '' }));
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )
              ) : (
                <Button variant="outline" onClick={() => setIsEditingEmail(true)}>
                  Change Email
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Two-Factor Authentication */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-900" />
                Two-Factor Authentication (2FA)
              </CardTitle>
              <CardDescription>Add an extra layer of security with Google Authenticator</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="space-y-1">
                  <p className="font-medium text-slate-900">
                    {user?.totp_enabled ? '2FA Enabled' : '2FA Disabled'}
                  </p>
                  <p className="text-sm text-slate-600">
                    {user?.totp_enabled 
                      ? 'Your account is protected with 2FA' 
                      : 'Protect your account with an authenticator app'
                    }
                  </p>
                </div>
                <Switch
                  checked={user?.totp_enabled || false}
                  onCheckedChange={handle2FAToggle}
                  disabled={isToggling2FA}
                />
              </div>

              {user?.totp_enabled && (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    You'll be asked for a code from your authenticator app when logging in.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-900" />
                Password
              </CardTitle>
              <CardDescription>Update your password to keep your account secure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditingPassword ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current_password">Current Password</Label>
                    <Input
                      id="current_password"
                      type="password"
                      placeholder="Enter current password"
                      value={formData.currentPassword}
                      onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new_password">New Password</Label>
                    <Input
                      id="new_password"
                      type="password"
                      placeholder="Enter new password (min 8 characters)"
                      value={formData.newPassword}
                      onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">Confirm New Password</Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      placeholder="Confirm new password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleUpdatePassword} disabled={updatePasswordMutation.isPending} className="bg-blue-900 hover:bg-blue-800">
                      <KeyRound className="w-4 h-4 mr-2" />
                      Update Password
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsEditingPassword(false);
                        setFormData({ 
                          ...formData, 
                          currentPassword: '', 
                          newPassword: '', 
                          confirmPassword: '' 
                        });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-600 mb-4">••••••••</p>
                  <Button variant="outline" onClick={() => setIsEditingPassword(true)}>
                    Change Password
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* School Tab */}
        <TabsContent value="school" className="space-y-6 mt-6">
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle>🔍 JWT Token Debug</CardTitle>
              <CardDescription>Check if your login token has the correct school_id</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={async () => {
                  try {
                    const result = await base44.functions.invoke('debugUserJWT');
                    alert(JSON.stringify(result.data, null, 2));
                  } catch (error) {
                    alert('Error: ' + error.message);
                  }
                }}
                className="bg-blue-900 hover:bg-blue-800"
              >
                Debug JWT Token
              </Button>
            </CardContent>
          </Card>

          {school ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-900" />
                  School Information
                </CardTitle>
                <CardDescription>Your school details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>School Name</Label>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-slate-900 font-medium">{school.name}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>School Code</Label>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-slate-900">{school.code}</p>
                    </div>
                  </div>

                  {school.ib_school_code && (
                    <div className="space-y-2">
                      <Label>IB School Code</Label>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-slate-900">{school.ib_school_code}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Academic Year</Label>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-slate-900">{school.academic_year}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Subscription Status</Label>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-slate-900 capitalize">{school.subscription_status}</p>
                    </div>
                  </div>

                  {school.address && (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Address</Label>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-slate-900">{school.address}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center space-y-4">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-slate-600">No school assigned to your account yet</p>
                <p className="text-sm text-slate-500">If you just completed payment, wait for the payment confirmation page to finish and then return here.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Danger Zone Tab */}
        <TabsContent value="danger" className="space-y-6 mt-6">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>Irreversible actions - proceed with caution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="font-semibold text-red-900 mb-2">Delete Account</h3>
                <p className="text-sm text-red-700 mb-4">
                  Once you delete your account, there is no going back. This will permanently delete all your data.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2">
                      <Trash2 className="w-4 h-4" />
                      Delete My Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your account
                        and remove all your data from our servers. Please enter your password to confirm.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                      <Label htmlFor="delete_password">Confirm Password</Label>
                      <Input
                        id="delete_password"
                        type="password"
                        placeholder="Enter your password"
                        value={formData.deleteConfirmPassword}
                        onChange={(e) => setFormData({ ...formData, deleteConfirmPassword: e.target.value })}
                        className="mt-2"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setFormData({ ...formData, deleteConfirmPassword: '' })}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        disabled={!formData.deleteConfirmPassword || deleteAccountMutation.isPending}
                        onClick={() => {
                          deleteAccountMutation.mutate(formData.deleteConfirmPassword);
                          setFormData({ ...formData, deleteConfirmPassword: '' });
                        }}
                      >
                        Yes, delete my account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 2FA Setup Dialog */}
      <Dialog open={show2FASetup} onOpenChange={setShow2FASetup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Secure your account with Google Authenticator
            </DialogDescription>
          </DialogHeader>
          <TwoFactorSetup
            onComplete={handle2FASetupComplete}
            onCancel={() => setShow2FASetup(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}