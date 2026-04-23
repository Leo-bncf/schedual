import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Mail, MessageCircle, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import LandingHeader from '../components/landing/LandingHeader';
import LandingFooter from '../components/landing/LandingFooter';
import { SUPPORT_EMAIL } from '@/lib/publicAppConfig';

const supportCards = [
  {
    icon: Clock,
    title: 'Response Time',
    description: 'We typically respond within 24 hours during business days.'
  },
  {
    icon: MessageCircle,
    title: 'Support Tickets',
    description: 'School admins can submit support tickets directly from their dashboard.'
  },
  {
    icon: ShieldCheck,
    title: 'Product Support',
    description: 'Get help with onboarding, setup, account questions, and platform usage.'
  }
];

export default function ContactUs() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_42%,#eef4ff_100%)]">
      <LandingHeader />
      <main className="px-4 py-12 pt-36 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white/85 shadow-[0_25px_90px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.06),transparent_30%)]" />
            <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-12">
              <div className="flex flex-col justify-center">
                <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 shadow-lg shadow-blue-900/20">
                  <Mail className="h-8 w-8 text-white" />
                </div>
                <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900">
                  Contact Schedual
                </div>
                <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                  Need help? We’re here to support your team.
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                  Reach out for setup guidance, platform questions, or general support and we’ll point you in the right direction quickly.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                    Fast responses
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                    School-focused help
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                    Friendly support
                  </span>
                </div>
              </div>

              <Card className="border border-slate-200/80 bg-white/95 shadow-2xl shadow-slate-200/60">
                <CardContent className="p-6 sm:p-8">
                  <div className="rounded-2xl bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-6 text-white">
                    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                      <Mail className="h-7 w-7 text-white" />
                    </div>
                    <p className="text-sm uppercase tracking-[0.2em] text-blue-200">Email support</p>
                    <h2 className="mt-3 text-2xl font-semibold">{SUPPORT_EMAIL}</h2>
                    <p className="mt-3 text-sm leading-7 text-blue-50/85">
                      Send us an email anytime and we’ll get back to you as soon as possible.
                    </p>
                    <a
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-base font-semibold text-blue-950 transition-colors hover:bg-blue-50"
                    >
                      Email support now
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {supportCards.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="border-slate-200 bg-white/90 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-900">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}