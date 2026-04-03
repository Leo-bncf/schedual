import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export default function PaymentSuccess() {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Confirming your payment and unlocking your school...');

  useEffect(() => {
    const runConfirmation = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');

      if (!sessionId) {
        setStatus('error');
        setMessage('Missing Stripe session details.');
        return;
      }

      try {
        await base44.functions.invoke('confirmStripeCheckout', { sessionId });
        setStatus('success');
        setMessage('Payment confirmed. Your school access is now ready.');
      } catch (error) {
        setStatus('error');
        setMessage(error?.response?.data?.error || error.message || 'Unable to confirm your payment.');
      }
    };

    runConfirmation();
  }, []);

  if (status === 'success') {
    return <Navigate to="/Dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-lg shadow-xl border-slate-200">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
            {status === 'loading' ? (
              <Loader2 className="w-7 h-7 text-blue-900 animate-spin" />
            ) : (
              <AlertCircle className="w-7 h-7 text-red-600" />
            )}
          </div>
          <CardTitle>{status === 'loading' ? 'Confirming payment' : 'Payment confirmation failed'}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {status === 'error' ? (
            <Button onClick={() => window.location.href = '/Settings'} variant="outline">
              Back to settings
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Please wait a moment...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}