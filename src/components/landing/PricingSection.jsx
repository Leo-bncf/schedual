import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from 'lucide-react';
import { createPageUrl } from '../../utils';
import { motion } from 'framer-motion';

const plans = [
  {
    name: 'Yearly Subscription',
    price: '€2,239',
    period: 'per year',
    description: 'All-inclusive yearly billing with secure storage',
    features: [
      'Full platform access (€1,999/year)',
      'Secure data storage included (€240/year)',
      'Unlimited teachers and students',
      'AI-powered scheduling',
      'Conflict detection & resolution',
      'IB compliance checking',
      'Priority support',
      'Additional users: €200/year each',
    ],
    priceId: 'price_yearly',
    popular: true,
  },
];

export default function PricingSection() {
  const [loading, setLoading] = useState(null);

  const handleSubscribe = async (priceId) => {
    setLoading(priceId);
    
    try {
      const isAuthenticated = await base44.auth.isAuthenticated();
      
      if (!isAuthenticated) {
        // Not logged in - redirect to login with subscription as next page
        base44.auth.redirectToLogin(createPageUrl('Subscription'));
      } else {
        // Logged in - check if user has school_id
        const user = await base44.auth.me();
        
        if (!user.school_id) {
          // No school assigned - redirect to subscription page for payment
          window.location.href = createPageUrl('Subscription');
        } else {
          // Has school - redirect to dashboard
          window.location.href = createPageUrl('Dashboard');
        }
      }
    } catch (error) {
      console.error('Subscription navigation error:', error);
      // Fallback: redirect to login
      base44.auth.redirectToLogin(createPageUrl('Subscription'));
    } finally {
      setLoading(null);
    }
  };

  return (
    <section id="pricing" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-white overflow-hidden">

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
            One comprehensive plan. Everything you need to automate your IB timetabling.
          </p>
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
                className="relative p-10 rounded-3xl bg-white border-2 border-indigo-600 shadow-2xl"
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

                <div className="text-center mb-10">
                  <h3 className="text-3xl font-bold text-slate-900 mb-4">{plan.name}</h3>
                  <div className="mb-4">
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-6xl font-bold bg-gradient-to-r from-blue-900 to-blue-800 text-transparent bg-clip-text">{plan.price}</span>
                      <span className="text-slate-600 text-lg">{plan.period}</span>
                    </div>
                    <p className="text-slate-500 mt-2">≈ €186/month</p>
                  </div>
                  <p className="text-slate-600 text-lg">{plan.description}</p>
                </div>

                <ul className="space-y-4 mb-10">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-base">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  className="w-full py-7 text-lg font-semibold bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all"
                  onClick={() => handleSubscribe(plan.priceId)}
                  disabled={loading !== null}
                >
                  {loading === plan.priceId ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    '🚀 Get Started Now'
                  )}
                </Button>
              </motion.div>
            ))}
          </div>

          {/* Right Stats */}
          <div className="lg:col-span-3 space-y-6">
            <motion.div 
              className="bg-gradient-to-br from-emerald-50 to-green-100/80 backdrop-blur-sm p-6 rounded-2xl border border-emerald-200 shadow-sm"
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
              className="bg-gradient-to-br from-amber-50 to-yellow-100/80 backdrop-blur-sm p-6 rounded-2xl border border-amber-200 shadow-sm"
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
        <div className="mt-20 text-center">
          <p className="text-slate-600 text-lg mb-6 font-medium">Trusted by IB schools worldwide 🌍</p>
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12">
            <div className="flex items-center gap-2 text-slate-700 bg-gradient-to-r from-blue-50 to-blue-100 backdrop-blur-sm px-6 py-3 rounded-full border border-blue-200">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span className="font-medium">Secure Stripe Payments</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 bg-gradient-to-r from-blue-50 to-blue-100 backdrop-blur-sm px-6 py-3 rounded-full border border-blue-200">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span className="font-medium">Cancel Anytime</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 bg-gradient-to-r from-blue-50 to-blue-100 backdrop-blur-sm px-6 py-3 rounded-full border border-blue-200">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span className="font-medium">30-Day Money Back</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}