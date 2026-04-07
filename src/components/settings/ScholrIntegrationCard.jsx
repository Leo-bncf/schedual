import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function ScholrIntegrationCard({ compact = false }) {
  return (
    <Card className="border-0 shadow-sm bg-white rounded-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-sm">
              <span className="text-sm font-bold tracking-wide">SC</span>
            </div>
            <div>
              <CardTitle className="text-lg">Scholr Integration</CardTitle>
              <CardDescription>
                Prepare secure timetable sync from Schedual to Scholr.
              </CardDescription>
            </div>
          </div>
          <Badge className="bg-amber-100 text-amber-800 border-0">Awaiting API details</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Direction</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Schedual → Scholr</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payload</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Published timetables</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">UI ready, sync pending</p>
          </div>
        </div>

        {!compact && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-slate-700">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-700" />
              <p>
                Once you provide the Scholr endpoint and authentication format, this area can send finalized timetable data directly from Schedual into Scholr.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <RefreshCw className="h-4 w-4" />
            Waiting for endpoint, headers, and payload shape.
          </div>
          <Link to={createPageUrl('ScholrIntegration')}>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              Open integration
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}