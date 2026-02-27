import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Zap, Users, Building2, Plug, SlidersHorizontal, LifeBuoy, Sparkles, ChevronDown, X } from 'lucide-react';

const TIERS = {
  tier1: {
    name: 'Small',
    subtitle: 'Small IB Schools',
    price_yearly: 1100,
    price_monthly: 110,
    description: 'PYP-only or MYP-only schools up to 300 students',
    students: '≤300',
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
    name: 'Medium',
    subtitle: 'Standard IB Continuum',
    price_yearly: 2200,
    price_monthly: 220,
    description: 'PYP + MYP + DP schools (300-800 students)',
    students: '300-800',
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
    name: 'Large',
    subtitle: 'Large/Multi-Campus',
    price_yearly: 4950,
    price_monthly: 495,
    description: 'Large schools with 800+ students, multiple campuses',
    students: '800+',
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
      { id: 'extra_admin_user', name: 'Extra Admin User', price_yearly: 275, price_monthly: 28, type: 'recurring' },
      { id: 'unlimited_admin_users', name: 'Unlimited Admin Users', price_yearly: 825, price_monthly: 83, type: 'recurring' },
    ],
  },
  {
    category: 'School Structure',
    items: [
      { id: 'additional_campus', name: 'Additional Campus', price_yearly: 660, price_monthly: 66, type: 'recurring' },
      { id: 'unlimited_campuses', name: 'Unlimited Campuses', price_yearly: 1650, price_monthly: 165, type: 'recurring' },
      { id: 'multiple_timetable_scenarios', name: 'Multiple Timetable Scenarios', price_yearly: 880, price_monthly: 88, type: 'recurring' },
    ],
  },


  {
    category: 'Support & Services',
    items: [
      { id: 'priority_support', name: 'Priority Support (24h)', price_yearly: 550, price_monthly: 55, type: 'recurring' },
      { id: 'onboarding_setup', name: 'Onboarding & First Setup', price_yearly: 1320, price_monthly: 1320, type: 'onetime' },
    ],
  },
];

const CATEGORY_ICONS = {
  'Users': Users,
  'School Structure': Building2,
  'Support & Services': LifeBuoy,
};



export default function PricingTiersSection() {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [expandedTier, setExpandedTier] = useState(null);
  const [billingInterval, setBillingInterval] = useState('yearly');
  const toggleCategory = (cat) => setExpandedCategory(expandedCategory === cat ? null : cat);


  return (
    <section id="pricing" className="py-20 bg-white relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
            Pricing Built for IB Schools
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Choose the tier that fits your school. All plans include AI-powered scheduling and conflict resolution.
          </p>
          <div className="flex justify-center mt-8">
            <div className="bg-slate-100 p-1 rounded-lg inline-flex items-center gap-1">
              <button
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${billingInterval === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => setBillingInterval('monthly')}
              >
                Monthly
              </button>
              <button
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${billingInterval === 'yearly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => setBillingInterval('yearly')}
              >
                Annually
              </button>
            </div>
          </div>
        </div>

        {/* Tiers Grid */}
        <div className="mb-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {Object.entries(TIERS).map(([tierId, tier]) => (
              <button
                key={tierId}
                className={`rounded-2xl border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 hover:shadow-sm ${expandedTier === tierId ? 'ring-2 ring-blue-900' : ''} p-5 flex flex-col gap-2 text-left cursor-pointer transition-all`}
                onClick={() => setExpandedTier(expandedTier === tierId ? null : tierId)}
                role="button"
                aria-label={`View details for ${tier.name}`}
                aria-expanded={expandedTier === tierId}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">{tier.name}</h3>
                  <div className="flex items-center gap-2">
                    {tier.featured && (
                      <Badge className="bg-yellow-400 text-slate-900">Recommended</Badge>
                    )}
                    <motion.div animate={{ rotate: expandedTier === tierId ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-5 h-5 text-slate-500" />
                    </motion.div>
                  </div>
                </div>
                <p className="text-sm text-slate-600">{tier.subtitle}</p>
                <div className="mt-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-slate-900">
                      ${billingInterval === 'yearly' ? tier.price_yearly : tier.price_monthly}
                    </span>
                    <span className="text-slate-600 text-sm">/{billingInterval === 'yearly' ? 'year' : 'month'}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Expanded Details Section */}
        <AnimatePresence mode="wait">
          {expandedTier && TIERS[expandedTier] && (
            <motion.div
              key={expandedTier}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-16 overflow-hidden"
            >
              <div className="rounded-2xl border border-blue-300 bg-gradient-to-br from-blue-50 to-white p-8">
                <div className="text-xs text-slate-500 mb-2">Best for {TIERS[expandedTier].students} students</div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{TIERS[expandedTier].name}</h3>
                {TIERS[expandedTier].description && (
                  <p className="text-slate-700 mb-6">{TIERS[expandedTier].description}</p>
                )}

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {TIERS[expandedTier].features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-700">{feature}</span>
                    </div>
                  ))}
                </div>

                <a
                  href="/Subscription"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors font-medium"
                >
                  Choose {TIERS[expandedTier].name}
                  <span>→</span>
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add-ons Section */}
        <div id="addons" className="relative pt-24">
          <div className="text-center mb-8">
            <h3 className="text-3xl font-bold text-slate-900">Customize Your Plan</h3>
            <p className="text-slate-600 mt-2">Tap a category to explore optional add-ons</p>
          </div>

          <div className="mb-8">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {ADD_ONS.map((category, idx) => {
                const Icon = CATEGORY_ICONS[category.category] || Zap;
                const isExpanded = expandedCategory === category.category;
                return (
                  <button
                    key={category.category}
                    className={`rounded-2xl border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 hover:shadow-sm ${isExpanded ? 'ring-2 ring-blue-900' : ''} p-5 flex flex-col gap-2 text-left cursor-pointer transition-all`}
                    onClick={() => toggleCategory(category.category)}
                    role="button"
                    aria-label={`View details for ${category.category}`}
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-slate-900">{category.category}</h4>
                          <p className="text-slate-500 text-sm">{category.items.length} options</p>
                        </div>
                      </div>
                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-5 h-5 text-slate-500" />
                      </motion.div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Expanded Details Section */}
          <AnimatePresence mode="wait">
            {expandedCategory && ADD_ONS.find(cat => cat.category === expandedCategory) && (
              <motion.div
                key={expandedCategory}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-16 overflow-hidden"
              >
                <div className="rounded-2xl border border-blue-300 bg-gradient-to-br from-blue-50 to-white p-8">
                  <h3 className="text-2xl font-bold text-slate-900 mb-6">{expandedCategory}</h3>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {ADD_ONS.find(cat => cat.category === expandedCategory).items.map((addon) => (
                      <div
                        key={addon.id}
                        className="rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all p-5"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <h5 className="font-semibold text-slate-900 text-base leading-snug">{addon.name}</h5>
                          <Badge className={`${addon.type === 'onetime' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'} text-xs shrink-0`}>
                            {addon.type === 'onetime' ? 'One-time' : billingInterval === 'yearly' ? 'Annual' : 'Monthly'}
                          </Badge>
                        </div>
                        <div className="text-blue-900 font-bold text-2xl">
                          ${addon.type === 'onetime' ? addon.price_yearly : billingInterval === 'yearly' ? addon.price_yearly : addon.price_monthly}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <a
            href="/Subscription"
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors font-semibold text-lg shadow-lg hover:shadow-xl"
          >
            Get Started Today
            <span className="text-xl">→</span>
          </a>
          <p className="text-slate-500 mt-4 text-sm">No credit card required for trial</p>
        </div>
      </div>
    </section>
  );
}