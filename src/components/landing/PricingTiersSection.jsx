import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import { TIER_LIMITS } from '@/lib/tierLimits';

const TIERS = {
  tier1: {
    ...TIER_LIMITS.tier1,
    price: TIER_LIMITS.tier1.priceLabel,
    priceId: 'price_1THYLAD8slkoqOiBqzij9LlB',
    subtitle: 'Best for smaller schools starting with structured timetable management',
    rules: [
      `Up to ${TIER_LIMITS.tier1.studentLimit} students`,
      `${TIER_LIMITS.tier1.savedVersionsLimit} saved schedule versions`,
      'Auto generation + manual adjustments',
      'PDF & Excel export',
      `${TIER_LIMITS.tier1.adminSeats} admin account`,
      TIER_LIMITS.tier1.support,
    ],
    highlights: [
      { icon: School, label: 'Student limit', value: String(TIER_LIMITS.tier1.studentLimit) },
      { icon: Calendar, label: 'Saved versions', value: String(TIER_LIMITS.tier1.savedVersionsLimit) },
      { icon: Users, label: 'Admin accounts', value: String(TIER_LIMITS.tier1.adminSeats) },
    ],
    featured: false,
  },
  tier2: {
    ...TIER_LIMITS.tier2,
    price: TIER_LIMITS.tier2.priceLabel,
    priceId: 'price_1THYLAD8slkoqOiBI0rA7cCR',
    subtitle: 'Best for growing schools that need flexibility and multiple admin users',
    rules: [
      `Up to ${TIER_LIMITS.tier2.studentLimit} students`,
      'Unlimited generations',
      'Auto generation + manual adjustments',
      'PDF & Excel export',
      'Unlimited saved versions',
      `${TIER_LIMITS.tier2.adminSeats} admin accounts`,
      TIER_LIMITS.tier2.support,
    ],
    highlights: [
      { icon: School, label: 'Student limit', value: String(TIER_LIMITS.tier2.studentLimit) },
      { icon: Calendar, label: 'Saved versions', value: 'Unlimited' },
      { icon: Users, label: 'Admin accounts', value: String(TIER_LIMITS.tier2.adminSeats) },
    ],
    featured: true,
  },
  tier3: {
    ...TIER_LIMITS.tier3,
    price: TIER_LIMITS.tier3.priceLabel,
    priceId: 'price_1THYLAD8slkoqOiBQCaKAj2z',
    subtitle: 'Best for large schools that need scale, speed, and premium support',
    rules: [
      `Up to ${TIER_LIMITS.tier3.studentLimit} students`,
      'Unlimited generations',
      'Auto generation + manual adjustments',
      'PDF & Excel export',
      'Unlimited saved versions',
      'Unlimited admin accounts',
      TIER_LIMITS.tier3.support,
      'Onboarding call included',
    ],
    highlights: [
      { icon: School, label: 'Student limit', value: String(TIER_LIMITS.tier3.studentLimit) },
      { icon: Calendar, label: 'Saved versions', value: 'Unlimited' },
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

const panelTransition = {
  duration: 0.42,
  ease: [0.22, 1, 0.36, 1],
};

export default function PricingTiersSection() {
  const [expandedTier, setExpandedTier] = useState('tier2');
  const [loadingTier, setLoadingTier] = useState(null);

  const tierOptions = useMemo(
    () => Object.entries(TIERS).map(([value, tier]) => ({ value, label: tier.name })),
    []
  );

  const selectedTier = TIERS[expandedTier];
  const summaryLines = [
    'The school can only operate within the limits of this tier.',
    'Student capacity is capped by the selected plan.',
    selectedTier.name === 'Pro' ? 'Saved schedule versions are unlimited on this plan.' : 'Saved schedule versions follow the plan allowance.',
    selectedTier.name === 'Pro' ? 'Admin accounts are unlimited on this plan.' : 'Admin accounts are limited by the plan.',
    'Support response level follows the selected plan.',
  ];

  const handleCheckout = async (priceId, tierId) => {
    if (window.self !== window.top) {
      alert('Checkout works only from the published app, not inside the preview.');
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

        <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-stretch">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={expandedTier}
              initial={{ opacity: 0, y: 28, scale: 0.985, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -18, scale: 0.985, filter: 'blur(8px)' }}
              transition={panelTransition}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] sm:p-8"
            >
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.06 }}
                className="border-b border-slate-100 pb-6"
              >
                <div className="flex items-center gap-3">
                  <h3 className="text-3xl font-bold text-slate-900">{selectedTier.name}</h3>
                  {selectedTier.featured ? <Badge className="bg-yellow-400 text-slate-900">Recommended</Badge> : null}
                </div>
                <p className="mt-3 max-w-2xl text-slate-600">{selectedTier.subtitle}</p>
              </motion.div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {selectedTier.highlights.map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: 0.1 + index * 0.05 }}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <item.icon className="mb-3 h-5 w-5 text-blue-700" />
                    <div className="text-xl font-bold text-slate-900">{item.value}</div>
                    <div className="text-sm text-slate-500">{item.label}</div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {selectedTier.rules.map((rule, index) => (
                  <motion.div
                    key={rule}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.26, delay: 0.18 + index * 0.035 }}
                    className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="mt-0.5 rounded-full bg-emerald-100 p-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <span className="text-slate-700">{rule}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${expandedTier}-summary`}
              initial={{ opacity: 0, y: 28, scale: 0.985, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -18, scale: 0.985, filter: 'blur(8px)' }}
              transition={{ ...panelTransition, delay: 0.03 }}
              className="flex h-full flex-col rounded-[2rem] border border-blue-800/40 bg-gradient-to-br from-blue-900 via-blue-900 to-blue-800 p-6 text-white shadow-[0_20px_60px_-30px_rgba(30,64,175,0.45)] sm:p-8"
            >
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: 0.08 }}
                className="text-sm uppercase tracking-[0.2em] text-sky-200"
              >
                What this controls
              </motion.p>
              <motion.h3
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.12 }}
                className="mt-3 text-2xl font-bold"
              >
                {selectedTier.name} rules applied across your school
              </motion.h3>
              <div className="mt-6 space-y-3 text-sm text-blue-100/90">
                {summaryLines.map((line, index) => (
                  <motion.p
                    key={line}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.24, delay: 0.16 + index * 0.05 }}
                  >
                    {line}
                  </motion.p>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.34 }}
                className="mt-8 rounded-2xl border border-blue-300/20 bg-white/10 p-4 backdrop-blur-sm"
              >
                <p className="text-sm text-sky-100">Already have an account? You’ll go straight to payment. New user? You’ll create your account first.</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: 0.4 }}
                className="mt-auto pt-8"
              >
                <div className="mb-4 rounded-3xl border border-sky-300/20 bg-gradient-to-br from-white/16 to-sky-300/10 p-5 backdrop-blur-sm">
                  <div className="text-xs uppercase tracking-[0.22em] text-sky-200">Annual price</div>
                  <div className="mt-2 text-4xl font-bold text-sky-50">{selectedTier.price}</div>
                </div>

                <Button
                  type="button"
                  className="h-12 w-full rounded-full bg-white text-blue-950 font-semibold hover:bg-slate-100"
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
            </motion.div>
          </AnimatePresence>
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