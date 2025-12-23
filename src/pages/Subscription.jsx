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

      {/* Hero Section */}
            <div className="text-center py-12 space-y-4">
              <Badge className="bg-purple-100 text-purple-700 border-0 px-4 py-1 text-sm font-medium">
                Most Popular
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900">
                Simple, Transparent Pricing
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                Choose the plan that works best for your school. Cancel anytime.
              </p>
            </div>

            {/* Pricing Calculator */}
            <Card className="border-2 border-indigo-200 shadow-2xl bg-white max-w-2xl mx-auto">
              <CardHeader className="text-center pb-6">
                <Badge className="bg-indigo-600 text-white border-0 px-4 py-1.5 text-sm font-semibold mx-auto mb-4">
                  Yearly Subscription
                </Badge>
                <div className="mb-2">
                  <span className="text-5xl md:text-6xl font-bold text-slate-900">€{totalYearlyPrice}</span>
                  <span className="text-xl text-slate-500 ml-2">/year</span>
                </div>
                <p className="text-slate-600 mt-2">All-inclusive yearly billing with secure storage</p>
              </CardHeader>
              <CardContent className="space-y-6">
          {/* What's Included */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 text-center text-lg mb-4">What's Included</h3>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Full platform access (€1,999/year)</p>
                  <p className="text-sm text-slate-600">Complete scheduling features and AI optimization</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Secure data storage (€240/year)</p>
                  <p className="text-sm text-slate-600">€20/month cloud storage included</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Unlimited teachers and students</p>
                  <p className="text-sm text-slate-600">No limits on your school size</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">AI-powered scheduling</p>
                  <p className="text-sm text-slate-600">Smart conflict detection and resolution</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">IB compliance checking</p>
                  <p className="text-sm text-slate-600">Automatic validation of IB requirements</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Priority support</p>
                  <p className="text-sm text-slate-600">Get help when you need it most</p>
                </div>
              </div>
            </div>
          </div>

            {/* Additional Users */}
            <div className="border-t pt-6">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border-2 border-indigo-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Additional User Accounts</p>
                    <p className="text-sm text-slate-600">€{ADDITIONAL_USER_YEARLY_PRICE}/year per extra account</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-lg">
                  <Label className="text-slate-700 font-medium whitespace-nowrap">Extra accounts needed:</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
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
                      className="w-24 text-center text-lg font-semibold"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => setAdditionalUsers(additionalUsers + 1)}
                    >
                      <Plus className="w-5 h-5" />
                    </Button>
                  </div>
                  {additionalUsers > 0 && (
                    <div className="ml-auto bg-indigo-100 px-4 py-2 rounded-lg">
                      <p className="text-sm text-indigo-600 font-medium">+€{additionalUsers * ADDITIONAL_USER_YEARLY_PRICE}/year</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          {/* Checkout Button */}
          <div className="border-t-2 border-slate-200 pt-6 space-y-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-lg font-semibold text-slate-700">Total</span>
              <div className="text-right">
                <p className="text-3xl font-bold text-indigo-600">€{totalYearlyPrice}</p>
                <p className="text-sm text-slate-500">per year, billed annually</p>
              </div>
            </div>

            <Button
              className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg hover:shadow-xl transition-all"
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
                  Subscribe Now
                </>
              )}
            </Button>

            <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>Secure payment via Stripe • 30-day money-back guarantee</span>
            </div>
          </div>
        </CardContent>
        </Card>

        {/* Trust Section */}
        <div className="text-center py-8">
        <p className="text-slate-600 font-medium">Trusted by IB schools worldwide</p>
        </div>

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
                If you have questions about your subscription, billing, or need to make changes, contact us at support@schedual-pro.com
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}