import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, Users, AlertCircle } from 'lucide-react';

export default function DPGroupGenerator({ onComplete }) {
  const qc = useQueryClient();
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState('');
  const [preview, setPreview] = React.useState(null);

  const loadPreview = React.useCallback(async () => {
    setLoading(true);
    setError('');
    const { data } = await base44.functions.invoke('generateDpTeachingGroups', { action: 'preview', max_group_size: 20 });
    if (data?.error) setError(data.error);
    setPreview(data);
    setLoading(false);
  }, []);

  React.useEffect(() => { loadPreview(); }, [loadPreview]);

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    const { data } = await base44.functions.invoke('generateDpTeachingGroups', { action: 'create', max_group_size: 20 });
    if (data?.error) {
      setError(data.error);
      setCreating(false);
      return;
    }
    
    // Sync student teaching groups after DP group generation
    try {
      const { data: syncData } = await base44.functions.invoke('syncStudentTeachingGroups');
      console.log('Student groups synced:', syncData);
    } catch (syncError) {
      console.error('Failed to sync student groups:', syncError);
    }
    
    await qc.invalidateQueries({ queryKey: ['teachingGroups'] });
    await qc.invalidateQueries({ queryKey: ['students'] });
    setCreating(false);
    if (onComplete) onComplete();
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          DP Teaching Group Generator (Deterministic)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Analyzing DP students and subjects...</p>
          </div>
        ) : error ? (
          <div className="py-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm font-medium text-emerald-900">Ready</p>
                </div>
                <p className="text-2xl font-bold text-emerald-700">{preview?.ready || 0}</p>
              </div>
              <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <p className="text-sm font-medium text-indigo-900">Total</p>
                </div>
                <p className="text-2xl font-bold text-indigo-700">{preview?.total || 0}</p>
              </div>
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <p className="text-sm font-medium text-amber-900">Warnings</p>
                </div>
                <p className="text-2xl font-bold text-amber-700">{preview?.warnings || 0}</p>
              </div>
            </div>

            {preview?.warnings > 0 && preview?.warnings_list && (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm font-semibold text-amber-900 mb-2">⚠️ {preview.warnings} Issues Found</p>
                <p className="text-xs text-amber-800 mb-3">
                  Students have subject choices that either don't exist or aren't marked as DP subjects. Go to Subjects page and ensure all subjects have ib_level="DP".
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {preview.warnings_list.slice(0, 15).map((w, i) => (
                    <p key={i} className="text-xs text-amber-800 font-mono">
                      • {w.message || `Student ${w.student_id?.slice(-8)}: ${w.subject_id?.slice(-8)}`}
                    </p>
                  ))}
                  {preview.warnings_list.length > 15 && (
                    <p className="text-xs text-amber-700 italic mt-2">...and {preview.warnings_list.length - 15} more issues</p>
                  )}
                </div>
              </div>
            )}

            <div className="max-h-96 overflow-y-auto space-y-2 p-4 rounded-lg bg-slate-50 border border-slate-200">
              {preview?.groups?.map((g, i) => (
                <div key={i} className="p-3 rounded-lg border bg-white border-slate-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">
                        {g.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{g.student_ids.length} students</Badge>
                        <Badge className="bg-indigo-100 text-indigo-700 border-0 text-xs">{g.level}</Badge>
                        <Badge variant="outline" className="text-xs">{g.year_group}</Badge>
                        <span className="text-xs text-slate-500">{g.hours_per_week} h/week</span>
                      </div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
              ))}
              {(!preview?.groups || preview.groups.length === 0) && (
                <div className="text-sm text-slate-500 text-center py-4">
                  No DP groups proposed. Check warnings above - likely students have invalid subject IDs or subjects are not marked as DP level.
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleCreate}
                disabled={creating || (preview?.ready || 0) === 0}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating & Syncing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Create {preview?.groups_created || preview?.ready || 0} Groups
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={loadPreview} disabled={creating}>Refresh</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}