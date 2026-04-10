import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertCircle, CheckCircle, Loader2, MoreHorizontal, Plus, Trash2, Users } from 'lucide-react';

export default function AdminsTab({ school, schoolAdmins = [], isLoadingAdmins, effectiveAdminSeatLimit, user, onInvite, onRemoveAdmin }) {
  return (
    <Card className="border-0 shadow-sm bg-white rounded-xl">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100"><Users className="w-5 h-5 text-indigo-700" /></div>
            <div>
              <CardTitle className="text-lg">Administrator Management</CardTitle>
              <CardDescription className="mt-1">Manage who has admin access to your school. All admins have full permissions.</CardDescription>
            </div>
          </div>
          <Button onClick={onInvite} className="bg-indigo-600 hover:bg-indigo-700" disabled={!school || (effectiveAdminSeatLimit !== null && schoolAdmins.length >= effectiveAdminSeatLimit)}>
            <Plus className="w-4 h-4 mr-2" />Invite Admin
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center"><Users className="w-7 h-7 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold text-blue-900">{schoolAdmins?.length || 0} / {effectiveAdminSeatLimit === null ? 'Unlimited' : effectiveAdminSeatLimit}</p>
                <p className="text-sm text-blue-700 font-medium">Admin seats used</p>
              </div>
            </div>
            {effectiveAdminSeatLimit !== null && schoolAdmins.length >= effectiveAdminSeatLimit && (
              <div className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900">Admin limit reached for your tier</div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {isLoadingAdmins ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-slate-500">Loading administrators...</p>
            </div>
          ) : schoolAdmins?.length > 0 ? (
            schoolAdmins.map((admin) => (
              <Card key={admin.id} className="border-2 border-slate-200 hover:border-indigo-300 transition-all duration-200">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-xl">{admin.full_name?.charAt(0)?.toUpperCase() || admin.email?.charAt(0)?.toUpperCase() || 'A'}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-lg">{admin.full_name || 'Administrator'}</p>
                        <p className="text-sm text-slate-500">{admin.email}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge className="bg-indigo-100 text-indigo-700 border-0 text-xs">Administrator</Badge>
                          {admin.email === user?.email && <Badge className="bg-green-100 text-green-700 border-0 text-xs">You</Badge>}
                        </div>
                      </div>
                    </div>
                    {admin.email !== user?.email && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9"><MoreHorizontal className="w-5 h-5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => onRemoveAdmin(admin)}>
                            <Trash2 className="w-4 h-4 mr-2" />Remove Admin Access
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-slate-500">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3"><Users className="w-8 h-8 text-slate-300" /></div>
              <p className="font-medium">No administrators found</p>
              <p className="text-sm mt-1">Invite admins to manage your school</p>
            </div>
          )}
        </div>

        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">⚠️ Admin Permissions</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>All admins have <strong>full access</strong> to manage students, teachers, subjects, and schedules</li>
                <li>Admins can <strong>add or remove other admins</strong> (including you)</li>
                <li>Only grant admin access to <strong>trusted individuals</strong></li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}