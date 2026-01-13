import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Zap } from 'lucide-react';

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

export default function PricingTiersSection() {
  const [showAddOns, setShowAddOns] = useState(false);

  return (
    <section className="py-20 bg-white">
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
        <div className="border-t border-slate-200 pt-20">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-slate-900 mb-3">Customize Your Plan</h3>
            <p className="text-slate-600 mb-8">Add optional features to enhance your tier</p>
            <button
              onClick={() => setShowAddOns(!showAddOns)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-semibold"
            >
              <Zap className="w-5 h-5" />
              {showAddOns ? 'Hide Add-ons' : 'View Add-ons'}
            </button>
          </div>

          {showAddOns && (
            <div className="space-y-12 animate-in fade-in duration-300">
              {ADD_ONS.map((category) => (
                <div key={category.category}>
                  <h4 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-900"></span>
                    {category.category}
                  </h4>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {category.items.map((addon) => (
                      <div
                        key={addon.id}
                        className="p-4 rounded-lg border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h5 className="font-semibold text-slate-900 text-sm">{addon.name}</h5>
                          <Badge variant="outline" className="text-xs ml-2">
                            {addon.type === 'onetime' ? '1x' : 'Annual'}
                          </Badge>
                        </div>
                        <div className="text-2xl font-bold text-blue-900">${addon.price}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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