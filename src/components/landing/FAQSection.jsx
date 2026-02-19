import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Minus, Calendar, Users, Sparkles, Shield, CreditCard, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPageUrl } from '../../utils';

const faqData = [
  {
    category: '📚 Getting Started',
    icon: Calendar,
    questions: [
      {
        q: 'What is Schedual used for?',
        a: 'Schedual is an AI-powered master timetabling system designed specifically for IB schools (PYP, MYP, DP). It automatically generates optimized schedules that satisfy IB requirements, teacher qualifications, room constraints, and student subject choices - saving weeks of manual work.'
      },
      {
        q: 'Who can use this app?',
        a: 'Schedual is designed for IB World Schools, particularly schedule coordinators, academic directors, and school administrators responsible for creating master timetables for Primary Years, Middle Years, and Diploma Programme students.'
      },
      {
        q: 'Do I need an account to use the app?',
        a: 'Yes. School administrators need to subscribe to a tier plan and create an account. Once subscribed, they can invite additional admin users (based on their tier limits) to collaborate on scheduling.'
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
        a: 'Our OptaPlanner-powered engine analyzes your school\'s constraints (teachers, rooms, student choices, IB requirements) and generates an optimized master schedule. It handles DP HL/SL splits, shared subject blocks, elective groupings, and core components (TOK, CAS, EE) automatically.'
      },
      {
        q: 'Can I customize scheduling rules and constraints?',
        a: 'Yes. You can define hard constraints (must-follow rules like "teachers cannot teach more than 4 consecutive periods") and soft constraints (preferences like "prefer morning slots for science labs"). The AI respects all constraints during optimization.'
      },
      {
        q: 'What if the AI can\'t generate a feasible schedule?',
        a: 'If hard constraints are violated (e.g., not enough rooms or teachers for the required hours), the system provides a detailed diagnostic report showing which constraints failed, with actionable suggestions to fix configuration issues. Your existing schedule is always preserved.'
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
        a: 'You can bulk upload via CSV/Excel files on the Students, Teachers, and Rooms pages. Our AI data extraction tool automatically maps columns to the correct fields. You can also add entries individually or use the AI import agents.'
      },
      {
        q: 'How are teaching groups created?',
        a: 'For DP, the system auto-generates teaching groups based on student subject choices (e.g., all HL Physics students → Physics HL Group A). For PYP/MYP, you create class groups (batches) and assign subjects. Teachers are auto-assigned based on qualifications.'
      },
      {
        q: 'Can I set teacher availability and preferences?',
        a: 'Yes. Each teacher profile supports unavailable slots, preferred free days, max hours per week, and max consecutive periods. These are enforced as constraints during schedule generation.'
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
        a: 'Yes. You can create unlimited draft versions to compare different configurations. Only one version can be published at a time, which becomes the official student/teacher schedule.'
      },
      {
        q: 'How do I view student and teacher schedules?',
        a: 'After generating a schedule, use the Students and Teachers tabs to view individual timetables. You can export schedules as PDFs or images for printing and distribution.'
      },
      {
        q: 'Can I manually edit the generated schedule?',
        a: 'The current version focuses on AI-optimized generation. Manual slot editing is in development. For now, adjust constraints and regenerate to refine the schedule.'
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
        a: 'Schedual requires a subscription. We offer three tiers: Tier 1 (small schools, MYP only, $1,100/year), Tier 2 (PYP+MYP+DP, $2,200/year), and Tier 3 (multi-campus, $4,950/year). Add-ons available for integrations, priority support, and extra admin seats.'
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
        a: 'Go to Schedule → Settings tab to configure day start/end times, period duration, breaks, lunch periods, and test slots. The system auto-calculates periods per day based on your time range.'
      },
      {
        q: 'What are HL and SL hours, and how do I set them?',
        a: 'HL (Higher Level) and SL (Standard Level) are DP subject levels. Each DP subject requires hoursPerWeekHL and hoursPerWeekSL configured on the Subjects page (typically 6h/week for HL, 4h/week for SL per IB standards).'
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
        a: 'Yes. All data is encrypted in transit and at rest. We use enterprise-grade security with role-based access control. Only authorized admin users from your school can access your scheduling data.'
      },
      {
        q: 'Can I export or delete my data?',
        a: 'Yes. You can export schedules as PDFs/images and data as CSV files. To delete your school account and all associated data, contact support via the Support Ticket page.'
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
        a: 'Check the error message and diagnostics panel. Common issues: missing HL/SL hours on DP subjects, insufficient rooms/teachers, or invalid school timing configuration. The system provides step-by-step guidance to fix issues.'
      },
      {
        q: 'How do I contact customer support?',
        a: 'School admins can create support tickets from the Support Ticket page. Our team typically responds within 24-48 hours (Priority Support customers get faster response times).'
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
    <section className="py-24 bg-gradient-to-b from-white to-slate-50">
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
                            <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center flex-shrink-0">
                              {isItemOpen ? (
                                <Minus className="w-4 h-4 text-white transition-all" />
                              ) : (
                                <Plus className="w-4 h-4 text-white transition-all" />
                              )}
                            </div>
                          </div>
                        </button>
                        
                        {isItemOpen && (
                          <div className="px-6 pb-4 text-slate-600 leading-relaxed">
                            {item.a}
                          </div>
                        )}
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