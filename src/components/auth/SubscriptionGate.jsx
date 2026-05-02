import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

// Pages accessible even with an inactive subscription
const ALWAYS_ALLOWED = new Set([
  '/', '/Landing', '/Settings', '/PaymentSuccess',
  '/PrivacyPolicy', '/TermsOfUse', '/ContactUs', '/FAQ',
  '/DataSecurity', '/About', '/Solutions', '/Demo',
]);

export default function SubscriptionGate({ children }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const schoolId = user?.school_id;

  const { data: school } = useQuery({
    queryKey: ['subscriptionGate', schoolId],
    queryFn: () => base44.entities.School.filter({ id: schoolId }).then((d) => d[0] ?? null),
    enabled: isAuthenticated && !!schoolId,
    staleTime: 120_000,
  });

  const isAllowed = ALWAYS_ALLOWED.has(location.pathname);

  if (
    isAuthenticated &&
    schoolId &&
    school &&
    !ACTIVE_STATUSES.has(school.subscription_status) &&
    !isAllowed
  ) {
    return <InactiveSubscriptionWall status={school.subscription_status} />;
  }

  return children;
}

function InactiveSubscriptionWall({ status }) {
  const label = {
    canceled: 'cancelled',
    unpaid: 'unpaid',
    past_due: 'past due',
    incomplete: 'incomplete',
    incomplete_expired: 'expired',
    paused: 'paused',
  }[status] ?? status;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-5">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-rose-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Subscription {label}</h1>
          <p className="text-slate-500 text-sm">
            Your subscription is no longer active. Renew your plan to access Schedual.
          </p>
        </div>
        <div className="flex flex-col gap-3 pt-2">
          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700"
            onClick={() => window.location.href = '/Settings'}
          >
            Go to Settings &amp; Renew
          </Button>
          <Button
            variant="ghost"
            className="w-full text-slate-500"
            onClick={() => base44.auth.logout(window.location.href)}
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
