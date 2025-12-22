import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  CreditCard, 
  Users, 
  Database, 
  CheckCircle, 
  AlertCircle,
  Plus,
  Minus,
  Loader2,
  Shield
} from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';

const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const BASE_YEARLY_PRICE = 1999;
const STORAGE_YEARLY_PRICE = 240;
const ADDITIONAL_USER_YEARLY_PRICE = 200;

export default function Subscription() {
  const [additionalUsers, setAdditionalUsers] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasTriedAutoCheckout, setHasTriedAutoCheckout] = useState(false);

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

  const totalYearlyPrice = BASE_YEARLY_PRICE + STORAGE_YEARLY_PRICE + (additionalUsers * ADDITIONAL_USER_YEARLY_PRICE);

  const handleCheckout = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      const response = await base44.functions.invoke('createCheckout', {
        additionalUsers
      });

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      console.error('Full error response:', error.response?.data);
      alert('Payment processing failed: ' + (error.response?.data?.error || error.message));
      setIsProcessing(false);
    }
  };

  const isActive = school?.subscription_status === 'active';
  const isPastDue = school?.subscription_status === 'past_due';

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Subscription & Billing"
        description="Manage your school's subscription and payment details"
      />

      {/* Current Status */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Subscription Status
            </CardTitle>
            {isActive && (
              <Badge className="bg-emerald-100 text-emerald-700 border-0">
                <CheckCircle className="w-3 h-3 mr-1" />
                Active
              </Badge>
            )}
            {isPastDue && (
              <Badge className="bg-amber-100 text-amber-700 border-0">
                <AlertCircle className="w-3 h-3 mr-1" />
                Payment Required
              </Badge>
            )}
            {!isActive && !isPastDue && (
              <Badge variant="outline" className="text-slate-600">
                Inactive
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isActive ? (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-slate-50">
                  <p className="text-sm text-slate-500 mb-1">Plan</p>
                  <p className="text-lg font-semibold text-slate-900">Yearly</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50">
                  <p className="text-sm text-slate-500 mb-1">Next Billing</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {school.subscription_end_date 
                      ? new Date(school.subscription_end_date).toLocaleDateString()
                      : 'N/A'
                    }
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50">
                  <p className="text-sm text-slate-500 mb-1">Additional Users</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {school.max_additional_users || 0} seats
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Active Subscription</h3>
              <p className="text-slate-600 mb-4">
                Subscribe to unlock full access to Schedual
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Calculator */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-violet-50">
        <CardHeader>
          <CardTitle className="text-2xl">Yearly Subscription</CardTitle>
          <CardDescription>All-inclusive pricing with secure data storage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Base Price Breakdown */}
          <div className="space-y-3">
            <div className="flex justify-between items-center p-4 rounded-lg bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Base Platform</p>
                  <p className="text-sm text-slate-500">Full scheduling features</p>
                </div>
              </div>
              <p className="text-lg font-bold text-slate-900">€{BASE_YEARLY_PRICE}/year</p>
            </div>

            <div className="flex justify-between items-center p-4 rounded-lg bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Database className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Secure Data Storage</p>
                  <p className="text-sm text-slate-500">€20/month included</p>
                </div>
              </div>
              <p className="text-lg font-bold text-slate-900">€{STORAGE_YEARLY_PRICE}/year</p>
            </div>

            {/* Additional Users */}
            <div className="p-4 rounded-lg bg-white border-2 border-indigo-200">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Additional User Accounts</p>
                    <p className="text-sm text-slate-500">€{ADDITIONAL_USER_YEARLY_PRICE}/year per account</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Label className="text-slate-700">Number of extra accounts:</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setAdditionalUsers(Math.max(0, additionalUsers - 1))}
                    disabled={additionalUsers === 0}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    min="0"
                    value={additionalUsers}
                    onChange={(e) => setAdditionalUsers(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-20 text-center"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setAdditionalUsers(additionalUsers + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-lg font-bold text-slate-900 ml-auto">
                  €{additionalUsers * ADDITIONAL_USER_YEARLY_PRICE}/year
                </p>
              </div>
            </div>
          </div>

          {/* Total */}
          <div className="border-t-2 border-indigo-200 pt-4">
            <div className="flex justify-between items-center">
              <p className="text-xl font-bold text-slate-900">Total Yearly Price</p>
              <p className="text-3xl font-bold text-indigo-600">€{totalYearlyPrice}/year</p>
            </div>
            <p className="text-sm text-slate-500 text-right mt-1">
              Billed annually • Cancel anytime
            </p>
          </div>

          {/* Features */}
          <div className="grid sm:grid-cols-2 gap-3 pt-4">
            {[
              'Unlimited teachers & students',
              'AI-powered scheduling',
              'Conflict resolution',
              'IB compliance checking',
              'Secure cloud storage',
              'Priority support',
              'Regular updates',
              'Export & reporting'
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-sm text-slate-700">{feature}</span>
              </div>
            ))}
          </div>

          {/* Checkout Button */}
          <Button
            className="w-full py-6 text-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
            onClick={handleCheckout}
            disabled={isProcessing || isActive}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : isActive ? (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Already Subscribed
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Subscribe Now - €{totalYearlyPrice}/year
              </>
            )}
          </Button>

          <p className="text-xs text-center text-slate-500">
            Secure payment via Stripe • 30-day money-back guarantee
          </p>
        </CardContent>
      </Card>

      {/* Manage Subscription for Active Users */}
      {isActive && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Add More User Accounts
            </CardTitle>
            <CardDescription>
              Need more team members? Add additional user accounts to your subscription.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-slate-900">Current Additional Users</p>
                  <p className="text-sm text-slate-500">Extra accounts beyond base subscription</p>
                </div>
                <Badge className="bg-indigo-100 text-indigo-700 border-0">
                  {school.max_additional_users || 0} accounts
                </Badge>
              </div>
              <p className="text-sm text-slate-600">
                To modify your user count, please contact support or manage your subscription through the Stripe customer portal.
              </p>
            </div>
            <Button variant="outline" className="w-full" disabled>
              <CreditCard className="w-4 h-4 mr-2" />
              Manage via Stripe Portal (Coming Soon)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Help Card */}
      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="p-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700">
              <p className="font-semibold mb-2">Need Help?</p>
              <p className="mb-3">
                If you have questions about your subscription, billing, or need to make changes, contact us at support@ibschedule.com
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}