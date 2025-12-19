import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from 'lucide-react';

const plans = [
  {
    name: 'Monthly',
    price: '$99',
    period: 'per month',
    description: 'Perfect for trying out the platform',
    features: [
      'Unlimited teachers and students',
      'Automated schedule generation',
      'Conflict detection & resolution',
      'IB programme support (PYP, MYP, DP)',
      'Export schedules',
      'Email support',
    ],
    priceId: 'price_monthly', // Replace with actual Stripe price ID
  },
  {
    name: 'Yearly',
    price: '$990',
    period: 'per year',
    description: 'Save 17% with annual billing',
    features: [
      'Everything in Monthly',
      'Priority support',
      'Advanced AI features',
      'Custom constraints',
      'Dedicated account manager',
      '2 months free',
    ],
    priceId: 'price_yearly', // Replace with actual Stripe price ID
    popular: true,
  },
];

export default function PricingSection() {
  const [loading, setLoading] = useState(null);

  const handleSubscribe = async (priceId) => {
    setLoading(priceId);
    
    try {
      // TODO: Implement Stripe checkout
      // This would typically call a backend endpoint that creates a Stripe checkout session
      // For now, we'll just show a placeholder
      alert('Stripe integration coming soon! Price ID: ' + priceId);
      
      // Example of what the implementation would look like:
      // const response = await fetch('/api/create-checkout-session', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ priceId }),
      // });
      // const { url } = await response.json();
      // window.location.href = url;
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Choose the plan that works best for your school. Cancel anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div 
              key={index} 
              className={`relative p-8 rounded-2xl border-2 ${
                plan.popular 
                  ? 'border-indigo-600 shadow-2xl' 
                  : 'border-slate-200 shadow-lg'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-5xl font-bold text-slate-900">{plan.price}</span>
                  <span className="text-slate-600">{plan.period}</span>
                </div>
                <p className="text-slate-600">{plan.description}</p>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className={`w-full py-6 text-lg ${
                  plan.popular 
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700' 
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
                onClick={() => handleSubscribe(plan.priceId)}
                disabled={loading !== null}
              >
                {loading === plan.priceId ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Subscribe Now'
                )}
              </Button>
            </div>
          ))}
        </div>

        {/* Trust Badges */}
        <div className="mt-16 text-center">
          <p className="text-slate-600 mb-4">Trusted by IB schools worldwide</p>
          <div className="flex justify-center items-center gap-8 text-sm text-slate-500">
            <span>✓ Secure payment via Stripe</span>
            <span>✓ Cancel anytime</span>
            <span>✓ 30-day money back</span>
          </div>
        </div>
      </div>
    </section>
  );
}