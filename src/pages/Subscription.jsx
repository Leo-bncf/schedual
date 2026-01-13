import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  CreditCard, 
  Users, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Shield,
  Mail,
  UserPlus,
  CheckCircle2
} from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import { toast } from 'sonner';

export default function Subscription() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('yearly');

  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: schools = [] } = useQuery({
    queryKey: ['schools', user?.school_id],
    queryFn: () => base44.entities.School.filter({ id: user?.school_id }),
    enabled: !!user?.school_id,
  });

  const school = schools[0];

  const { data: schoolAdmins = [] } = useQuery({
    queryKey: ['schoolAdmins', user?.school_id],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('getSchoolAdmins');
      return data?.admins || [];
    },
    enabled: !!user?.school_id && (school?.subscription_status === 'active' || school?.subscription_status === 'trialing'),
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (email) => {
      const response = await base44.functions.invoke('inviteSchoolAdmin', { email });
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schoolAdmins'] });
      if (data?.action === 'assigned_existing_user') {
        toast.success('✅ User added as administrator successfully');
      } else {
        toast.success('✅ Invitation email sent successfully');
      }
      setInviteEmail('');
      setInviteDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send invitation');
    }
  });

  const handleSubscribe = async (plan) => {
    setIsProcessing(true);
    try {
      const { data } = await base44.functions.invoke('createCheckout', { plan });
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout process');
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
      toast.error('Failed to open billing portal');
    } finally {
      setIsProcessing(false);
    }
  };

  const isActive = school?.subscription_status === 'active' || school?.subscription_status === 'trialing';

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Subscription & Billing"
        description="Manage your school's subscription and payment details"
      />

      {/* Current Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5" />
                Subscription Status
              </CardTitle>
              <CardDescription>
                Manage your plan, billing, and payment details
              </CardDescription>
            </div>
            {isActive && (
              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-sm px-3 py-1">
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isActive ? (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
                  <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-2">Plan Type</p>
                  <p className="text-2xl font-bold text-blue-900 capitalize">{school.subscription_plan}</p>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200">
                  <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide mb-2">Next Billing Date</p>
                  <p className="text-2xl font-bold text-emerald-900">
                    {school.subscription_current_period_end 
                      ? new Date(school.subscription_current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : 'N/A'
                    }
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {school.subscription_current_period_end 
                      ? new Date(school.subscription_current_period_end).toLocaleDateString('en-US', { year: 'numeric' })
                      : ''
                    }
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200">
                  <p className="text-xs font-medium text-violet-700 uppercase tracking-wide mb-2">Admin Seats</p>
                  <p className="text-2xl font-bold text-violet-900">
                    {schoolAdmins.length} / {school.max_admin_seats || 3}
                  </p>
                  <p className="text-xs text-violet-600 mt-1">seats used</p>
                </div>
              </div>

              <div className="space-y-3">
                <Button 
                  size="lg"
                  variant="outline" 
                  className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={handleManageSubscription}
                  disabled={isProcessing}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Manage Subscription
                </Button>
                
                <Button 
                  size="lg" 
                  variant="outline"
                  className="w-full font-semibold border-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => setInviteDialogOpen(true)}
                  disabled={isProcessing || schoolAdmins.length >= (school?.max_admin_seats || 3)}
                >
                  <Mail className="w-5 h-5 mr-2" />
                  Invite School Admin
                </Button>
              </div>

              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> Manage your payment method, view invoices, and update subscription through Stripe's billing portal.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Monthly Plan */}
                <div 
                  className={`p-6 rounded-xl border-2 transition-all cursor-pointer ${
                    selectedPlan === 'monthly' 
                      ? 'border-blue-900 bg-blue-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => setSelectedPlan('monthly')}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Monthly</h3>
                      <p className="text-sm text-slate-600">Pay as you go</p>
                    </div>
                    {selectedPlan === 'monthly' && (
                      <CheckCircle2 className="w-6 h-6 text-blue-900" />
                    )}
                  </div>
                  <div className="mb-4">
                    <div className="text-3xl font-bold text-blue-900">
                      $199 <span className="text-lg font-normal text-slate-600">/ month</span>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2 text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>All features included</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>3 admin seats</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>Cancel anytime</span>
                    </li>
                  </ul>
                </div>

                {/* Yearly Plan */}
                <div 
                  className={`p-6 rounded-xl border-2 transition-all cursor-pointer relative ${
                    selectedPlan === 'yearly' 
                      ? 'border-blue-900 bg-blue-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => setSelectedPlan('yearly')}
                >
                  <div className="absolute -top-3 right-4">
                    <span className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-full">
                      Save 17%
                    </span>
                  </div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Yearly</h3>
                      <p className="text-sm text-slate-600">Best value</p>
                    </div>
                    {selectedPlan === 'yearly' && (
                      <CheckCircle2 className="w-6 h-6 text-blue-900" />
                    )}
                  </div>
                  <div className="mb-4">
                    <div className="text-3xl font-bold text-blue-900">
                      $1,999 <span className="text-lg font-normal text-slate-600">/ year</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">$166/month billed annually</p>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2 text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>All features included</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>3 admin seats</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>Priority support</span>
                    </li>
                    <li className="flex items-center gap-2 text-green-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>Save $389/year</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-3">What's included:</h4>
                <div className="grid sm:grid-cols-2 gap-2 text-sm text-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span>Unlimited schedules</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span>AI optimization</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span>Conflict detection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span>Export to PDF/Excel</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span>Secure cloud storage</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span>Email support</span>
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => handleSubscribe(selectedPlan)}
                disabled={isProcessing}
                size="lg"
                className="w-full bg-blue-900 hover:bg-blue-800"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Subscribe ${selectedPlan === 'yearly' ? 'Yearly' : 'Monthly'}`
                )}
              </Button>

              <p className="text-center text-sm text-slate-600">
                Secure payment powered by Stripe • Cancel anytime
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-slate-900 mb-2 text-lg">Need Help?</p>
              <p className="text-slate-700 mb-3">
                Have questions about your subscription, billing, or need to make changes? We're here to help!
              </p>
              <p className="text-sm text-slate-600">
                Email us at <a href="mailto:support@schedual-pro.com" className="text-blue-700 font-semibold hover:underline">support@schedual-pro.com</a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                    Available Seats: {(school?.max_admin_seats || 3) - schoolAdmins.length} / {school?.max_admin_seats || 3}
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
              onClick={() => {
                if (inviteEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
                  inviteUserMutation.mutate(inviteEmail);
                }
              }}
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