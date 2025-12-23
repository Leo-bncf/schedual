import React from 'react';
import { Button } from "@/components/ui/button";
import { Check, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../../utils';

const plans = [
  {
    name: 'Yearly Subscription',
    price: '€1,999',
    period: 'per year',
    description: 'All-inclusive platform access for IB schools',
    features: [
      'Unlimited teachers & students',
      'AI-powered scheduling engine',
      'Automatic conflict resolution',
      'IB Diploma compliance checking',
      'Teaching group management',
      'Room allocation optimization',
      'Priority email support',
      'Regular feature updates',
      'Secure cloud storage included',
      'Export to multiple formats'
    ],
    highlighted: true
  }
];

export default function PricingSection() {
  const handleGetStarted = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const user = await base44.auth.me();
        if (user.school_id) {
          window.location.href = createPageUrl('Subscription');
        } else {
          window.location.href = createPageUrl('Subscription');
        }
      } else {
        base44.auth.redirectToLogin(createPageUrl('Subscription'));
      }
    } catch (error) {
      base44.auth.redirectToLogin(createPageUrl('Subscription'));
    }
  };

  return (
    <section id="pricing" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-slate-700 max-w-3xl mx-auto">
            One price, all features. No hidden fees or surprises.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {plans.map((plan, i) => (
            <div key={i} className="relative">
              {plan.highlighted && (
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl blur opacity-75" />
              )}
              <div className="relative bg-white/50 backdrop-blur-sm rounded-2xl p-8 border border-purple-300/50">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                  <p className="text-slate-700 mb-6">{plan.description}</p>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-bold text-slate-900">{plan.price}</span>
                    <span className="text-slate-700">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  size="lg"
                  onClick={handleGetStarted}
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-lg py-6"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Get Started
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Badges */}
        <div className="mt-16 text-center">
          <p className="text-slate-700 mb-6">Trusted by IB World Schools</p>
          <div className="flex flex-wrap justify-center gap-8 text-slate-700">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-400" />
              <span>Secure Payments</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-400" />
              <span>Cancel Anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-400" />
              <span>Money-back Guarantee</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}