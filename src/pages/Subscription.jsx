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
  Shield,
  ExternalLink,
  XCircle
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
      console.log('Starting checkout with:', { additionalUsers });
      const response = await base44.functions.invoke('createCheckout', {
        additionalUsers
      });

      console.log('Checkout response:', response);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error('No checkout URL received from Stripe');
      }
    } catch (error) {
      console.error('=== CHECKOUT ERROR DEBUG ===');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response);
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);

      let errorMessage = 'Payment Error:\n\n';

      // Check if it's an axios response error
      if (error.response?.data) {
        const errorData = error.response.data;
        console.error('Parsed error data:', errorData);
        
        errorMessage += errorData.error || 'Unknown error occurred';
        
        if (errorData.code) {
          errorMessage += `\n\nStripe Error Code: ${errorData.code}`;
        }
        if (errorData.param) {
          errorMessage += `\nProblem with: ${errorData.param}`;
        }
        if (errorData.type) {
          errorMessage += `\nError Type: ${errorData.type}`;
        }
        if (errorData.statusCode) {
          errorMessage += `\nStatus: ${errorData.statusCode}`;
        }
      } else {
        errorMessage += error.message || 'Unknown error';
      }

      alert(errorMessage);
      setIsProcessing(false);
    }
  };

  const isActive = school?.subscription_status === 'active';
  const isPastDue = school?.subscription_status === 'past_due';

  const handleManageSubscription = () => {
    if (school?.stripe_customer_id) {
      // Redirect to Stripe Customer Portal
      window.open(`https://billing.stripe.com/p/login/test_${school.stripe_customer_id}`, '_blank');
    } else {
      alert('No Stripe customer ID found. Please contact support.');
    }
  };

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
            {isPastDue && (
              <Badge className="bg-amber-100 text-amber-700 border-0 text-sm px-3 py-1">
                <AlertCircle className="w-4 h-4 mr-1.5" />
                Payment Required
              </Badge>
            )}
            {!isActive && !isPastDue && (
              <Badge variant="outline" className="text-slate-600 text-sm px-3 py-1">
                Inactive
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
                  <p className="text-2xl font-bold text-blue-900">Yearly</p>
                  <p className="text-xs text-blue-600 mt-1">€{(BASE_YEARLY_PRICE + STORAGE_YEARLY_PRICE) / 12}/month</p>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200">
                  <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide mb-2">Next Billing Date</p>
                  <p className="text-2xl font-bold text-emerald-900">
                    {school.subscription_end_date 
                      ? new Date(school.subscription_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : 'N/A'
                    }
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {school.subscription_end_date 
                      ? new Date(school.subscription_end_date).toLocaleDateString('en-US', { year: 'numeric' })
                      : ''
                    }
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200">
                  <p className="text-xs font-medium text-violet-700 uppercase tracking-wide mb-2">Extra Users</p>
                  <p className="text-2xl font-bold text-violet-900">
                    {school.max_additional_users || 0}
                  </p>
                  <p className="text-xs text-violet-600 mt-1">additional seats</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200">
                <Button 
                  variant="outline" 
                  className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={handleManageSubscription}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Manage Payment Methods
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50"
                  onClick={handleManageSubscription}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel Subscription
                </Button>
              </div>

              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> Clicking these buttons will redirect you to Stripe's secure portal where you can manage your subscription, update payment methods, view invoices, and cancel if needed.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Active Subscription</h3>
              <p className="text-slate-600 mb-6 max-w-md mx-auto">
                Subscribe now to unlock AI-powered scheduling, conflict resolution, and IB compliance features for your school.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Calculator */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50">
        <CardHeader>
          <CardTitle className="text-3xl bg-gradient-to-r from-blue-900 to-violet-900 bg-clip-text text-transparent">
            Yearly Subscription
          </CardTitle>
          <CardDescription className="text-base">
            Complete scheduling solution with AI-powered features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Base Price Breakdown */}
          <div className="space-y-3">
            <div className="flex justify-between items-center p-5 rounded-xl bg-white shadow-sm border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-lg">Base Platform</p>
                  <p className="text-sm text-slate-600">Full scheduling + AI features</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">€{BASE_YEARLY_PRICE}</p>
                <p className="text-xs text-slate-500">/year</p>
              </div>
            </div>

            <div className="flex justify-between items-center p-5 rounded-xl bg-white shadow-sm border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
                  <Database className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-lg">Cloud Storage</p>
                  <p className="text-sm text-slate-600">Secure & backed up (€20/month)</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">€{STORAGE_YEARLY_PRICE}</p>
                <p className="text-xs text-slate-500">/year</p>
              </div>
            </div>

            {/* Additional Users */}
            <div className="p-6 rounded-xl bg-white shadow-sm border-2 border-emerald-200">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-lg">Extra User Accounts</p>
                    <p className="text-sm text-slate-600">€{ADDITIONAL_USER_YEARLY_PRICE}/year per additional user</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Label className="text-slate-700 font-medium">How many extra users?</Label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-lg"
                    onClick={() => setAdditionalUsers(Math.max(0, additionalUsers - 1))}
                    disabled={additionalUsers === 0}
                  >
                    <Minus className="w-5 h-5" />
                  </Button>
                  <Input
                    type="number"
                    min="0"
                    value={additionalUsers}
                    onChange={(e) => setAdditionalUsers(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-24 text-center text-xl font-bold h-10"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-lg"
                    onClick={() => setAdditionalUsers(additionalUsers + 1)}
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>
                <div className="text-right ml-auto">
                  <p className="text-2xl font-bold text-emerald-700">
                    €{additionalUsers * ADDITIONAL_USER_YEARLY_PRICE}
                  </p>
                  <p className="text-xs text-slate-500">/year</p>
                </div>
              </div>
            </div>
          </div>

          {/* Total */}
          <div className="border-t-2 border-slate-200 pt-6 mt-2">
            <div className="flex justify-between items-center p-6 rounded-xl bg-gradient-to-r from-blue-900 to-violet-900 text-white">
              <div>
                <p className="text-sm font-medium opacity-90 mb-1">Total Annual Price</p>
                <p className="text-4xl font-bold">€{totalYearlyPrice}</p>
                <p className="text-sm opacity-75 mt-2">
                  That's just €{Math.round(totalYearlyPrice / 12)}/month • Cancel anytime
                </p>
              </div>
              <div className="text-right">
                <Badge className="bg-white/20 text-white border-0 text-sm px-3 py-1.5">
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  Best Value
                </Badge>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="grid sm:grid-cols-2 gap-3">
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
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/50">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <span className="text-sm font-medium text-slate-800">{feature}</span>
              </div>
            ))}
          </div>

          {/* Checkout Button */}
          <Button
            className="w-full py-7 text-xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-xl hover:shadow-2xl transition-all duration-200 transform hover:scale-[1.02]"
            onClick={handleCheckout}
            disabled={isProcessing || isActive}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                Processing Payment...
              </>
            ) : isActive ? (
              <>
                <CheckCircle className="w-6 h-6 mr-2" />
                Already Subscribed
              </>
            ) : (
              <>
                <CreditCard className="w-6 h-6 mr-2" />
                Subscribe Now - €{totalYearlyPrice}/year
              </>
            )}
          </Button>

          <div className="text-center space-y-2">
            <p className="text-sm text-slate-600 flex items-center justify-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              Secure payment via Stripe • 30-day money-back guarantee
            </p>
          </div>
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
    </div>
  );
}