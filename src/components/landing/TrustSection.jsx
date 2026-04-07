import React from 'react';
import { Shield, Lock, Globe, FileCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TrustSection() {
  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-transparent">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              Security and trust
            </div>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 mb-4">
              Secure, Compliant & Trusted
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Your data security and privacy are our top priorities. Built with enterprise-grade security for IB schools worldwide.
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Shield,
              title: 'GDPR Compliant',
              description: 'Full compliance with EU data protection regulations. Your school data stays private and secure.',
              color: 'from-blue-500 to-blue-600'
            },
            {
              icon: Lock,
              title: 'End-to-End Encryption',
              description: 'Bank-level AES-256 encryption for all data in transit and at rest. Your information is always protected.',
              color: 'from-purple-500 to-purple-600'
            },
            {
              icon: FileCheck,
              title: 'FERPA Compliant',
              description: 'Meets US student privacy regulations. Safe handling of educational records and student data.',
              color: 'from-cyan-500 to-cyan-600'
            }
          ].map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-200 hover:border-blue-300 hover:shadow-2xl transition-all group"
            >
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <item.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-slate-500 mb-4">Trusted by leading IB schools worldwide</p>
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {['🔒 SSL/TLS', '✓ Privacy Shield', '🔐 2FA Enabled'].map((badge, i) => (
              <div key={i} className="px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full border border-slate-200 text-sm font-semibold text-slate-700">
                {badge}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}