import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Mail, MapPin, Building } from 'lucide-react';
import LandingHeader from '../components/landing/LandingHeader';
import LandingFooter from '../components/landing/LandingFooter';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_42%,#eef4ff_100%)]">
      <LandingHeader />
      <main className="px-4 py-12 pt-36 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white/85 p-8 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-12 mb-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.08),transparent_28%)]" />
            <div className="relative text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mb-4">Privacy Policy</h1>
              <p className="text-lg text-slate-600">Last updated: December 23, 2025</p>
            </div>
          </div>

          <Card className="border border-slate-200 bg-white/90 shadow-sm mb-8">
            <CardContent className="p-8 sm:p-10 space-y-8">
            {/* Introduction */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">1. Introduction</h2>
              <p className="text-slate-700 leading-8 mb-4">
                Schedual is an all-in-one, fully integrated intelligent scheduling engine and administrative control panel designed specifically for International Baccalaureate (IB) Diploma Programme schools. Our platform helps schools create optimized and flexible timetables while accommodating complex curriculum constraints and administrative requirements.
              </p>
              <p className="text-slate-700 leading-8 mb-4">
                Schedual is committed to protecting personal data and complying with the General Data Protection Regulation (EU) 2016/679 (GDPR) and all applicable French and European data protection laws.
              </p>
              <p className="text-slate-700 leading-8">
                This Privacy Policy explains how we collect, use, store, and protect personal data when users access or use our platform, website, or related services (collectively, the "Services").
              </p>
            </section>

            {/* Data Controller */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">2. Data Controller</h2>
              <p className="text-slate-700 leading-8 mb-4">
                The data controller responsible for processing personal data is:
              </p>
              <div className="bg-slate-50 rounded-lg p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <Building className="w-5 h-5 text-indigo-600" />
                  <span className="text-slate-900 font-medium">Company name: Schedual</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-indigo-600" />
                  <span className="text-slate-900">Address: Montpellier, France</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-indigo-600" />
                  <span className="text-slate-900">Contact email: support@schedual-pro.com</span>
                </div>
              </div>
            </section>

            {/* Categories of Personal Data */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">3. Categories of Personal Data Processed</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">3.1 Data Provided Directly by Users</h3>
                  <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                    <li>Full name</li>
                    <li>Professional email address</li>
                    <li>School or institution name</li>
                    <li>User role (administrator, teacher, staff)</li>
                    <li>Account credentials</li>
                    <li>Communications sent via support or contact forms</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">3.2 Data Related to Scheduling and Administration</h3>
                  <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                    <li>Teaching availability and constraints</li>
                    <li>Subject assignments and curriculum data</li>
                    <li>Class, group, and timetable information</li>
                    <li>Administrative configuration data</li>
                  </ul>
                  <p className="text-slate-700 leading-8 mt-3">
                    This data is processed solely for the purpose of generating optimized timetables and managing academic operations.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">3.3 Automatically Collected Data</h3>
                  <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                    <li>IP address</li>
                    <li>Device and browser information</li>
                    <li>Access logs and usage data</li>
                    <li>Cookies and similar technologies</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">3.4 Payment and Billing Data (if applicable)</h3>
                  <p className="text-slate-700 leading-8">
                    Payment information is processed exclusively by secure third-party payment providers. Schedual does not store full payment card details.
                  </p>
                </div>
              </div>
            </section>

            {/* Legal Bases */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">4. Legal Bases for Processing (Article 6 GDPR)</h2>
              <p className="text-slate-700 leading-8 mb-4">
                Schedual processes personal data based on the following legal grounds:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Performance of a contract with educational institutions (Article 6(1)(b))</li>
                <li>Legal obligations (Article 6(1)(c))</li>
                <li>Legitimate interests related to service security, optimization, and improvement (Article 6(1)(f))</li>
                <li>Consent, where explicitly required (Article 6(1)(a))</li>
              </ul>
            </section>

            {/* Purposes */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">5. Purposes of Processing</h2>
              <p className="text-slate-700 leading-8 mb-4">
                Personal data is processed to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Provide and operate the Schedual platform</li>
                <li>Generate optimized and compliant IB timetables</li>
                <li>Manage user accounts and permissions</li>
                <li>Provide technical support and system notifications</li>
                <li>Improve platform performance and reliability</li>
                <li>Ensure data security and prevent unauthorized access</li>
                <li>Comply with legal and regulatory obligations</li>
              </ul>
            </section>

            {/* Cookies */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">6. Cookies and Tracking Technologies</h2>
              <p className="text-slate-700 leading-8 mb-4">
                Schedual uses cookies strictly necessary for:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Platform authentication and security</li>
                <li>Session management</li>
                <li>Performance monitoring</li>
              </ul>
              <p className="text-slate-700 leading-8 mt-4">
                Where required, user consent is collected in accordance with EU regulations. Users may manage cookie preferences via their browser settings.
              </p>
            </section>

            {/* Data Sharing */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">7. Data Sharing and Processors</h2>
              <p className="text-slate-700 leading-8 mb-4 font-semibold">
                Schedual does not sell personal data.
              </p>
              <p className="text-slate-700 leading-8 mb-4">
                Personal data may be shared only with:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Hosting and infrastructure providers</li>
                <li>Payment service providers</li>
                <li>Analytics and monitoring services</li>
                <li>Legal authorities when legally required</li>
              </ul>
              <p className="text-slate-700 leading-8 mt-4">
                All processors are contractually bound to GDPR-compliant data protection obligations.
              </p>
            </section>

            {/* International Transfers */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">8. International Data Transfers</h2>
              <p className="text-slate-700 leading-8">
                Personal data is primarily processed within the European Union. If transfers outside the EEA occur, Schedual ensures appropriate safeguards, including Standard Contractual Clauses or adequacy decisions.
              </p>
            </section>

            {/* Data Retention */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">9. Data Retention</h2>
              <p className="text-slate-700 leading-8">
                Personal data is retained only for the duration necessary to fulfill contractual obligations or comply with legal requirements. Scheduling and administrative data is deleted or anonymized upon contract termination, unless legally required otherwise.
              </p>
            </section>

            {/* Data Subject Rights */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">10. Data Subject Rights</h2>
              <p className="text-slate-700 leading-8 mb-4">
                Under GDPR, users have the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Access their personal data</li>
                <li>Rectify inaccurate or incomplete data</li>
                <li>Request erasure of personal data</li>
                <li>Restrict or object to processing</li>
                <li>Request data portability</li>
                <li>Withdraw consent at any time</li>
              </ul>
              <p className="text-slate-700 leading-8 mt-4">
                Requests can be submitted to <a href="mailto:support@schedual-pro.com" className="text-indigo-600 hover:text-indigo-700 font-medium">support@schedual-pro.com</a>.
              </p>
            </section>

            {/* Complaints */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">11. Complaints</h2>
              <p className="text-slate-700 leading-8">
                Users have the right to lodge a complaint with the Commission Nationale de l'Informatique et des Libertés (CNIL) or their local EU data protection authority.
              </p>
            </section>

            {/* Data Security */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">12. Data Security</h2>
              <p className="text-slate-700 leading-8">
                Schedual implements appropriate technical and organizational security measures, including access controls, encryption, and monitoring, to protect personal data.
              </p>
            </section>

            {/* Changes */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">13. Changes to This Policy</h2>
              <p className="text-slate-700 leading-8">
                This Privacy Policy may be updated periodically. Changes will be published on this page with an updated revision date.
              </p>
            </section>
          </CardContent>
        </Card>

          <Card className="border border-indigo-100 shadow-sm bg-gradient-to-br from-indigo-50 to-violet-50">
            <CardContent className="p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Questions about this Privacy Policy?</h3>
              <p className="text-slate-700 mb-4 leading-7">
                If you have any questions or concerns about how we handle your personal data, please contact us:
              </p>
              <a 
                href="mailto:support@schedual-pro.com" 
                className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <Mail className="w-4 h-4" />
                support@schedual-pro.com
              </a>
            </CardContent>
          </Card>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}