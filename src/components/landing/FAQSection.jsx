import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Calendar, Users, Shield, CreditCard, Settings, Sparkles } from 'lucide-react';
import { createPageUrl } from '../../utils';
import { cn } from '@/lib/utils';

const faqData = [
  {
    category: 'Getting started',
    icon: Sparkles,
    questions: [
      {
        q: 'What is Schedual used for?',
        a: 'Schedual helps IB schools organize the data needed for timetable planning, including subjects, teachers, students, rooms, and schedule versions. The goal is to make timetable setup and iteration more structured and easier to manage.'
      },
      {
        q: 'Who is it for?',
        a: 'It is aimed at school teams responsible for timetable planning, such as IB coordinators, academic leaders, and operations staff.'
      },
      {
        q: 'Do I need an account?',
        a: 'Yes. School teams use authenticated accounts to access and manage their school data inside the platform.'
      },
      {
        q: 'Does it work on desktop and mobile?',
        a: 'Yes. It is a web-based product that works in modern browsers. The main setup experience is best on desktop, while lighter review tasks also work on smaller screens.'
      }
    ]
  },
  {
    category: 'Scheduling workflow',
    icon: Calendar,
    questions: [
      {
        q: 'Can I create multiple schedule versions?',
        a: 'Yes. You can work with different schedule versions so your team can compare drafts, review changes, and keep a clear history of iterations.'
      },
      {
        q: 'Can I manage teachers, students, subjects, and rooms in one place?',
        a: 'Yes. The platform is structured around those core timetable building blocks so schools can keep scheduling data in one system.'
      },
      {
        q: 'What happens if data changes after a schedule is generated?',
        a: 'The platform is designed to make version-based schedule work easier, so teams can review changes and regenerate when needed instead of losing their previous work.'
      },
      {
        q: 'Is the system focused on IB schools?',
        a: 'Yes. The product is positioned around IB school timetable workflows rather than being a generic school management platform.'
      }
    ]
  },
  {
    category: 'People and operations',
    icon: Users,
    questions: [
      {
        q: 'Can I import school data?',
        a: 'Yes. The app supports structured data setup for the main scheduling entities, and the product is being shaped to reduce repetitive admin work during onboarding.'
      },
      {
        q: 'Can I track teacher availability and scheduling inputs?',
        a: 'Yes. Teacher data and timetable-related configuration are part of the workflow so schools can build schedules around real staffing constraints.'
      },
      {
        q: 'Can different team members collaborate?',
        a: 'Yes. The platform is intended for school teams, not just a single user, so multiple admins can work on setup and scheduling tasks.'
      }
    ]
  },
  {
    category: 'Pricing and support',
    icon: CreditCard,
    questions: [
      {
        q: 'Can I request a demo?',
        a: 'Yes. You can use the Book Demo section on the landing page to request a walkthrough.'
      },
      {
        q: 'Where can I ask questions before signing up?',
        a: 'Use the contact page if you want to discuss your school, your timetable process, or whether the product is a good fit.'
      },
      {
        q: 'Is pricing available publicly?',
        a: 'Yes. Pricing is shown on the landing page so schools can review it alongside the main product information.'
      }
    ]
  },
  {
    category: 'Security and settings',
    icon: Shield,
    questions: [
      {
        q: 'Is school data separated by school?',
        a: 'Yes. The product is built around school-specific data access so each school works within its own records.'
      },
      {
        q: 'Can I configure school settings?',
        a: 'Yes. School setup includes configuration for timetable-related settings so the platform can reflect your school structure.'
      },
      {
        q: 'Where can I read more about privacy and legal terms?',
        a: 'You can review the Privacy Policy, Terms of Use, and Data Security pages from the site navigation and footer.'
      }
    ]
  }
];

export default function FAQSection() {
  const [openKey, setOpenKey] = useState('0-0');

  const totalQuestions = useMemo(
    () => faqData.reduce((sum, category) => sum + category.questions.length, 0),
    []
  );

  return (
    <section className="pt-40 pb-24 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_45%,#eef4ff_100%)]">
      <div className="max-w-6xl mx-auto px-6 sm:px-8">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900 mb-5">
            <Settings className="w-4 h-4" />
            Clear answers, no fluff
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mb-4">
            Frequently asked questions
          </h2>
          <p className="text-lg text-slate-600 leading-8">
            A simpler overview of what the product does, who it is for, and how schools can get started.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[280px,1fr] items-start">
          <aside className="lg:sticky lg:top-28 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">FAQ overview</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {faqData.length} sections and {totalQuestions} concise answers focused on the real product.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur p-3 shadow-sm">
              {faqData.map((category) => {
                const Icon = category.icon;
                return (
                  <div key={category.category} className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm text-slate-700">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-900">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-medium">{category.category}</span>
                  </div>
                );
              })}
            </div>
          </aside>

          <div className="space-y-6">
            {faqData.map((category, catIdx) => {
              const Icon = category.icon;
              return (
                <div key={category.category} className="rounded-3xl border border-slate-200 bg-white/95 shadow-sm overflow-hidden">
                  <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-900 text-white shadow-sm">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-slate-900">{category.category}</h3>
                        <p className="text-sm text-slate-500">{category.questions.length} questions</p>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {category.questions.map((item, qIdx) => {
                      const key = `${catIdx}-${qIdx}`;
                      const isOpen = openKey === key;

                      return (
                        <div key={key} className="px-2 py-1">
                          <button
                            onClick={() => setOpenKey(isOpen ? '' : key)}
                            className="flex w-full items-start justify-between gap-4 rounded-2xl px-4 py-5 text-left transition-colors hover:bg-slate-50"
                          >
                            <span className="pr-4 text-base font-semibold leading-7 text-slate-900">
                              {item.q}
                            </span>
                            <span className={cn(
                              'mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border transition-all',
                              isOpen
                                ? 'border-blue-900 bg-blue-900 text-white'
                                : 'border-slate-200 bg-white text-slate-500'
                            )}>
                              <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
                            </span>
                          </button>

                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: 'easeInOut' }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-5 pr-16 text-[15px] leading-7 text-slate-600">
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

            <div className="rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-8 text-white shadow-lg">
              <h3 className="text-2xl font-semibold mb-3">Need a direct answer for your school?</h3>
              <p className="max-w-2xl text-blue-100 leading-7 mb-6">
                If you want a product walkthrough or want to check whether Schedual fits your timetable process, contact us or request a demo.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/Landing#demo"
                  className="inline-flex items-center rounded-xl bg-white px-5 py-3 font-semibold text-blue-900 transition-colors hover:bg-blue-50"
                >
                  Book a demo
                </Link>
                <Link
                  to={createPageUrl('ContactUs')}
                  className="inline-flex items-center rounded-xl border border-white/20 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Contact us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}