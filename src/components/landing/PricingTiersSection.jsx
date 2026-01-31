import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Zap, Users, Building2, Plug, SlidersHorizontal, LifeBuoy, Sparkles } from 'lucide-react';

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
      { id: 'custom_sis_integration_yearly', name: 'Custom SIS/LMS Integration', price: 550, type: 'yearly' },
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

const CATEGORY_ICONS = {
  'Users': Users,
  'School Structure': Building2,
  'Integrations': Plug,
  'Scheduling Features': SlidersHorizontal,
  'Support & Services': LifeBuoy,
};

export default function PricingTiersSection() {
  const [showAddOns, setShowAddOns] = useState(false);

  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
            Pricing Built for IB Schools
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Choose the tier that fits your school. All plans include AI-powered scheduling and conflict resolution.
          </p>
        </div>

        {/* Tiers Grid */}
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {Object.entries(TIERS).map(([tierId, tier]) => (
            <div key={tierId} className="relative group">
              {tier.featured && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-blue-900 text-white px-3 py-1 text-xs font-semibold">MOST POPULAR</Badge>
                </div>
              )}
              <div className={`
                h-full rounded-2xl border-2 transition-all duration-300 overflow-hidden
                ${tier.featured 
                  ? 'border-blue-900 bg-gradient-to-br from-blue-900/5 to-blue-900/10 shadow-xl' 
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg'
                }
              `}>
                <div className="p-8 sm:p-10 flex flex-col h-full">
                  {/* Top meta pill */}
                  <div className="mb-4">
                    <span className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-900" /> Best for {tier.students} students
                    </span>
                  </div>

                  {/* Icon & Title */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="text-5xl">{tier.icon}</div>
                    {tier.featured && (
                      <Badge className="bg-yellow-400 text-slate-900">Recommended</Badge>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">{tier.subtitle}</h3>
                  <p className="text-sm text-slate-600 mt-2">{tier.description}</p>

                  {/* Price */}
                  <div className="mt-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-slate-900">${tier.price}</span>
                      <span className="text-slate-600">/year</span>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {tier.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-700">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Card footer */}
                  <div className="mt-auto pt-6">
                    <a href="#addons" className="text-sm font-medium text-blue-900 hover:underline">
                      See optional add-ons →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add-ons Section */}
        <div id="addons" className="relative pt-24">
          <div className="text-center mb-8">
            <h3 className="text-3xl font-bold text-slate-900">Customize Your Plan</h3>
            <p className="text-slate-600 mt-2">Add optional features to enhance your tier</p>
            <div className="mt-6">
              <button
                onClick={() => setShowAddOns(!showAddOns)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-900 text-white hover:bg-blue-800 transition-colors font-semibold shadow-sm"
              >
                <Sparkles className="w-5 h-5" />
                {showAddOns ? 'Hide Add-ons' : 'View Add-ons'}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showAddOns && (
              <motion.div
                key="addons-panel"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                className="rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-indigo-50/40 p-6 sm:p-10 shadow-sm"
              >
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {ADD_ONS.map((category, idx) => {
                    const Icon = CATEGORY_ICONS[category.category] || Zap;
                    return (
                      <motion.div
                        key={category.category}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.35, delay: idx * 0.05 }}
                        whileHover={{ y: -6, boxShadow: '0 10px 20px -10px rgba(2,6,23,0.25)' }}
                        className="rounded-2xl bg-white/70 backdrop-blur-sm border border-slate-200 p-5 sm:p-6 transition-all"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center">
                              <Icon className="w-5 h-5" />
                            </div>
                            <h4 className="text-lg font-semibold text-slate-900">{category.category}</h4>
                          </div>
                        </div>
                        <div className="grid gap-4">
                          {category.items.map((addon, j) => (
                            <motion.div
                              key={addon.id}
                              layout
                              initial={{ opacity: 0, y: 8 }}
                              whileInView={{ opacity: 1, y: 0 }}
                              viewport={{ once: true, amount: 0.3 }}
                              transition={{ duration: 0.3, delay: j * 0.03 }}
                              whileHover={{ scale: 1.02 }}
                              className="group rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow transition-all p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <h5 className="font-medium text-slate-900 text-sm leading-5">{addon.name}</h5>
                                <Badge className={`${addon.type === 'onetime' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'} text-[10px]`}>
                                  {addon.type === 'onetime' ? 'One-time' : 'Annual'}
                                </Badge>
                              </div>
                              <div className="mt-3 flex items-end justify-between">
                                <div className="text-blue-900 font-bold text-xl">${addon.price}</div>
                                <button className="text-sm font-semibold text-blue-900 opacity-0 group-hover:opacity-100 transition-opacity">
                                  Learn more →
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
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