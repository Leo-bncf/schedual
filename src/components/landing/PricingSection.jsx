import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, Shield, X, Undo2, ArrowRight, CreditCard, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { TIER_LIMITS } from '@/lib/tierLimits';

export default function PricingSection() {
  const [loading, setLoading] = useState(false);

  const plans = useMemo(() => ([
    {
      name: `${TIER_LIMITS.tier2.name} Plan`,
      price: TIER_LIMITS.tier2.priceLabel,
      period: 'per year',
      description: 'Best for growing schools that need flexibility, multiple admin users, and desktop access across major operating systems',
      features: [
        `Up to ${TIER_LIMITS.tier2.studentLimit} students`,
        'Unlimited schedule generations',
        'Unlimited saved schedule versions',
        `${TIER_LIMITS.tier2.adminSeats} admin accounts`,
        'AI-powered scheduling',
        'Conflict detection & resolution',
        TIER_LIMITS.tier2.support,
        'PDF & Excel export included',
        'Desktop app downloads for Mac, Windows, and Linux',
      ],
      priceId: 'price_1THYLAD8slkoqOiBI0rA7cCR',
      popular: true,
    },
  ]), []);

  const handleCheckout = async (priceId) => {
    if (window.self !== window.top) {
      alert('Checkout works only from the published app, not inside the preview.');
      return;
    }

    const isAuthenticated = await base44.auth.isAuthenticated();
    if (!isAuthenticated) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }

    const user = await base44.auth.me();
    if (!user?.email) {
      alert('Please sign in with a valid email before checkout.');
      return;
    }

    setLoading(true);

    try {
      const response = await base44.functions.invoke('createStripeCheckout', {
        priceId,
        tier: 'tier2',
        userEmail: user.email,
      });

      if (response?.data?.url) {
        window.location.href = response.data.url;
        return;
      }

      alert('Unable to open Stripe checkout right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="pricing" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-transparent overflow-hidden">

      <div className="max-w-7xl mx-auto relative">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-block mb-4">
            <span className="bg-gradient-to-r from-blue-900 to-blue-800 text-transparent bg-clip-text text-sm font-semibold tracking-wide uppercase">
              Pricing
            </span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
            Invest in Smarter Scheduling
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Pick your plan, create your account if needed, and continue directly to secure checkout.
          </p>
        </div>

        <div className="max-w-5xl mx-auto mb-8">
          <div className="rounded-3xl border border-blue-200 bg-white/85 backdrop-blur-md shadow-xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-900/80 mb-2">Get started</p>
                <h3 className="text-2xl md:text-3xl font-bold text-slate-900">Choose your plan and complete checkout in minutes</h3>
                <p className="text-slate-600 mt-2 max-w-2xl">If you already have an account, you’ll go directly to payment. If not, you’ll create your account first and then continue to checkout automatically.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 min-w-full md:min-w-[320px] md:max-w-[360px]">
                <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                  <div className="flex items-center gap-2 text-blue-900 font-semibold mb-2">
                    <UserPlus className="w-4 h-4" />
                    New customer
                  </div>
                  <p className="text-sm text-slate-600">Create your account, then continue straight to secure payment.</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                  <div className="flex items-center gap-2 text-emerald-700 font-semibold mb-2">
                    <CreditCard className="w-4 h-4" />
                    Existing account
                  </div>
                  <p className="text-sm text-slate-600">Already connected? Click the button and go directly to checkout.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Pricing Card with Side Stats */}
        <div className="grid lg:grid-cols-12 gap-8 items-center max-w-6xl mx-auto">
          {/* Left Stats */}
          <div className="lg:col-span-3 space-y-6">
            <motion.div 
              className="bg-gradient-to-br from-blue-50 to-blue-100/80 backdrop-blur-sm p-6 rounded-2xl border border-blue-200 shadow-sm"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              whileHover={{ scale: 1.05, y: -8, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
            >
              <div className="text-4xl font-bold text-blue-900 mb-2">500+</div>
              <p className="text-slate-700">Hours Saved Annually</p>
            </motion.div>
            <motion.div 
              className="bg-gradient-to-br from-blue-50 to-blue-100/80 backdrop-blur-sm p-6 rounded-2xl border border-blue-200 shadow-sm"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ scale: 1.05, y: -8, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
            >
              <div className="text-4xl font-bold text-blue-900 mb-2">100%</div>
              <p className="text-slate-700">IB Compliant</p>
            </motion.div>
          </div>

          {/* Center Pricing Card */}
          <div className="lg:col-span-6">
            {plans.map((plan, index) => (
              <motion.div 
                key={index} 
                className="relative p-10 rounded-3xl bg-white/90 backdrop-blur-md shadow-2xl border border-blue-100 overflow-hidden"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                whileHover={{ scale: 1.05, y: -8, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
              >
                {plan.popular && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-900 to-blue-800 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg">
                      ⭐ Most Popular
                    </span>
                  </div>
                )}

                <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-blue-900 via-blue-600 to-emerald-500" />

                <div className="text-center mb-10 mt-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-900 px-4 py-2 text-sm font-semibold mb-4 border border-blue-100">
                    <CheckCircle className="w-4 h-4" />
                    Best for full school scheduling
                  </div>
                  <h3 className="text-3xl font-bold text-slate-900 mb-4">{plan.name}</h3>
                  <div className="mb-4">
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-6xl font-bold bg-gradient-to-r from-blue-900 to-blue-800 text-transparent bg-clip-text">{plan.price}</span>
                      <span className="text-slate-600 text-lg">{plan.period}</span>
                    </div>
                    <p className="text-slate-500 mt-2">Shared with the main tier pricing configuration</p>
                  </div>
                  <p className="text-slate-600 text-lg">{plan.description}</p>
                  <p className="text-sm font-medium text-blue-900 mt-3">Includes downloadable desktop access for Mac, Windows, and Linux.</p>
                </div>

                <ul className="space-y-4 mb-10">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-base">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 mb-5">
                  <div className="flex flex-col gap-2 text-sm text-slate-600">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span>Ready to buy?</span>
                      <span className="font-medium text-slate-900">Account first, payment right after</span>
                    </div>
                    <span className="text-blue-900 font-medium">Pro also includes downloadable desktop versions for Mac, Windows, and Linux.</span>
                  </div>
                </div>

                <Button 
                  className="w-full py-7 text-lg font-semibold bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all"
                  onClick={() => handleCheckout(plan.priceId)}
                  disabled={loading}
                >
                  {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Redirecting...</> : <><span>Choose plan & continue</span><ArrowRight className="w-5 h-5 ml-1" /></>}
                </Button>

                <p className="text-center text-sm text-slate-500 mt-4">Already connected? You’ll go straight to payment. New here? You’ll create your account first.</p>
              </motion.div>
            ))}
          </div>

          {/* Right Stats */}
          <div className="lg:col-span-3 space-y-6">
            <motion.div 
              className="bg-gradient-to-br from-emerald-50/70 to-green-100/50 backdrop-blur-md p-6 rounded-2xl shadow-sm"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              whileHover={{ scale: 1.05, y: -8, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
            >
              <div className="text-4xl font-bold text-emerald-600 mb-2">24/7</div>
              <p className="text-slate-700">Priority Support</p>
            </motion.div>
            <motion.div 
              className="bg-gradient-to-br from-amber-50/70 to-yellow-100/50 backdrop-blur-md p-6 rounded-2xl shadow-sm"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ scale: 1.05, y: -8, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
            >
              <div className="text-4xl font-bold text-amber-600 mb-2">0</div>
              <p className="text-slate-700">Conflicts Guaranteed</p>
            </motion.div>
          </div>
        </div>

        {/* Trust Badges */}
        <motion.div 
          className="mt-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-8">
            <p className="text-slate-700 text-xl font-semibold mb-2">Trusted by IB schools worldwide 🌍</p>
            <p className="text-slate-500 text-sm">Join schools from over 40 countries using Schedual</p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6">
            <motion.div 
              className="flex items-center gap-3 text-slate-800 bg-white border-2 border-emerald-200 px-6 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all"
              whileHover={{ scale: 1.05, y: -4 }}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold">Secure Stripe Payments</span>
            </motion.div>
            <motion.div 
              className="flex items-center gap-3 text-slate-800 bg-white border-2 border-blue-200 px-6 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all"
              whileHover={{ scale: 1.05, y: -4 }}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <X className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold">Cancel Anytime</span>
            </motion.div>
            <motion.div 
              className="flex items-center gap-3 text-slate-800 bg-white border-2 border-purple-200 px-6 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all"
              whileHover={{ scale: 1.05, y: -4 }}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Undo2 className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold">30-Day Money Back</span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}