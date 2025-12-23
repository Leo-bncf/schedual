import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Mail, Scale } from 'lucide-react';

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Terms of Use</h1>
          <p className="text-lg text-slate-600">
            Last updated: December 23, 2025
          </p>
        </div>

        {/* Main Content */}
        <Card className="border-0 shadow-sm mb-8">
          <CardContent className="p-8 space-y-8">
            {/* Purpose and Scope */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">1. Purpose and Scope</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                These Terms of Use govern access to and use of the Schedual platform, an intelligent scheduling and administrative system designed for IB Diploma Programme schools.
              </p>
              <p className="text-slate-700 leading-relaxed">
                By accessing or using the Services, users agree to these Terms.
              </p>
            </section>

            {/* Eligibility */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">2. Eligibility</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                Users must:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Act on behalf of an educational institution or with proper authorization</li>
                <li>Be legally capable of entering into a binding agreement</li>
                <li>Comply with applicable EU and national laws</li>
              </ul>
            </section>

            {/* User Accounts and Roles */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">3. User Accounts and Roles</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                Users are responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Maintaining confidentiality of login credentials</li>
                <li>Ensuring accuracy of provided information</li>
                <li>All actions performed under their account</li>
              </ul>
              <p className="text-slate-700 leading-relaxed mt-4">
                Administrators are responsible for managing user permissions within their institution.
              </p>
            </section>

            {/* Authorized Use */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">4. Authorized Use</h2>
              <p className="text-slate-700 leading-relaxed">
                The Services may only be used for legitimate educational and administrative purposes related to timetable creation and academic planning.
              </p>
            </section>

            {/* Prohibited Use */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">5. Prohibited Use</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                Users must not:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Use the platform for unlawful purposes</li>
                <li>Attempt to access unauthorized data or systems</li>
                <li>Reverse engineer or copy the platform</li>
                <li>Upload malicious or misleading data</li>
              </ul>
            </section>

            {/* Intellectual Property */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">6. Intellectual Property</h2>
              <p className="text-slate-700 leading-relaxed">
                All software, algorithms, interfaces, trademarks, and documentation are the exclusive property of Schedual or its licensors. No ownership rights are transferred.
              </p>
            </section>

            {/* Data Accuracy and Responsibility */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">7. Data Accuracy and Responsibility</h2>
              <p className="text-slate-700 leading-relaxed">
                Schedual relies on data provided by institutions. Users are responsible for the accuracy and completeness of scheduling, curriculum, and availability data.
              </p>
            </section>

            {/* Service Availability */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">8. Service Availability</h2>
              <p className="text-slate-700 leading-relaxed">
                Schedual aims for high availability but does not guarantee uninterrupted service. Maintenance, updates, or technical issues may result in temporary downtime.
              </p>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">9. Limitation of Liability</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                To the extent permitted by EU law:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Schedual is not liable for indirect or consequential damages</li>
                <li>Liability is limited to foreseeable damages arising from contractual obligations</li>
                <li>Nothing in these Terms limits liability where prohibited by law</li>
              </ul>
            </section>

            {/* Termination */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">10. Termination</h2>
              <p className="text-slate-700 leading-relaxed">
                Schedual may suspend or terminate access in cases of misuse, breach of these Terms, or legal obligation. Institutions may terminate usage according to contractual agreements.
              </p>
            </section>

            {/* Modifications */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">11. Modifications</h2>
              <p className="text-slate-700 leading-relaxed">
                Schedual may update these Terms at any time. Continued use constitutes acceptance of updated Terms.
              </p>
            </section>

            {/* Governing Law */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">12. Governing Law and Jurisdiction</h2>
              <p className="text-slate-700 leading-relaxed">
                These Terms are governed by French law and applicable European Union law. Any disputes fall under the jurisdiction of the competent courts of France.
              </p>
            </section>
          </CardContent>
        </Card>

        {/* Legal Notice Card */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-violet-50">
          <CardContent className="p-6">
            <div className="flex gap-3 items-start">
              <Scale className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Questions about these Terms?</h3>
                <p className="text-slate-700 mb-4">
                  If you have any questions about these Terms of Use or need clarification on any points, please contact us:
                </p>
                <a 
                  href="mailto:support@schedual-pro.com" 
                  className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  <Mail className="w-4 h-4" />
                  support@schedual-pro.com
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}