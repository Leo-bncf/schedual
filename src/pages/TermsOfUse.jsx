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
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Schedual – Terms of Use</h1>
          <p className="text-lg text-slate-600">
            Last updated: December 2024
          </p>
        </div>

        {/* Main Content */}
        <Card className="border-0 shadow-sm mb-8">
          <CardContent className="p-8 space-y-8">
            {/* Purpose and Scope */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">1. Purpose and Scope</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                These Terms of Use ("Terms") govern access to and use of the Schedual platform ("Schedual," "Platform," or "Services"), an intelligent timetable generation and academic administration system designed for International Baccalaureate (IB) Diploma Programme schools and related educational institutions.
              </p>
              <p className="text-slate-700 leading-relaxed mb-4">
                These Terms apply to all users, including administrators, teachers, coordinators, and institutional representatives ("Users").
              </p>
              <p className="text-slate-700 leading-relaxed mb-4">
                By accessing or using the Services, Users confirm that they have read, understood, and agreed to be bound by these Terms.
              </p>
              <p className="text-slate-700 leading-relaxed">
                If Users do not agree with these Terms, they must not access or use the Services.
              </p>
            </section>

            {/* Eligibility and Authority */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">2. Eligibility and Authority</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                Users represent and warrant that they:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Act on behalf of a recognized educational institution or have explicit authorization from such institution</li>
                <li>Are legally capable of entering into a binding agreement under applicable law</li>
                <li>Will comply with European Union law, French law, and all applicable national and local regulations</li>
                <li>Will use the Services exclusively in a professional and institutional capacity</li>
              </ul>
              <p className="text-slate-700 leading-relaxed mt-4">
                Schedual reserves the right to request proof of authorization at any time.
              </p>
            </section>

            {/* User Accounts, Roles, and Security */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">3. User Accounts, Roles, and Security</h2>
              
              <h3 className="text-xl font-semibold text-slate-900 mb-3 mt-4">3.1 Account Creation</h3>
              <p className="text-slate-700 leading-relaxed mb-4">
                Access to the Services requires the creation of a user account. Certain features are restricted to users with administrative privileges.
              </p>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">3.2 User Responsibilities</h3>
              <p className="text-slate-700 leading-relaxed mb-3">
                Users are solely responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Maintaining the confidentiality of login credentials</li>
                <li>Preventing unauthorized access to their account</li>
                <li>Ensuring that all information provided is accurate, complete, and up to date</li>
                <li>All actions taken through their account, whether authorized or not</li>
              </ul>

              <h3 className="text-xl font-semibold text-slate-900 mb-3 mt-4">3.3 Administrator Responsibilities</h3>
              <p className="text-slate-700 leading-relaxed mb-3">
                Institutional administrators are responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Assigning, managing, and revoking user roles and permissions</li>
                <li>Ensuring internal compliance with these Terms</li>
                <li>Managing access for staff members, contractors, or third parties</li>
              </ul>
              <p className="text-slate-700 leading-relaxed mt-4">
                Schedual is not responsible for internal misuse caused by improperly managed permissions.
              </p>
            </section>

            {/* Authorized Use */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">4. Authorized Use</h2>
              <p className="text-slate-700 leading-relaxed mb-3">
                The Services may only be used for legitimate educational, scheduling, and administrative purposes, including but not limited to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Timetable generation and optimization</li>
                <li>Academic planning and course allocation</li>
                <li>Teacher workload management</li>
                <li>Room and resource scheduling</li>
              </ul>
              <p className="text-slate-700 leading-relaxed mt-4">
                Any use outside these purposes is strictly prohibited unless explicitly authorized in writing by Schedual.
              </p>
            </section>

            {/* Prohibited Use */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">5. Prohibited Use</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                Users must not, directly or indirectly:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Use the Services for unlawful, fraudulent, or misleading purposes</li>
                <li>Attempt to access, probe, or interfere with unauthorized systems or data</li>
                <li>Reverse engineer, decompile, copy, scrape, or replicate the Platform or its algorithms</li>
                <li>Upload malicious code, corrupted files, or misleading data</li>
                <li>Circumvent usage limits, security measures, or access controls</li>
                <li>Use the Services in a manner that disrupts performance or availability</li>
              </ul>
              <p className="text-slate-700 leading-relaxed mt-4">
                Schedual may immediately suspend or terminate access upon detection of prohibited use.
              </p>
            </section>

            {/* Intellectual Property Rights */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">6. Intellectual Property Rights</h2>
              <p className="text-slate-700 leading-relaxed mb-3">
                All rights, title, and interest in and to the Services, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Software and source code</li>
                <li>Scheduling algorithms and optimization logic</li>
                <li>User interfaces, designs, and workflows</li>
                <li>Trademarks, logos, and branding</li>
                <li>Documentation and training materials</li>
              </ul>
              <p className="text-slate-700 leading-relaxed mt-4">
                are the exclusive property of Schedual or its licensors.
              </p>
              <p className="text-slate-700 leading-relaxed mt-3">
                No ownership rights are transferred to Users. Users receive a limited, non-exclusive, non-transferable, revocable license to use the Services in accordance with these Terms.
              </p>
            </section>

            {/* Data Ownership, Accuracy, and Responsibility */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">7. Data Ownership, Accuracy, and Responsibility</h2>
              
              <h3 className="text-xl font-semibold text-slate-900 mb-3 mt-4">7.1 Institutional Data</h3>
              <p className="text-slate-700 leading-relaxed mb-4">
                All data uploaded or entered into the Platform (including schedules, teacher availability, student groupings, and curriculum data) remains the property of the respective institution.
              </p>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">7.2 Data Accuracy</h3>
              <p className="text-slate-700 leading-relaxed mb-3">
                Users acknowledge that:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Schedual relies entirely on data provided by institutions</li>
                <li>Timetable outputs are only as accurate as the input data</li>
                <li>Users are solely responsible for verifying generated schedules before implementation</li>
              </ul>
              <p className="text-slate-700 leading-relaxed mt-4">
                Schedual is not responsible for errors resulting from inaccurate, incomplete, or outdated data.
              </p>
            </section>

            {/* Data Protection and Privacy */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">8. Data Protection and Privacy</h2>
              <p className="text-slate-700 leading-relaxed mb-3">
                Schedual processes personal data in accordance with:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>The General Data Protection Regulation (GDPR)</li>
                <li>Applicable French data protection laws</li>
              </ul>
              <p className="text-slate-700 leading-relaxed mt-4">
                Details regarding data processing, retention, and user rights are provided in Schedual's Privacy Policy, which forms an integral part of these Terms.
              </p>
              <p className="text-slate-700 leading-relaxed mt-3">
                Institutions act as data controllers, while Schedual acts as a data processor, unless otherwise agreed in writing.
              </p>
            </section>

            {/* Service Availability and Support */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">9. Service Availability and Support</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                Schedual aims to provide a high level of availability, but does not guarantee uninterrupted or error-free service.
              </p>
              <p className="text-slate-700 leading-relaxed mb-3">
                Users acknowledge that:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Scheduled maintenance may temporarily limit access</li>
                <li>Technical failures, updates, or external dependencies may cause downtime</li>
              </ul>
              <p className="text-slate-700 leading-relaxed mt-4">
                Schedual shall not be liable for interruptions that do not constitute a material breach of contractual obligations.
              </p>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">10. Limitation of Liability</h2>
              <p className="text-slate-700 leading-relaxed mb-3">
                To the maximum extent permitted by EU law:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Schedual shall not be liable for indirect, incidental, or consequential damages</li>
                <li>Schedual shall not be liable for loss of data, academic disruption, or operational decisions based on generated schedules</li>
                <li>Schedual's total liability is limited to foreseeable damages directly arising from contractual obligations</li>
              </ul>
              <p className="text-slate-700 leading-relaxed mt-4">
                Nothing in these Terms excludes or limits liability where such limitation is prohibited by law, including liability for gross negligence or willful misconduct.
              </p>
            </section>

            {/* Indemnification */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">11. Indemnification</h2>
              <p className="text-slate-700 leading-relaxed mb-3">
                Users agree to indemnify and hold harmless Schedual from any claims, damages, losses, or expenses arising from:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>Breach of these Terms</li>
                <li>Unauthorized or unlawful use of the Services</li>
                <li>Inaccurate or unlawful data provided by the institution</li>
              </ul>
            </section>

            {/* Suspension and Termination */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">12. Suspension and Termination</h2>
              <p className="text-slate-700 leading-relaxed mb-3">
                Schedual may suspend or terminate access, with or without notice, if:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
                <li>These Terms are breached</li>
                <li>Misuse or security risks are identified</li>
                <li>Required by law or regulatory authority</li>
              </ul>
              <p className="text-slate-700 leading-relaxed mt-4">
                Institutions may terminate use of the Services in accordance with applicable contractual agreements.
              </p>
              <p className="text-slate-700 leading-relaxed mt-3">
                Upon termination, access to the Platform will cease, subject to data retention obligations under applicable law.
              </p>
            </section>

            {/* Modifications to the Terms */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">13. Modifications to the Terms</h2>
              <p className="text-slate-700 leading-relaxed mb-3">
                Schedual reserves the right to modify these Terms at any time.
              </p>
              <p className="text-slate-700 leading-relaxed">
                Material changes will be communicated where required by law. Continued use of the Services after modifications constitutes acceptance of the updated Terms.
              </p>
            </section>

            {/* Governing Law and Jurisdiction */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">14. Governing Law and Jurisdiction</h2>
              <p className="text-slate-700 leading-relaxed mb-3">
                These Terms are governed by French law, with mandatory application of relevant European Union law.
              </p>
              <p className="text-slate-700 leading-relaxed">
                Any dispute arising from or related to these Terms shall fall under the exclusive jurisdiction of the competent courts of France, unless otherwise required by mandatory law.
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