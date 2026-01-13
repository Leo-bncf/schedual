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
    <section className="py-16 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Choose the tier that fits your school's size and complexity. All tiers include core scheduling features.
          </p>
        </div>

        {/* Tiers */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {Object.entries(TIERS).map(([tierId, tier]) => (
            <Card
              key={tierId}
              className={`h-full bg-gradient-to-br ${tier.color} border-2 ${tier.borderColor} relative`}
            >
              {tier.featured && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-yellow-500 text-white px-4 py-1 text-sm">Most Popular</Badge>
                </div>
              )}
              <CardHeader className={tier.featured ? 'pt-8' : ''}>
                <div className="text-4xl mb-3">{tier.icon}</div>
                <CardTitle className="text-2xl">{tier.subtitle}</CardTitle>
                <CardDescription className="text-base">{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center bg-white/60 rounded-lg p-4">
                  <div className="text-4xl font-bold text-slate-900">${tier.price}</div>
                  <div className="text-sm text-slate-600">/year</div>
                  <div className="text-xs text-slate-500 mt-2">For {tier.students} students</div>
                </div>

                <div className="space-y-2">
                  {tier.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add-ons Toggle */}
        <div className="text-center mb-8">
          <button
            onClick={() => setShowAddOns(!showAddOns)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors font-semibold"
          >
            <Zap className="w-5 h-5" />
            {showAddOns ? 'Hide' : 'View'} Optional Add-ons
          </button>
        </div>

        {/* Add-ons Grid */}
        {showAddOns && (
          <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
            <h3 className="text-2xl font-bold text-slate-900 mb-8 text-center">
              Enhance Your Plan with Add-ons
            </h3>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ADD_ONS.flatMap((category) =>
                category.items.map((addon) => (
                  <Card key={addon.id} className="border-slate-200 hover:border-blue-300 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-semibold text-slate-900 text-sm flex-1">{addon.name}</h4>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {addon.type === 'onetime' ? 'One-time' : 'Yearly'}
                        </Badge>
                      </div>
                      <div className="text-2xl font-bold text-blue-900">
                        ${addon.price}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {addon.type === 'onetime' ? 'One-time fee' : 'Added to yearly cost'}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>💡 Mix and match:</strong> Add-ons are available for any tier and can be combined to create a custom package.
              </p>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-slate-600 mb-4">Ready to simplify your scheduling?</p>
          <a
            href="/Subscription"
            className="inline-block px-8 py-4 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors font-semibold text-lg"
          >
            Get Started
          </a>
        </div>
      </div>
    </section>
  );
}