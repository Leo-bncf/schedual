import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Users, Zap, AlertCircle } from 'lucide-react';
import { ADD_ONS } from '@/components/settings/SettingsConstants';

export default function SubscriptionTab({ school, schoolAdmins = [], tiers, sharedTier, tierStudentLimit, tierSavedVersionsLimit, effectiveAdminSeatLimit, showTierOptions, setShowTierOptions, showAddOns, setShowAddOns }) {
  const isActive = school?.subscription_status === 'active';

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm bg-white rounded-xl">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><Zap className="w-5 h-5 text-blue-700" /></div>
              <div>
                <CardTitle className="text-lg">Tier Status</CardTitle>
                <CardDescription>Your current school tier and access limits</CardDescription>
              </div>
            </div>
            {isActive && <Badge className="bg-emerald-100 text-emerald-700 border-0 text-sm px-3 py-1"><CheckCircle className="w-4 h-4 mr-1.5" />Active</Badge>}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isActive ? (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
                  <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-2">Current Tier</p>
                  <p className="text-2xl font-bold text-blue-900">{tiers[school?.subscription_tier]?.name || 'N/A'}</p>
                  <p className="text-sm text-blue-600 mt-2">€{tiers[school?.subscription_tier]?.price || 0}/year</p>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200">
                  <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide mb-2">Next Billing</p>
                  <p className="text-2xl font-bold text-emerald-900">{school?.subscription_current_period_end ? new Date(school.subscription_current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}</p>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200">
                  <p className="text-xs font-medium text-violet-700 uppercase tracking-wide mb-2">Admin Seats</p>
                  <p className="text-2xl font-bold text-violet-900">{schoolAdmins.length} / {effectiveAdminSeatLimit === null ? 'Unlimited' : effectiveAdminSeatLimit}</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-2 text-sm">Plan Capabilities</h4>
                <ul className="text-sm text-slate-700 list-disc list-inside space-y-1">
                  <li>Student limit: {tierStudentLimit ? `Up to ${tierStudentLimit.toLocaleString()} students` : 'Not set'}</li>
                  <li>Saved schedule versions: {tierSavedVersionsLimit === null ? 'Unlimited' : tierSavedVersionsLimit}</li>
                  <li>Admin accounts: {effectiveAdminSeatLimit === null ? 'Unlimited' : effectiveAdminSeatLimit}</li>
                  <li>Support: {sharedTier?.support || 'Standard support'}</li>
                  <li>Onboarding call: {sharedTier?.onboardingCallIncluded ? 'Included' : 'Not included'}</li>
                </ul>
              </div>

              {school?.active_add_ons && school.active_add_ons.length > 0 && (
                <div className="p-4 rounded-lg bg-violet-50 border border-violet-200">
                  <h4 className="font-semibold text-violet-900 mb-3 text-sm">Active Add-ons</h4>
                  <div className="flex flex-wrap gap-2">
                    {school.active_add_ons.map((addonId) => {
                      const addon = ADD_ONS.find((item) => item.id === addonId);
                      return addon ? <Badge key={addonId} className="bg-violet-600 text-white">{addon.name}</Badge> : null;
                    })}
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-1 gap-3">
                <Button variant="outline" className="w-full h-12 font-medium border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50" onClick={() => setShowTierOptions(!showTierOptions)}>
                  {showTierOptions ? 'Hide' : 'View'} Plans
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-3" />
              <p className="text-slate-600 text-sm">No active tier assigned</p>
            </div>
          )}
        </CardContent>
      </Card>

      {showTierOptions && (
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5" />Available Plans</CardTitle>
            <CardDescription>View your school tier options and limits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4 mb-4">
              {Object.entries(tiers).map(([tierId, tier]) => (
                <div key={tierId} className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${school?.subscription_tier === tierId ? 'border-blue-900 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <h4 className="font-bold text-slate-900 text-sm">{tier.subtitle}</h4>
                  <div className="text-2xl font-bold text-blue-900 mt-2">€{tier.price}</div>
                  <p className="text-xs text-slate-500 mt-1">{tier.description}</p>
                  {school?.subscription_tier === tierId && <Badge className="mt-3 bg-green-600 w-full justify-center">Current Plan</Badge>}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">Choose a plan from the pricing page to start or change your subscription.</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm bg-white rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100"><Zap className="w-5 h-5 text-violet-700" /></div>
              <div>
                <CardTitle className="text-lg">Add-ons & Features</CardTitle>
                <CardDescription>Enhance your subscription</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowAddOns(!showAddOns)}>{showAddOns ? 'Hide' : 'Show'} Add-ons</Button>
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
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-900">Tier limits now control student capacity, saved schedule versions, and admin accounts for each school.</p>
            </div>
          </CardContent>
        )}
      </Card>

      {schoolAdmins.length > 0 && (
        <Card className="border-0 shadow-sm bg-white rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />Administrators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {schoolAdmins.map((admin, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold text-sm">{admin.full_name?.charAt(0) || admin.email?.charAt(0) || 'A'}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 text-sm">{admin.full_name || 'Admin'}</p>
                    <p className="text-xs text-slate-500">{admin.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}