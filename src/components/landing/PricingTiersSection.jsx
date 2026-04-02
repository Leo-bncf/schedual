import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  Zap,
  School,
  Users,
  Calendar,
  LifeBuoy,
  FileSpreadsheet,
  Wrench,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import PricingTierSwitch from './PricingTierSwitch';

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

  const tierOptions = useMemo(
    () => Object.entries(TIERS).map(([value, tier]) => ({ value, label: tier.name })),
    []
  );

  const selectedTier = TIERS[expandedTier];

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

    try {
      const response = await base44.functions.invoke('createStripeCheckout', {
        priceId,
        tier: tierId,
      });

      if (response?.data?.url) {
        window.location.href = response.data.url;
        return;
      }
    } catch (error) {
      console.error('Checkout start failed:', error);
    }

    alert('Unable to start checkout right now.');
    setLoadingTier(null);
  };

  return (
    <section id="pricing" className="relative overflow-hidden bg-white py-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.16),_transparent_55%)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            <Zap className="h-4 w-4 fill-current" />
            Choose your school tier
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Cleaner pricing, same checkout flow
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Pick a plan and continue to secure checkout. Your school limits for students, schedule versions, admin seats, and support all follow the selected tier.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl">
          <PricingTierSwitch options={tierOptions} value={expandedTier} onChange={setExpandedTier} />
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <motion.div
            key={expandedTier}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] sm:p-8"
          >
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-3xl font-bold text-slate-900">{selectedTier.name}</h3>
                  {selectedTier.featured ? <Badge className="bg-yellow-400 text-slate-900">Recommended</Badge> : null}
                </div>
                <p className="mt-3 max-w-2xl text-slate-600">{selectedTier.subtitle}</p>
              </div>
              <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
                <div className="text-sm uppercase tracking-[0.18em] text-blue-200">Annual price</div>
                <div className="mt-2 text-4xl font-bold">{selectedTier.price}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {selectedTier.highlights.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <item.icon className="mb-3 h-5 w-5 text-blue-700" />
                  <div className="text-xl font-bold text-slate-900">{item.value}</div>
                  <div className="text-sm text-slate-500">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {selectedTier.rules.map((rule) => (
                <div key={rule} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mt-0.5 rounded-full bg-emerald-100 p-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="text-slate-700">{rule}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            key={`${expandedTier}-summary`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className="rounded-[2rem] border border-slate-900 bg-slate-900 p-6 text-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.65)] sm:p-8"
          >
            <p className="text-sm uppercase tracking-[0.2em] text-blue-200">What this controls</p>
            <h3 className="mt-3 text-2xl font-bold">{selectedTier.name} rules applied across your school</h3>
            <div className="mt-6 space-y-3 text-sm text-slate-200">
              <p>The school can only operate within the limits of this tier.</p>
              <p>Student capacity is capped by the selected plan.</p>
              <p>Saved schedule versions follow the plan allowance.</p>
              <p>Admin accounts are limited by the plan.</p>
              <p>Support response level follows the selected plan.</p>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-blue-100">Already have an account? You’ll go straight to payment. New user? You’ll create your account first.</p>
            </div>

            <Button
              type="button"
              className="mt-6 h-12 w-full rounded-full bg-white text-slate-900 font-semibold hover:bg-slate-100"
              onClick={async () => {
                await handleCheckout(selectedTier.priceId, expandedTier);
              }}
              disabled={loadingTier === expandedTier}
            >
              {loadingTier === expandedTier ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  <span>Buy {selectedTier.name}</span>
                  <ArrowRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </motion.div>
        </div>

        <div className="mt-20">
          <div className="mb-10 text-center">
            <h3 className="text-3xl font-bold text-slate-900">How the tier system works in practice</h3>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
              The same school management platform is available across tiers, but each school is governed by the rules of its plan.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SYSTEM_RULES.map((rule) => (
              <div key={rule.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <rule.icon className="mb-4 h-6 w-6 text-blue-900" />
                <h4 className="mb-2 text-lg font-semibold text-slate-900">{rule.title}</h4>
                <p className="text-sm leading-relaxed text-slate-600">{rule.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}