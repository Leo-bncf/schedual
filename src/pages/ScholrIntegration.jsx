import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, KeyRound, Link as LinkIcon, Send, ShieldCheck } from 'lucide-react';
import ScholrIntegrationCard from '@/components/settings/ScholrIntegrationCard';

const requirements = [
  {
    icon: LinkIcon,
    title: 'Scholr API endpoint',
    description: 'The URL where Schedual should send timetable data.'
  },
  {
    icon: KeyRound,
    title: 'Authentication format',
    description: 'For example Bearer token, x-api-key header, or another required header structure.'
  },
  {
    icon: Send,
    title: 'Payload structure',
    description: 'The exact fields Scholr expects for student and teacher timetable sync.'
  }
];

export default function ScholrIntegration() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="mb-3 bg-blue-100 text-blue-800 border-0">Scholr companion app</Badge>
          <h1 className="text-3xl font-light tracking-tight text-slate-900">Scholr Integration</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            This area is prepared for sending finalized timetables from Schedual into Scholr once the API connection details are provided.
          </p>
        </div>
        <Button variant="outline" className="w-full sm:w-auto" disabled>
          Live sync coming next
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <ScholrIntegrationCard />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-0 shadow-sm rounded-xl bg-white">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-100 p-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <CardTitle>What’s already ready</CardTitle>
                <CardDescription>The product side is now prepared for a dedicated Scholr connection area.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-900">Dedicated integration surface</p>
              <p className="mt-1">Admins now have a visible place for the Schedual → Scholr relationship inside the platform.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-900">Sync intent documented</p>
              <p className="mt-1">The interface clearly states that finalized timetables will be sent from Schedual to Scholr.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-900">Ready for next backend step</p>
              <p className="mt-1">As soon as you provide the API details, the actual push function can be wired without redesigning this area.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-xl bg-gradient-to-br from-slate-900 to-blue-950 text-white">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-2">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white">Needed to complete live sync</CardTitle>
                <CardDescription className="text-blue-100">These are the last missing pieces before implementation.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {requirements.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 text-blue-200" />
                    <div>
                      <p className="font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-sm text-blue-100/90">{item.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}