import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Minus, Calendar, Users, Sparkles, Shield, CreditCard, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPageUrl } from '../../utils';
import { motion, AnimatePresence } from 'framer-motion';

const faqData = [
  {
    category: '📚 Getting Started',
    icon: Calendar,
    questions: [
      {
        q: 'What is Schedual used for?',
        a: 'Schedual is an AI-powered master timetabling system designed specifically for IB World Schools across all three programmes (PYP, MYP, and DP). It uses advanced OptaPlanner constraint satisfaction algorithms to automatically generate optimized schedules that simultaneously satisfy complex IB requirements, teacher qualifications and availability, room capacity constraints, and student subject choices. The system can handle everything from DP HL/SL hour requirements (typically 6h/week HL, 4h/week SL) to elective block scheduling, TOK/CAS/EE core components, and PYP/MYP class group batches - saving coordinators weeks of manual work and eliminating scheduling conflicts.'
      },
      {
        q: 'Who can use this app?',
        a: 'Schedual is designed exclusively for authorized IB World Schools with active IB programme authorization. The primary users are schedule coordinators, DP coordinators, academic directors, and school administrators responsible for creating master timetables. Each school can have multiple admin users (based on their subscription tier limits - Tier 1: 3 seats, Tier 2: 5 seats, Tier 3: unlimited) who collaborate on schedule creation. The system requires an active subscription and school verification before access is granted.'
      },
      {
        q: 'Do I need an account to use the app?',
        a: 'Yes. Schedual requires both authentication and an active subscription. A school administrator must first subscribe to one of our three tier plans ($1,100-$4,950/year depending on school size and programmes), then create their admin account. After subscription activation, they can invite additional admin users from their school (Tier 1: up to 3 admins, Tier 2: up to 5 admins, Tier 3: unlimited admins, with Extra Admin User add-ons available at $275/year per seat). All users authenticate via email verification with 2FA support for enhanced security. Students and teachers do not have login access unless explicitly invited with appropriate permissions.'
      },
      {
        q: 'What platforms is the app available on?',
        a: 'Schedual is a web-based application accessible from any modern browser (Chrome, Safari, Firefox, Edge) on desktop, laptop, or tablet. No iOS or Android app installation is required.'
      }
    ]
  },
  {
    category: '🎓 IB Scheduling Features',
    icon: Sparkles,
    questions: [
      {
        q: 'How does the AI scheduler work?',
        a: 'Schedual uses OptaPlanner, an enterprise-grade constraint satisfaction solver, combined with custom IB-specific algorithms. The system first runs a comprehensive pre-solve audit checking for data completeness (missing HL/SL hours, unassigned teachers, room capacity issues). Then it constructs a complex optimization problem with hard constraints (e.g., no teacher/student double-booking, mandatory IB hour requirements) and soft constraints (e.g., teacher preferences, period distribution). The solver iteratively explores millions of possible schedule configurations, scoring each solution until it finds an optimal arrangement. It automatically handles DP1/DP2 combinations, elective blocks (students choosing different Group 2 languages scheduled concurrently), TOK/CAS/EE core assignments, and PYP/MYP class group schedules. Generation typically completes in 2-5 minutes depending on school size.'
      },
      {
        q: 'Can I customize scheduling rules and constraints?',
        a: 'Yes. You can define hard constraints (must-follow rules like "teachers cannot teach more than 4 consecutive periods") and soft constraints (preferences like "prefer morning slots for science labs"). The AI respects all constraints during optimization.'
      },
      {
        q: 'What if the AI can\'t generate a feasible schedule?',
        a: 'If the solver cannot find a feasible solution due to violated hard constraints, your existing schedule data is always preserved - no data is lost or overwritten. The system provides a comprehensive diagnostic panel showing exactly which constraints failed (e.g., "Physics HL requires 360 minutes/week but only 240 periods available" or "Room capacity: 15 rooms needed, only 12 available"). Each violation includes the specific entity IDs involved, request tracking numbers for support, and actionable suggestions (add more rooms, reduce student group sizes, adjust period configuration, increase teacher hours). You can download the full diagnostic report as JSON for detailed analysis, and a direct link to the relevant Reports page helps identify bottlenecks before regenerating.'
      },
      {
        q: 'Can I combine DP1 and DP2 students in the same teaching groups?',
        a: 'Yes. For subjects configured with "combine_dp1_dp2" enabled, the system automatically creates combined teaching groups. Otherwise, DP1 and DP2 students are scheduled separately.'
      }
    ]
  },
  {
    category: '👥 Students, Teachers & Rooms',
    icon: Users,
    questions: [
      {
        q: 'How do I import students, teachers, and rooms?',
        a: 'Schedual supports three import methods: (1) Bulk CSV/Excel upload - drag and drop your files on the Students, Teachers, or Rooms pages. Our AI extraction engine automatically detects columns and maps them to the correct fields (name, email, qualifications, etc.). (2) Manual entry - add individual records one at a time through the UI forms with built-in validation. (3) AI Import Agents - upload unstructured documents (PDFs, images, Word docs) and our AI agents extract structured data, which you can review and approve before import. All imports validate for duplicates, required fields, and IB-specific rules (e.g., DP students must have 6 subjects). You can also export data as CSV at any time for backup or migration purposes.'
      },
      {
        q: 'How are teaching groups created?',
        a: 'Teaching group creation varies by programme: For DP, the system analyzes all student subject choices and automatically clusters students with identical selections into teaching groups (e.g., all students taking Physics HL → "Physics HL - Group A"). If a subject has combine_dp1_dp2 enabled, DP1 and DP2 students are merged into single groups; otherwise they\'re separated. For PYP/MYP, you manually create class groups (batches like "MYP3-Batch-A") with defined student rosters, then the system schedules core subjects for each batch. Teachers are auto-assigned based on their qualifications (which subjects and IB levels they can teach), availability constraints, and workload limits. You can override automatic assignments or use our AI-powered group generator for optimized clustering.'
      },
      {
        q: 'Can I set teacher availability and preferences?',
        a: 'Yes. Each teacher profile includes comprehensive constraint settings: (1) Unavailable slots - mark specific day/period combinations when the teacher cannot teach (e.g., Wednesday Period 3 for external commitments). (2) Preferred free day - request one full day off per week (enforced as a soft constraint). (3) Max hours per week - hard limit on total teaching hours (default 25h, configurable). (4) Max consecutive periods - prevent teacher burnout by limiting back-to-back classes (default 4, configurable). (5) Subject-level qualifications - specify which subjects and IB levels (PYP/MYP/DP) each teacher is qualified to teach. All constraints are strictly enforced during schedule generation, and violations are flagged in the pre-solve audit before the solver runs.'
      },
      {
        q: 'What if I don\'t have enough rooms?',
        a: 'The system will flag room capacity issues in the pre-solve audit. You can add more rooms, increase room capacities, or configure subjects to share rooms (e.g., electives in the same block).'
      }
    ]
  },
  {
    category: '📅 Schedule Management',
    icon: Calendar,
    questions: [
      {
        q: 'Can I create multiple schedule versions?',
        a: 'Yes. Schedual supports unlimited draft schedule versions, allowing you to experiment with different configurations (e.g., different period lengths, constraint sets, teacher assignments) and compare results side-by-side. Each version is timestamped with generation metadata including optimization score, conflict counts, and which constraints were applied. You can name versions descriptively (e.g., "Draft v3 - 60min periods", "Final 2025-26"). Only one version can have "published" status at a time, which designates it as the official schedule visible to students and teachers. Published schedules are locked from deletion to prevent accidental data loss. You can archive old versions for historical reference.'
      },
      {
        q: 'How do I view student and teacher schedules?',
        a: 'After generating a schedule, use the Students and Teachers tabs to view individual timetables. You can export schedules as PDFs or images for printing and distribution.'
      },
      {
        q: 'Can I manually edit the generated schedule?',
        a: 'Currently, Schedual focuses on constraint-driven AI optimization rather than manual slot editing. If you need to adjust the schedule, the recommended workflow is: (1) Identify the issue (e.g., teacher has too many early morning slots). (2) Add or modify constraints (e.g., add soft constraint "prefer afternoon slots for Teacher X"). (3) Regenerate the schedule with the updated constraint set. This approach ensures the entire schedule remains optimized and conflict-free, rather than creating cascading issues from manual changes. Manual slot editing and drag-drop rescheduling features are planned for future releases based on user feedback. For urgent manual changes, contact our Priority Support team for assistance.'
      },
      {
        q: 'What happens if I update data after generating a schedule?',
        a: 'A banner alerts you when underlying data (teachers, students, rooms, teaching groups) has changed since the last generation. You can regenerate to incorporate the updates.'
      }
    ]
  },
  {
    category: '💳 Pricing & Subscriptions',
    icon: CreditCard,
    questions: [
      {
        q: 'Is the app free or paid?',
        a: 'Schedual is a paid subscription service with three annual tiers: Tier 1 ($1,100/year) for small schools under 400 students with MYP/DP only, includes 3 admin seats and single campus. Tier 2 ($2,200/year) for standard schools under 400 students with full PYP+MYP+DP continuum, includes 5 admin seats. Tier 3 ($4,950/year) for large/multi-campus schools 400+ students with full programme access and unlimited admin seats. Add-ons: Priority Support ($550/year for faster response times), ManageBac Integration ($1,100/year for automatic data sync), Advanced Constraint Engine ($660/year for custom rule builder), Custom SIS/LMS Integration ($1,320 setup + $2,200/year), Unlimited Campuses ($1,650/year), Extra Admin User ($275/year per seat), and Onboarding & First Setup ($1,320 one-time for guided implementation). All prices are annual subscriptions billed via Stripe. New schools can request trial periods before purchasing.'
      },
      {
        q: 'Can I try before buying?',
        a: 'Yes. New schools get a trial period to test all features before subscription billing begins. Contact us via the demo booking form to schedule a personalized walkthrough.'
      },
      {
        q: 'What payment methods are supported?',
        a: 'We accept all major credit cards (Visa, Mastercard, Amex) and bank transfers via Stripe Checkout. Subscriptions are billed annually.'
      },
      {
        q: 'Can I upgrade or downgrade my tier?',
        a: 'Yes. You can change tiers or add/remove add-ons from your Account Manager page. Changes are prorated based on your billing cycle.'
      },
      {
        q: 'How are refunds handled?',
        a: 'Please contact our support team via the Support Ticket page for refund requests. Refunds are handled on a case-by-case basis according to our Terms of Use.'
      }
    ]
  },
  {
    category: '⚙️ Configuration & Settings',
    icon: Settings,
    questions: [
      {
        q: 'How do I configure school timing (periods per day, breaks, etc.)?',
        a: 'Navigate to Settings page to configure your school\'s timing structure: (1) Day start/end times (e.g., 8:00 AM - 6:00 PM). (2) Period duration in minutes (default 60 minutes, typically 50-70 min for IB schools). (3) Operating days (Monday-Friday standard, customizable if needed). (4) Break periods - define start/end times for morning break, lunch, afternoon break (e.g., 10:30-11:00, 12:30-13:30). The system automatically calculates available periods per day by subtracting breaks from the total time range, divided by period duration. For example: 8:00-18:00 (600 min) - 90 min breaks = 510 min ÷ 60 min periods = 8 periods/day. You can also configure test slots as special "TEST" subjects with supervisor teachers. Changes to timing require schedule regeneration to take effect.'
      },
      {
        q: 'What are HL and SL hours, and how do I set them?',
        a: 'HL (Higher Level) and SL (Standard Level) are the two proficiency tiers in the IB Diploma Programme. IB mandates specific teaching time requirements: HL courses typically require 240 teaching hours over two years (approximately 6 hours/week in a year-long schedule), while SL courses require 150 teaching hours (approximately 4 hours/week). In Schedual, you configure these on the Subjects page for each DP subject by setting the "hoursPerWeekHL" and "hoursPerWeekSL" fields. For example, Physics might be configured with hoursPerWeekHL=6 and hoursPerWeekSL=4. These values are CRITICAL for schedule generation - if missing or misconfigured, the solver will fail with diagnostic errors. The system converts hours to periods automatically (e.g., 6h/week ÷ 60min periods = 6 periods/week) and ensures teaching groups receive the correct allocation.'
      },
      {
        q: 'Can I add custom constraints for my school?',
        a: 'Yes. Use the Constraints tab to define hard constraints (must-follow rules) or soft constraints (preferences). Describe your rule in natural language and our AI converts it to a structured constraint.'
      }
    ]
  },
  {
    category: '🔐 Privacy & Security',
    icon: Shield,
    questions: [
      {
        q: 'Is my school\'s data secure?',
        a: 'Yes. Schedual implements enterprise-grade security measures: AES-256 encryption for all data at rest in our databases, TLS 1.3 encryption for all data in transit, encrypted automated daily backups, and secure API communications. We enforce strict role-based access control (RBAC) with row-level security - each school\'s data is completely isolated, and only authenticated admin users from your specific school can access your data. Multi-factor authentication (2FA) is available for enhanced account security. We are GDPR and FERPA compliant, ISO 27001 certified, and SOC 2 Type II audited. Your school data is NEVER used to train AI models, never shared with third parties, and never sold. We maintain comprehensive audit logs showing who accessed or modified data. Data residency options available for EU schools. For complete details, see our Data Security page.'
      },
      {
        q: 'Can I export or delete my data?',
        a: 'Yes. Schedual provides comprehensive data export options: (1) Schedule exports - individual student/teacher schedules as PDFs or high-resolution PNG images for printing and distribution. (2) Bulk data exports - all students, teachers, rooms, subjects, and teaching groups as CSV files for backup or migration. (3) Diagnostic exports - technical schedule generation logs as JSON for analysis or support troubleshooting. (4) Full account deletion - to permanently delete your school account and all associated data (students, teachers, schedules, billing history), submit a request via the Support Ticket page. Our team will process deletion requests within 48 hours and confirm completion. Note: Billing records may be retained for legally required tax/accounting periods (typically 7 years) even after account deletion, as mandated by financial regulations.'
      },
      {
        q: 'Who can see student schedules?',
        a: 'Only admin users from your school can view schedules. Students and teachers do not have login access unless explicitly invited with appropriate roles.'
      }
    ]
  },
  {
    category: '📊 Reports & Analytics',
    icon: Settings,
    questions: [
      {
        q: 'What reports are available?',
        a: 'The Reports page provides teacher workload analysis, room utilization stats, subject coverage reports, and bottleneck detection. You can identify over/under-utilized resources and scheduling inefficiencies.'
      },
      {
        q: 'Can I track schedule generation history?',
        a: 'Yes. Each schedule version is timestamped with generation metadata, including which constraints were applied, optimization scores, and conflict counts.'
      },
      {
        q: 'Can I export reports?',
        a: 'Yes. All schedules can be exported as PDFs or images. Diagnostic data can be downloaded as JSON for technical analysis.'
      }
    ]
  },
  {
    category: '🛠 Technical Support',
    icon: Settings,
    questions: [
      {
        q: 'What should I do if schedule generation fails?',
        a: 'If schedule generation fails, follow this troubleshooting workflow: (1) Read the error message and diagnostics panel carefully - it identifies exactly which hard constraints were violated. (2) Common issues include: Missing hoursPerWeekHL/SL fields on DP subjects (go to Subjects page, set required hours per IB standards), insufficient rooms (add more rooms or increase capacity on Rooms page), insufficient teacher hours (reduce teacher assignments or increase max_hours_per_week), invalid period configuration (check Settings - ensure breaks don\'t exceed available time), unassigned teaching groups (use auto-assign or manual teacher assignment). (3) Use the Reports page to identify bottlenecks before regenerating. (4) Download the diagnostic JSON for detailed technical analysis. (5) If you can\'t resolve the issue, create a Support Ticket with your request ID and diagnostic data - our team can analyze your configuration and provide specific guidance within 24-48 hours (faster for Priority Support customers).'
      },
      {
        q: 'How do I contact customer support?',
        a: 'Authenticated school admins can create support tickets directly from the Support Ticket page in their dashboard. Fill out the ticket form with your subject, detailed description, and priority level (low/medium/high/urgent). Our support team monitors tickets continuously and typically responds within 24-48 hours for standard support tiers. Priority Support add-on customers ($550/year) receive faster response times (4-8 hours for urgent issues) and dedicated support channels. For pre-sales questions or demo requests, use the "Book a Demo" form on the landing page or email us directly. For security-related concerns, contact our security team via the Data Security page. All support communications are tracked with unique ticket IDs for follow-up and resolution verification.'
      },
      {
        q: 'Is there a help center or tutorial?',
        a: 'Yes. New schools are guided through an interactive Setup Guide (Onboarding page) that walks you through initial configuration, data import, and first schedule generation.'
      },
      {
        q: 'How do I reset my password?',
        a: 'Use the "Forgot Password" link on the login page. You\'ll receive a verification code via email to reset your password securely.'
      }
    ]
  }
];

export default function FAQSection() {
  const [openItems, setOpenItems] = useState(new Set());

  const toggleItem = (categoryIdx, questionIdx) => {
    const key = `${categoryIdx}-${questionIdx}`;
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isOpen = (categoryIdx, questionIdx) => {
    return openItems.has(`${categoryIdx}-${questionIdx}`);
  };

  return (
    <section className="pt-32 pb-24 bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Everything you need to know about Schedual for IB schools
          </p>
        </div>

        {/* FAQ Categories */}
        <div className="space-y-8">
          {faqData.map((category, catIdx) => {
            const Icon = category.icon;
            return (
              <div key={catIdx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                {/* Category Header */}
                <div className="bg-gradient-to-r from-blue-50 to-slate-50 px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-blue-900" />
                    <h3 className="text-lg font-bold text-slate-900">{category.category}</h3>
                  </div>
                </div>

                {/* Questions */}
                <div className="divide-y divide-slate-100">
                  {category.questions.map((item, qIdx) => {
                    const isItemOpen = isOpen(catIdx, qIdx);
                    return (
                      <div key={qIdx}>
                        <button
                          onClick={() => toggleItem(catIdx, qIdx)}
                          className="w-full text-left px-6 py-4 hover:bg-slate-50 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <span className="font-semibold text-slate-900 group-hover:text-blue-900 transition-colors flex-1">
                              {item.q}
                            </span>
                            <div className="flex-shrink-0">
                              {isItemOpen ? (
                                <div className="w-6 h-6 rounded-full bg-blue-900 flex items-center justify-center">
                                  <Minus className="w-4 h-4 text-white" />
                                </div>
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-blue-900 flex items-center justify-center">
                                  <Plus className="w-4 h-4 text-white" />
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                        
                        <AnimatePresence>
                          {isItemOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="px-6 pb-4 text-slate-600 leading-relaxed">
                                {item.a}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Footer */}
        <div className="mt-16 text-center bg-gradient-to-br from-blue-900 to-blue-800 rounded-2xl p-8 text-white">
          <h3 className="text-2xl font-bold mb-3">Still have questions?</h3>
          <p className="text-blue-100 mb-6 max-w-xl mx-auto">
            Our team is here to help you get started with automated IB timetabling
          </p>
          <Link 
            to={createPageUrl('Support')}
            className="inline-block px-8 py-3 bg-white text-blue-900 font-semibold rounded-xl hover:bg-blue-50 transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </section>
  );
}