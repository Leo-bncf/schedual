import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Users, Zap, AlertCircle, Clock } from 'lucide-react';
import { ADD_ONS } from '@/components/settings/SettingsConstants';

const STATUS_STYLES = {
  active:             'bg-emerald-100 text-emerald-700 border-emerald-200',
  trialing:           'bg-blue-100 text-blue-700 border-blue-200',
  paused:             'bg-amber-100 text-amber-700 border-amber-200',
  past_due:           'bg-rose-100 text-rose-700 border-rose-200',
  canceled:           'bg-rose-100 text-rose-700 border-rose-200',
  incomplete:         'bg-slate-100 text-slate-600 border-slate-200',
  incomplete_expired: 'bg-slate-100 text-slate-600 border-slate-200',
  unpaid:             'bg-rose-100 text-rose-700 border-rose-200',
};

const STATUS_LABELS = {
  active:             'Active',
  trialing:           'Trial',
  paused:             'Paused',
  past_due:           'Past Due',
  canceled:           'Canceled',
  incomplete:         'Incomplete',
  incomplete_expired: 'Expired',
  unpaid:             'Unpaid',
};

export default function SubscriptionTab({
  school,
  schoolAdmins = [],
  tiers,
  sharedTier,
  tierStudentLimit,
  tierSavedVersionsLimit,
  effectiveAdminSeatLimit,
  showTierOptions,
  setShowTierOptions,
  showAddOns,
  setShowAddOns,
}) {
  const status = school?.subscription_status || 'incomplete';
  const hasTier = !!school?.subscription_tier;
  const tier = hasTier ? tiers[school.subscription_tier] : null;
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.incomplete;
  const statusLabel = STATUS_LABELS[status] || status;

  const renewalDate = school?.subscription_current_period_end
    ? new Date(school.subscription_current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="space-y-6">
      {/* ── Current Plan ─────────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm bg-white rounded-xl">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Zap className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <CardTitle className="text-lg">Subscription</CardTitle>
                <CardDescription>Your current plan and usage limits</CardDescription>
              </div>
            </div>
            <Badge className={`border text-sm px-3 py-1 ${statusStyle}`}>
              {status === 'active' && <CheckCircle className="w-3.5 h-3.5 mr-1.5" />}
              {statusLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {hasTier ? (
            <div className="space-y-6">
              {/* Tier + billing + seats */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
                  <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-2">Current Plan</p>
                  <p className="text-2xl font-bold text-blue-900">{tier?.name || school.subscription_tier}</p>
                  <p className="text-sm text-blue-600 mt-1">{tier?.priceLabel || ''}</p>
                </div>

                <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200">
                  <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide mb-2">
                    {status === 'trialing' ? 'Trial Ends' : 'Next Billing'}
                  </p>
                  <p className="text-2xl font-bold text-emerald-900">
                    {renewalDate || 'N/A'}
                  </p>
                  {!renewalDate && (
                    <p className="text-xs text-emerald-600 mt-1">Not yet set</p>
                  )}
                </div>

                <div className="p-4 rounded-lg bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200">
                  <p className="text-xs font-medium text-violet-700 uppercase tracking-wide mb-2">Admin Seats</p>
                  <p className="text-2xl font-bold text-violet-900">
                    {schoolAdmins.length} / {effectiveAdminSeatLimit === null ? '∞' : effectiveAdminSeatLimit}
                  </p>
                  {effectiveAdminSeatLimit !== null && schoolAdmins.length >= effectiveAdminSeatLimit && (
                    <p className="text-xs text-amber-600 mt-1 font-medium">Limit reached</p>
                  )}
                </div>
              </div>

              {/* Non-active status notice */}
              {status !== 'active' && (
                <div className={`p-4 rounded-lg border flex items-start gap-3 ${statusStyle}`}>
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    {status === 'trialing' && <p>You are on a trial. Full features are available until your trial ends.</p>}
                    {status === 'paused' && <p>Your subscription is paused. Schedule generation is disabled until you reactivate.</p>}
                    {status === 'past_due' && <p>Your last payment failed. Please update your payment method to avoid losing access.</p>}
                    {status === 'canceled' && <p>Your subscription has been canceled. Renew to restore full access.</p>}
                    {(status === 'incomplete' || status === 'incomplete_expired') && <p>Your subscription setup is incomplete. Complete checkout to activate.</p>}
                    {status === 'unpaid' && <p>Payment is overdue. Please pay your outstanding balance.</p>}
                  </div>
                </div>
              )}

              {/* Plan capabilities */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-3 text-sm">Plan Limits</h4>
                <div className="grid sm:grid-cols-2 gap-2 text-sm text-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Up to {tierStudentLimit ? tierStudentLimit.toLocaleString() : '—'} students</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>{tierSavedVersionsLimit === null ? 'Unlimited' : tierSavedVersionsLimit} saved schedule versions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>{effectiveAdminSeatLimit === null ? 'Unlimited' : effectiveAdminSeatLimit} admin account{effectiveAdminSeatLimit !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>{sharedTier?.support || 'Standard support'}</span>
                  </div>
                  {sharedTier?.onboardingCallIncluded && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span>Onboarding call included</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Active add-ons */}
              {school?.active_add_ons?.length > 0 && (
                <div className="p-4 rounded-lg bg-violet-50 border border-violet-200">
                  <h4 className="font-semibold text-violet-900 mb-3 text-sm">Active Add-ons</h4>
                  <div className="flex flex-wrap gap-2">
                    {school.active_add_ons.map((addonId) => {
                      const addon = ADD_ONS.find((a) => a.id === addonId);
                      return addon ? (
                        <Badge key={addonId} className="bg-violet-600 text-white">
                          {addon.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full h-11 font-medium border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                onClick={() => setShowTierOptions(!showTierOptions)}
              >
                {showTierOptions ? 'Hide' : 'View'} Plans
              </Button>
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-amber-600" />
              </div>
              <p className="font-semibold text-slate-800">No plan assigned</p>
              <p className="text-sm text-slate-500 mt-1">Contact support or complete checkout to activate your school.</p>
              <Button
                variant="outline"
                className="mt-4 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                onClick={() => setShowTierOptions(!showTierOptions)}
              >
                View Plans
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Available Plans ───────────────────────────────────────────── */}
      {showTierOptions && (
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Available Plans
            </CardTitle>
            <CardDescription>Your school tier options and what's included</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4 mb-4">
              {Object.entries(tiers).map(([tierId, t]) => (
                <div
                  key={tierId}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    school?.subscription_tier === tierId
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-slate-900 text-sm">{t.name}</h4>
                    {school?.subscription_tier === tierId && (
                      <Badge className="bg-indigo-600 text-white text-xs">Current</Badge>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-blue-900">{t.priceLabel}</div>
                  <p className="text-xs text-slate-500 mt-2">{t.description}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400">To change your plan, contact Schedual support.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Add-ons ───────────────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm bg-white rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100">
                <Zap className="w-5 h-5 text-violet-700" />
              </div>
              <div>
                <CardTitle className="text-lg">Add-ons</CardTitle>
                <CardDescription>Optional feature extensions</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowAddOns(!showAddOns)}>
              {showAddOns ? 'Hide' : 'Show'} Add-ons
            </Button>
          </div>
        </CardHeader>
        {showAddOns && (
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ADD_ONS.map((addon) => (
                <div key={addon.id} className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                  <h5 className="font-semibold text-slate-900 text-sm">{addon.name}</h5>
                  <p className="text-xs text-slate-500 mt-1">{addon.category}</p>
                  <p className="text-lg font-bold text-blue-900 mt-2">€{addon.price}</p>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
