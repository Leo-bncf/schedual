import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Zap, Users, Building2, Plug, SlidersHorizontal, LifeBuoy, Sparkles, ChevronDown, X } from 'lucide-react';

const TIERS = {
  tier1: {
    name: 'Tier 1',
    subtitle: 'Small IB Schools',
    price: 1100,
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
    name: 'Tier 2',
    subtitle: 'Standard IB Continuum',
    price: 2200,
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
    name: 'Tier 3',
    subtitle: 'Large/Multi-Campus',
    price: 4950,
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
  const [openCategories, setOpenCategories] = useState({});
  const [expandedTier, setExpandedTier] = useState(null);
  const toggleCategory = (cat) => setOpenCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));


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
        <div className="mb-16">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {Object.entries(TIERS).map(([tierId, tier]) => (
              <div key={tierId} className={`rounded-2xl border ${tier.featured ? 'border-blue-900 bg-blue-50/30' : 'border-slate-200 bg-white'} transition-all`}>
                <button
                  className="w-full p-5 flex flex-col gap-2 text-left cursor-pointer hover:shadow-md transition-all"
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
                      <span className="text-2xl font-bold text-slate-900">${tier.price}</span>
                      <span className="text-slate-600 text-sm">/year</span>
                    </div>
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {expandedTier === tierId && (
                    <motion.div
                      key="content"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="px-5 pb-5"
                    >
                      <div className="pt-4 border-t border-slate-200">
                        <div className="text-xs text-slate-500 mb-2">Best for {tier.students} students</div>
                        {tier.description && (
                          <p className="text-slate-700 mb-4">{tier.description}</p>
                        )}

                        <div className="grid sm:grid-cols-2 gap-3 mb-6">
                          {(tier.features || []).map((feature, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-slate-700">{feature}</span>
                            </div>
                          ))}
                        </div>

                        <a
                          href="/Subscription"
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors text-sm font-medium"
                        >
                          Choose this plan
                          <span>→</span>
                        </a>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* Add-ons Section */}
        <div id="addons" className="relative pt-24">
          <div className="text-center mb-8">
            <h3 className="text-3xl font-bold text-slate-900">Customize Your Plan</h3>
            <p className="text-slate-600 mt-2">Tap a category to explore optional add-ons</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ADD_ONS.map((category, idx) => {
              const Icon = CATEGORY_ICONS[category.category] || Zap;
              const open = !!openCategories[category.category];
              return (
                <motion.div
                  key={category.category}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.35, delay: idx * 0.05 }}
                  className={`rounded-2xl border ${open ? 'border-blue-300 shadow-md' : 'border-slate-200'} bg-white/80 backdrop-blur-sm p-5 sm:p-6`}
                >
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.category)}
                    className="w-full"
                    role="button"
                    aria-expanded={open}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-left">
                        <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-slate-900">{category.category}</h4>
                          <p className="text-slate-500 text-sm">{category.items.length} options</p>
                        </div>
                      </div>
                      <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-5 h-5 text-slate-500" />
                      </motion.div>
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        key="content"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="mt-4 pt-4 border-t border-slate-200"
                      >
                        <div className="grid gap-4">
                          {category.items.map((addon, j) => (
                            <motion.div
                              key={addon.id}
                              layout
                              initial={{ opacity: 0, y: 6 }}
                              whileInView={{ opacity: 1, y: 0 }}
                              viewport={{ once: true, amount: 0.3 }}
                              transition={{ duration: 0.25, delay: j * 0.03 }}
                              whileHover={{ scale: 1.01 }}
                              className="group rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all p-4"
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
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
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