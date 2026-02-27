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
import { Navigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { toast } from 'sonner';

export default function Subscription() {
  return <Navigate to={createPageUrl('SubscriptionTiered')} replace />;
  const [isProcessing, setIsProcessing] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [buySeatsDialogOpen, setBuySeatsDialogOpen] = useState(false);
  const [seatsQuantity, setSeatsQuantity] = useState(1);

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

  const handleSubscribe = async () => {
    setIsProcessing(true);
    try {
      const { data } = await base44.functions.invoke('createCheckout', {});
      
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

  const handleBuySeats = async () => {
    setIsProcessing(true);
    try {
      const { data } = await base44.functions.invoke('createCheckout', {
        additional_seats: seatsQuantity
      });
      
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
                  className="w-full font-semibold border-2 border-violet-300 text-violet-700 hover:bg-violet-50"
                  onClick={() => setBuySeatsDialogOpen(true)}
                  disabled={isProcessing}
                >
                  <UserPlus className="w-5 h-5 mr-2" />
                  Buy Additional Admin Seats
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
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-blue-900" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Start Your Subscription</h3>
                <p className="text-slate-600 max-w-md mx-auto">
                  Get full access to IB scheduling platform with AI-powered features
                </p>
              </div>

              <div className="max-w-md mx-auto">
                <div className="p-8 rounded-2xl border-2 border-blue-900 bg-gradient-to-br from-blue-50 to-white">
                  <div className="text-center mb-6">
                    <div className="text-5xl font-bold text-blue-900 mb-2">
                      €1,999
                    </div>
                    <p className="text-slate-600">per year</p>
                    <p className="text-sm text-slate-500 mt-1">Only €166/month billed annually</p>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="text-slate-700">Full dashboard access</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="text-slate-700">3 admin seats included</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="text-slate-700">AI-powered scheduling</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="text-slate-700">Unlimited schedules</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="text-slate-700">Conflict detection & resolution</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="text-slate-700">Export to PDF/Excel</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="text-slate-700">Priority support</span>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-100 rounded-lg mb-6">
                    <p className="text-xs text-blue-900 text-center">
                      <strong>Need more admins?</strong> Purchase additional seats at €199/year each after subscribing
                    </p>
                  </div>

                  <Button 
                    onClick={handleSubscribe}
                    disabled={isProcessing}
                    size="lg"
                    className="w-full bg-blue-900 hover:bg-blue-800 text-lg py-6"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Subscribe Now - €1,999/year
                      </>
                    )}
                  </Button>

                  <p className="text-center text-xs text-slate-500 mt-4">
                    Secure payment powered by Stripe
                  </p>
                </div>
              </div>
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

      {/* Buy Additional Seats Dialog */}
      <Dialog open={buySeatsDialogOpen} onOpenChange={setBuySeatsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buy Additional Admin Seats</DialogTitle>
            <DialogDescription>
              Expand your team with more administrator accounts - €199/year per seat
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-violet-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-violet-900">
                    Current Seats: {school?.max_admin_seats || 3}
                  </p>
                  <p className="text-xs text-violet-700 mt-1">
                    {schoolAdmins.length} seat(s) in use
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="seats-quantity">Number of Additional Seats</Label>
              <Input 
                id="seats-quantity"
                type="number"
                min="1"
                max="50"
                value={seatsQuantity}
                onChange={(e) => setSeatsQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-600">Seats to add</span>
                <span className="font-semibold">{seatsQuantity}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-600">Price per seat</span>
                <span className="font-semibold">€199/year</span>
              </div>
              <div className="border-t border-slate-200 mt-3 pt-3 flex justify-between items-center">
                <span className="font-bold text-lg">Total</span>
                <span className="font-bold text-2xl text-blue-900">€{seatsQuantity * 199}/year</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuySeatsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-violet-600 hover:bg-violet-700"
              onClick={handleBuySeats}
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
                  Purchase Seats
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