import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function ProvisionSchools() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runProvision = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        schools: [
          { name: 'EPBI', code: 'EPBI', email: 'leo.bancroft@outlook.fr' },
          { name: 'Isn Nice', code: 'ISN', email: 'support@schedual-pro.com' },
        ],
        subscription_status: 'active',
        subscription_tier: 'tier2',
        make_admin: true,
        invite_if_missing: true,
      };
      const { data } = await base44.functions.invoke('provisionSchoolsAndAssign', payload);
      setResult(data);
    } catch (e) {
      setError(e?.message || 'Failed to provision');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Provision Schools</h1>
      <p className="text-slate-600 mb-6">Create two Tier 2 active schools and assign each user as admin.</p>

      <Button onClick={runProvision} disabled={running} className="bg-blue-900 hover:bg-blue-800">
        {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        {running ? 'Running…' : 'Run Provision'}
      </Button>

      <Card className="mt-6">
        <CardContent className="p-4">
          {error && (
            <div className="flex items-center text-red-600">
              <AlertCircle className="h-4 w-4 mr-2" />
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center text-green-700">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Completed
              </div>
              <pre className="bg-slate-50 p-3 rounded text-xs overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          {!error && !result && (
            <p className="text-sm text-slate-500">No run yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}