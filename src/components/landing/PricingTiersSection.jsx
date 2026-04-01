import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronDown, School, Users, Calendar, LifeBuoy, FileSpreadsheet, Wrench, ArrowRight, Loader2 } from 'lucide-react';

const TIERS = {
  tier1: {
    name: 'Starter',
    price: '€599/year',
    priceId: 'price_1THYLAD8slkoqOiBqzij9LlB',
    subtitle: 'Best for smaller schools starting with structured timetable management',
    rules: [
      'Up to 200 students',
      '3 saved schedule versions',
      'Auto generation + manual adjustments',
      'PDF & Excel export',
      '1 admin account',
      'Email support (48h)',
    ],
    highlights: [
      { icon: School, label: 'Student limit', value: '200' },
      { icon: Calendar, label: 'Saved versions', value: '3' },
      { icon: Users, label: 'Admin accounts', value: '1' },
    ],
    featured: false,
  },
  tier2: {
    name: 'Standard',
    price: '€1,499/year',
    priceId: 'price_1THYLAD8slkoqOiBI0rA7cCR',
    subtitle: 'Best for growing schools that need flexibility and multiple admin users',
    rules: [
      'Up to 600 students',
      'Unlimited generations',
      'Auto generation + manual adjustments',
      'PDF & Excel export',
      'Multiple saved versions',
      '3 admin accounts',
      'Email support (24h)',
    ],
    highlights: [
      { icon: School, label: 'Student limit', value: '600' },
      { icon: Calendar, label: 'Saved versions', value: 'Multiple' },
      { icon: Users, label: 'Admin accounts', value: '3' },
    ],
    featured: true,
  },
  tier3: {
    name: 'Pro',
    price: '€2,999/year',
    priceId: 'price_1THYLAD8slkoqOiBQCaKAj2z',
    subtitle: 'Best for large schools that need scale, speed, and premium support',
    rules: [
      'Up to 1,200 students',
      'Unlimited generations',
      'Auto generation + manual adjustments',
      'PDF & Excel export',
      'Multiple saved versions',
      'Unlimited admin accounts',
      'Priority support (same day)',
      'Onboarding call included',
    ],
    highlights: [
      { icon: School, label: 'Student limit', value: '1,200' },
      { icon: Calendar, label: 'Saved versions', value: 'Multiple' },
      { icon: Users, label: 'Admin accounts', value: 'Unlimited' },
    ],
    featured: false,
  },
};

const SYSTEM_RULES = [
  {
    icon: School,
    title: 'Student cap by tier',
    description: 'Each school is limited by the number of students allowed in its tier.',
  },
  {
    icon: Calendar,
    title: 'Schedule version rules',
    description: 'Saved schedule versions are controlled by the school tier.',
  },
  {
    icon: Users,
    title: 'Admin access rules',
    description: 'Admin account limits are enforced per school based on its tier.',
  },
  {
    icon: Wrench,
    title: 'Same core scheduling tools',
    description: 'All tiers include auto generation and manual timetable adjustments.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Exports included',
    description: 'Schools can export schedules in PDF and Excel depending on the tier offering.',
  },
  {
    icon: LifeBuoy,
    title: 'Support by tier',
    description: 'Response time and onboarding level improve with higher tiers.',
  },
];

export default function PricingTiersSection() {
  const [expandedTier, setExpandedTier] = useState('tier2');
  const [loadingTier, setLoadingTier] = useState(null);

  const handleCheckout = async (priceId, tierId) => {
    if (window.self !== window.top) {
      alert('Checkout works only from the published app, not inside the preview.');
      return;
    }

    const isAuthenticated = await base44.auth.isAuthenticated();
    if (!isAuthenticated) {
      base44.auth.redirectToLogin(`${window.location.pathname}${window.location.search}${window.location.hash}#pricing`);
      return;
    }

    setLoadingTier(tierId);
    const response = await base44.functions.invoke('createStripeCheckout', {
      priceId,
      tier: tierId,
    });

    if (response?.data?.url) {
      window.location.href = response.data.url;
      return;
    }

    alert('Unable to start checkout right now.');
    setLoadingTier(null);
  };

  return (
    <section id="pricing" className="py-20 bg-white relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
            Tier system for schools
          </h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            Every school belongs to a tier, and the platform applies the rules of that tier automatically across student capacity, saved schedule versions, admin access, and support level.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-10">
          {Object.entries(TIERS).map(([tierId, tier]) => {
            const isExpanded = expandedTier === tierId;
            return (
              <button
                key={tierId}
                className={`rounded-2xl border p-6 text-left transition-all ${isExpanded ? 'border-blue-900 ring-2 ring-blue-900 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50'}`}
                onClick={() => setExpandedTier(isExpanded ? null : tierId)}
                aria-expanded={isExpanded}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">{tier.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{tier.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tier.featured ? <Badge className="bg-yellow-400 text-slate-900">Recommended</Badge> : null}
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-5 h-5 text-slate-500" />
                    </motion.div>
                  </div>
                </div>

                <div className="text-3xl font-bold text-slate-900 mb-5">{tier.price}</div>

                <div className="grid grid-cols-3 gap-3">
                  {tier.highlights.map((item) => (
                    <div key={item.label} className="rounded-xl bg-slate-100 p-3">
                      <item.icon className="w-4 h-4 text-blue-900 mb-2" />
                      <div className="text-sm font-semibold text-slate-900">{item.value}</div>
                      <div className="text-[11px] text-slate-500">{item.label}</div>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {expandedTier && TIERS[expandedTier] ? (
            <motion.div
              key={expandedTier}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden mb-16"
            >
              <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-8">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="text-3xl font-bold text-slate-900">{TIERS[expandedTier].name}</h3>
                    </div>
                    <p className="text-slate-600 mb-6">{TIERS[expandedTier].subtitle}</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {TIERS[expandedTier].rules.map((rule) => (
                        <div key={rule} className="flex items-start gap-3 rounded-xl bg-white p-4 border border-slate-200">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700">{rule}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="lg:w-80 rounded-2xl bg-slate-900 text-white p-6">
                    <p className="text-sm uppercase tracking-wide text-blue-200 mb-3">Applied system rules</p>
                    <div className="space-y-3 text-sm text-slate-200">
                      <p>The school can only operate within the limits of this tier.</p>
                      <p>Student capacity is capped by the tier.</p>
                      <p>Saved schedule versions follow the tier allowance.</p>
                      <p>Admin accounts are limited by the tier.</p>
                      <p>Support level follows the selected plan.</p>
                    </div>
                    <div className="mt-6 pt-6 border-t border-white/10">
                      <Button
                        className="w-full bg-white text-slate-900 hover:bg-slate-100 font-semibold"
                        onClick={() => handleCheckout(TIERS[expandedTier].priceId, expandedTier)}
                        disabled={loadingTier === expandedTier}
                      >
                        {loadingTier === expandedTier ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redirecting...</> : <><span>Buy {TIERS[expandedTier].name}</span><ArrowRight className="w-4 h-4 ml-1" /></>}
                      </Button>
                      <p className="text-xs text-blue-100/80 mt-3">Already have an account? You’ll go straight to payment. New user? You’ll create your account first.</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="mt-20">
          <div className="text-center mb-10">
            <h3 className="text-3xl font-bold text-slate-900">How the tier system works in practice</h3>
            <p className="text-slate-600 mt-3 max-w-2xl mx-auto">
              The same school management platform is available across tiers, but each school is governed by the rules of its plan.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SYSTEM_RULES.map((rule) => (
              <div key={rule.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <rule.icon className="w-6 h-6 text-blue-900 mb-4" />
                <h4 className="text-lg font-semibold text-slate-900 mb-2">{rule.title}</h4>
                <p className="text-slate-600 text-sm leading-relaxed">{rule.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}