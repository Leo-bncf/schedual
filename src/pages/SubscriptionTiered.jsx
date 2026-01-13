import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Star,
  Zap,
  Globe,
} from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import { loadStripe } from '@stripe/stripe-js';
import { toast } from 'sonner';

const TIERS = {
  tier1: {
    name: 'Tier 1',
    subtitle: 'Small IB Schools',
    price: 1100,
    description: 'PYP-only or MYP-only schools up to 300 students',
    students: '≤300',
    icon: '🌱',
    features: [
      'Full timetable generation',
      'Teacher & room constraints',
      'IB logic & validation',
      'PDF/CSV export',
      'Manual ManageBac import',
    ],
    color: 'from-blue-50 to-blue-100',
    borderColor: 'border-blue-300',
  },
  tier2: {
    name: 'Tier 2',
    subtitle: 'Standard IB Continuum',
    price: 2200,
    description: 'PYP + MYP + DP schools (300-800 students)',
    students: '300-800',
    icon: '⭐',
    features: [
      'Everything in Tier 1',
      'Advanced constraint solver',
      'DP subject grouping & options',
      'Teacher load balancing',
      'Timetable versioning & history',
      'Priority email support',
    ],
    color: 'from-purple-50 to-purple-100',
    borderColor: 'border-purple-300',
    featured: true,
  },
  tier3: {
    name: 'Tier 3',
    subtitle: 'Large/Multi-Campus',
    price: 4950,
    description: 'Large schools with 800+ students, multiple campuses',
    students: '800+',
    icon: '🚀',
    features: [
      'Everything in Tier 2',
      'Multi-campus support',
      'Multiple timetable scenarios',
      'API & ManageBac integration',
      'Dedicated onboarding',
      'Dedicated account manager',
    ],
    color: 'from-emerald-50 to-emerald-100',
    borderColor: 'border-emerald-300',
  },
};

const ADD_ONS = [
  {
    category: 'Users',
    items: [
      { id: 'extra_admin_user', name: 'Extra Admin User', price: 275, type: 'yearly' },
      { id: 'unlimited_admin_users', name: 'Unlimited Admin Users', price: 825, type: 'yearly' },
    ],
  },
  {
    category: 'School Structure',
    items: [
      { id: 'additional_campus', name: 'Additional Campus', price: 660, type: 'yearly' },
      { id: 'unlimited_campuses', name: 'Unlimited Campuses', price: 1650, type: 'yearly' },
      { id: 'multiple_timetable_scenarios', name: 'Multiple Timetable Scenarios', price: 880, type: 'yearly' },
    ],
  },
  {
    category: 'Integrations',
    items: [
      { id: 'managebac_integration', name: 'ManageBac Integration (API Sync)', price: 1100, type: 'yearly' },
      { id: 'custom_sis_integration_yearly', name: 'Custom SIS/LMS Integration (Yearly)', price: 550, type: 'yearly' },
    ],
  },
  {
    category: 'Scheduling Features',
    items: [
      { id: 'advanced_constraint_engine', name: 'Advanced Constraint Engine', price: 660, type: 'yearly' },
      { id: 'dp_advanced_logic', name: 'DP Advanced Logic', price: 770, type: 'yearly' },
    ],
  },
  {
    category: 'Support & Services',
    items: [
      { id: 'priority_support', name: 'Priority Support (24h)', price: 550, type: 'yearly' },
      { id: 'dedicated_account_manager', name: 'Dedicated Account Manager', price: 1100, type: 'yearly' },
      { id: 'onboarding_setup', name: 'Onboarding & First Setup', price: 1320, type: 'onetime' },
    ],
  },
];

export default function SubscriptionTiered() {
  const [selectedTier, setSelectedTier] = useState('tier2');
  const [selectedAddOns, setSelectedAddOns] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddOnsDialog, setShowAddOnsDialog] = useState(false);

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
  const isActive = school?.subscription_status === 'active' || school?.subscription_status === 'trialing';

  const handleToggleAddOn = (addonId) => {
    setSelectedAddOns((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );
  };

  const calculateTotal = () => {
    const tierPrice = TIERS[selectedTier].price;
    const addOnPrice = selectedAddOns.reduce((sum, addonId) => {
      const addon = ADD_ONS.flatMap((cat) => cat.items).find((item) => item.id === addonId);
      return sum + (addon?.price || 0);
    }, 0);
    return tierPrice + addOnPrice;
  };

  const handleSubscribe = async () => {
    // Block in-builder iframe to avoid Stripe refusing to load inside iframes
    if (window.self !== window.top) {
      alert('Checkout can only be started from the published app (not the preview). Please open the app in a new tab and try again.');
      return;
    }

    setIsProcessing(true);
    try {
      const { data } = await base44.functions.invoke('tieredCheckout', {
        tier: selectedTier,
        add_ons: selectedAddOns,
        customer_email: user?.email || undefined,
      });

      if (data?.url) {
        window.location.assign(data.url);
        return;
      }

      if (data?.sessionId) {
        // Prefer STRIPE_PUBLISHABLE_KEY if present, fallback to VITE_STRIPE_PUBLIC_KEY
        const pk = import.meta.env.STRIPE_PUBLISHABLE_KEY || import.meta.env.VITE_STRIPE_PUBLIC_KEY;
        if (!pk) {
          toast.error('Stripe public key is missing. Please set STRIPE_PUBLISHABLE_KEY.');
          return;
        }
        const stripe = await loadStripe(pk);
        const result = await stripe.redirectToCheckout({ sessionId: data.sessionId });
        if (result?.error) {
          toast.error(result.error.message || 'Stripe redirection failed');
        }
        return;
      }

      toast.error('Could not start checkout. Please try again.');
    } catch (error) {
      const message = error?.response?.data?.error || error.message || 'Failed to start checkout process';
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isActive) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Subscription & Billing"
          description="Manage your school's subscription and payment details"
        />
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-200 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-700" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-900 mb-2">Active Subscription</h2>
            <p className="text-emerald-700 mb-6">
              Your school is currently subscribed to {TIERS[school?.subscription_tier]?.name}
            </p>
            <div className="inline-block">
              <Badge className="bg-emerald-600 px-4 py-2 text-lg">
                {TIERS[school?.subscription_tier]?.subtitle}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Choose Your Subscription Plan"
        description="Select a tier that fits your school's needs and add optional features"
      />

      {/* Tier Selection */}
      <div className="grid md:grid-cols-3 gap-6">
        {Object.entries(TIERS).map(([tierId, tier]) => (
          <div
            key={tierId}
            className={`cursor-pointer transition-all ${
              selectedTier === tierId ? 'ring-2 ring-blue-900' : ''
            }`}
            onClick={() => setSelectedTier(tierId)}
          >
            <Card className={`h-full bg-gradient-to-br ${tier.color} border-2 ${tier.borderColor}`}>
              <CardHeader>
                {tier.featured && (
                  <div className="mb-3">
                    <Badge className="bg-yellow-500 text-white">Most Popular</Badge>
                  </div>
                )}
                <div className="text-4xl mb-3">{tier.icon}</div>
                <CardTitle className="text-xl">{tier.subtitle}</CardTitle>
                <CardDescription className="text-base">{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-900">${tier.price}</div>
                  <div className="text-sm text-slate-600">/year</div>
                </div>

                <div className="bg-white/60 rounded-lg p-3">
                  <p className="text-sm text-slate-600">
                    <strong>For:</strong> {tier.students} students
                  </p>
                </div>

                <div className="space-y-2">
                  {tier.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  variant={selectedTier === tierId ? 'default' : 'outline'}
                  className={`w-full ${selectedTier === tierId ? 'bg-blue-900 hover:bg-blue-800' : ''}`}
                  onClick={() => setSelectedTier(tierId)}
                >
                  {selectedTier === tierId ? '✓ Selected' : 'Select'}
                </Button>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Add-ons Section */}
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Optional Add-ons
          </CardTitle>
          <CardDescription>Enhance your subscription with additional features</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full border-2 border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={() => setShowAddOnsDialog(true)}
          >
            {selectedAddOns.length > 0
              ? `${selectedAddOns.length} add-on(s) selected`
              : 'Browse Add-ons'}
          </Button>
        </CardContent>
      </Card>

      {/* Pricing Summary */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300">
        <CardHeader>
          <CardTitle>Your Package</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-slate-700">{TIERS[selectedTier].subtitle}</span>
            <span className="font-semibold">${TIERS[selectedTier].price}/year</span>
          </div>

          {selectedAddOns.length > 0 && (
            <>
              <div className="border-t border-blue-200 pt-3">
                <p className="text-sm font-semibold text-slate-600 mb-2">Add-ons:</p>
                {selectedAddOns.map((addonId) => {
                  const addon = ADD_ONS.flatMap((cat) => cat.items).find((item) => item.id === addonId);
                  return (
                    <div key={addonId} className="flex justify-between text-sm">
                      <span className="text-slate-600">{addon?.name}</span>
                      <span className="font-medium">${addon?.price}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="border-t border-blue-300 pt-3 flex justify-between items-center">
            <span className="text-lg font-bold text-slate-900">Total per year:</span>
            <span className="text-3xl font-bold text-blue-900">${calculateTotal()}</span>
          </div>

          <Button
            onClick={handleSubscribe}
            disabled={isProcessing}
            size="lg"
            className="w-full bg-blue-900 hover:bg-blue-800 text-white py-6 text-lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Subscribe Now
              </>
            )}
          </Button>

          <p className="text-center text-xs text-slate-600">
            Secure payment powered by Stripe
          </p>
        </CardContent>
      </Card>

      {/* Add-ons Dialog */}
      <Dialog open={showAddOnsDialog} onOpenChange={setShowAddOnsDialog}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Optional Features</DialogTitle>
            <DialogDescription>
              Enhance your subscription with additional capabilities
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {ADD_ONS.map((category) => (
              <div key={category.category}>
                <h4 className="font-semibold text-slate-900 mb-3">{category.category}</h4>
                <div className="space-y-2">
                  {category.items.map((addon) => (
                    <div key={addon.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-100">
                      <Checkbox
                        id={addon.id}
                        checked={selectedAddOns.includes(addon.id)}
                        onCheckedChange={() => handleToggleAddOn(addon.id)}
                      />
                      <Label
                        htmlFor={addon.id}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-medium text-slate-900">{addon.name}</div>
                        <div className="text-sm text-slate-600 flex justify-between mt-1">
                          <span>${addon.price}</span>
                          <span className="text-xs">{addon.type === 'onetime' ? 'one-time' : '/year'}</span>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddOnsDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}