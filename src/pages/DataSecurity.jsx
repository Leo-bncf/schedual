import React from 'react';
import { Shield, Lock, Globe, FileCheck, Server, Eye, UserCheck, CheckCircle } from 'lucide-react';
import LandingHeader from '../components/landing/LandingHeader';
import LandingFooter from '../components/landing/LandingFooter';
import { Card, CardContent } from '@/components/ui/card';

export default function DataSecurity() {
  const complianceFeatures = [
    {
      icon: Shield,
      title: 'GDPR Compliant',
      description: 'Full compliance with EU data protection regulations. Your school data stays private and secure.',
      details: [
        'Right to access, rectify, and delete data',
        'Data processing agreements available',
        'EU data residency options',
        'Transparent data handling practices'
      ]
    },
    {
      icon: Lock,
      title: 'End-to-End Encryption',
      description: 'Bank-level AES-256 encryption for all data in transit and at rest. Your information is always protected.',
      details: [
        'AES-256 encryption at rest',
        'TLS 1.3 for data in transit',
        'Encrypted database backups',
        'Secure API communications'
      ]
    },
    {
      icon: Globe,
      title: 'ISO 27001 Certified',
      description: 'International standards for information security management. Audited and verified annually.',
      details: [
        'Annual third-party audits',
        'Documented security policies',
        'Risk assessment procedures',
        'Continuous improvement process'
      ]
    },
    {
      icon: FileCheck,
      title: 'FERPA Compliant',
      description: 'Meets US student privacy regulations. Safe handling of educational records and student data.',
      details: [
        'Student record protection',
        'Parental consent mechanisms',
        'Limited data sharing controls',
        'Audit trail for data access'
      ]
    }
  ];

  const securityMeasures = [
    {
      icon: Server,
      title: 'Infrastructure Security',
      description: 'Enterprise-grade hosting with redundancy and disaster recovery',
      features: [
        'Multi-region data centers',
        'Automatic daily backups',
        '99.9% uptime SLA',
        'DDoS protection'
      ]
    },
    {
      icon: Eye,
      title: 'Access Control',
      description: 'Role-based permissions ensure only authorized users can access data',
      features: [
        'Multi-factor authentication (2FA)',
        'Role-based access control (RBAC)',
        'Session management',
        'IP-based access restrictions'
      ]
    },
    {
      icon: UserCheck,
      title: 'Data Privacy',
      description: 'Your data is yours - we never share, sell, or use it for other purposes',
      features: [
        'No third-party data sharing',
        'Data isolation per school',
        'Privacy by design',
        'Transparent data usage'
      ]
    }
  ];

  const certifications = [
    { name: 'SOC 2 Type II', status: 'Certified' },
    { name: 'ISO 27001', status: 'Certified' },
    { name: 'GDPR', status: 'Compliant' },
    { name: 'FERPA', status: 'Compliant' },
    { name: 'COPPA', status: 'Compliant' }
  ];

  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 text-white py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600 rounded-full blur-3xl"></div>
        </div>
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-3 mb-6 px-6 py-3 bg-white/10 backdrop-blur-lg rounded-full border border-white/20">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-semibold">Enterprise-Grade Security & Compliance</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold mb-6">
            Secure, Compliant & Trusted
          </h1>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto">
            Your data security and privacy are our top priorities. Built with enterprise-grade security for IB schools worldwide.
          </p>
        </div>
      </section>

      {/* Compliance Cards */}
      <section className="py-20 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {complianceFeatures.map((feature, idx) => {
              const Icon = feature.icon;
              const colors = [
                { bg: 'from-blue-50 to-blue-100', icon: 'text-blue-700', border: 'border-blue-200' },
                { bg: 'from-purple-50 to-purple-100', icon: 'text-purple-700', border: 'border-purple-200' },
                { bg: 'from-emerald-50 to-emerald-100', icon: 'text-emerald-700', border: 'border-emerald-200' },
                { bg: 'from-cyan-50 to-cyan-100', icon: 'text-cyan-700', border: 'border-cyan-200' }
              ][idx];

              return (
                <Card key={idx} className={`border-2 ${colors.border} bg-gradient-to-br ${colors.bg} hover:shadow-xl transition-shadow`}>
                  <CardContent className="p-6">
                    <div className={`w-14 h-14 rounded-2xl bg-white flex items-center justify-center mb-4 shadow-sm`}>
                      <Icon className={`w-7 h-7 ${colors.icon}`} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                    <p className="text-sm text-slate-700 mb-4">{feature.description}</p>
                    <ul className="space-y-2">
                      {feature.details.map((detail, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security Measures */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Security Measures</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Multi-layered protection to keep your school's data safe and accessible
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {securityMeasures.map((measure, idx) => {
              const Icon = measure.icon;
              return (
                <Card key={idx} className="border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-900 to-blue-800 flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{measure.title}</h3>
                    <p className="text-sm text-slate-600 mb-4">{measure.description}</p>
                    <ul className="space-y-2">
                      {measure.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-900"></div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-20 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Certifications & Compliance</h2>
            <p className="text-lg text-slate-600">
              Independently verified and audited security standards
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {certifications.map((cert, idx) => (
              <Card key={idx} className="border-2 border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div className="font-bold text-slate-900 mb-1">{cert.name}</div>
                  <div className="text-xs text-emerald-700 font-semibold">{cert.status}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Data Handling Principles */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Our Data Handling Principles</h2>
          </div>

          <div className="space-y-6">
            <Card className="border-l-4 border-blue-900">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Data Minimization</h3>
                <p className="text-slate-600">
                  We only collect and store data necessary for scheduling operations. No unnecessary personal information is gathered or retained.
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-blue-900">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Data Isolation</h3>
                <p className="text-slate-600">
                  Each school's data is completely isolated with row-level security. Schools cannot access or view data from other institutions.
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-blue-900">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Data Retention</h3>
                <p className="text-slate-600">
                  You control your data. Export anytime, delete on request. We retain data only as long as your subscription is active (plus legally required periods for billing records).
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-blue-900">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Transparency</h3>
                <p className="text-slate-600">
                  Clear audit logs show who accessed or modified data. No hidden data usage. Full transparency in how we process scheduling information.
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-blue-900">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-2">No AI Training on Your Data</h3>
                <p className="text-slate-600">
                  Your school data is never used to train AI models. All scheduling algorithms operate on your data in isolation without contributing to external model training.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Security Contact */}
      <section className="py-20 px-6 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-white rounded-2xl p-12 shadow-xl border border-slate-200">
            <Shield className="w-16 h-16 text-blue-900 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Questions About Security?</h2>
            <p className="text-slate-600 mb-8">
              Our security team is here to address any concerns or questions about data protection, compliance, or our security practices.
            </p>
            <a 
              href="#demo-booking"
              className="inline-block px-8 py-4 bg-blue-900 text-white font-semibold rounded-xl hover:bg-blue-800 transition-colors shadow-lg"
            >
              Contact Security Team
            </a>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}