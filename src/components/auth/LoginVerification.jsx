import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertCircle, Loader2, LogOut } from 'lucide-react';

export default function LoginVerification({ open, onVerified, sessionToken }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await base44.functions.invoke('verifyLoginCode', {
        code: code.trim(),
        sessionToken
      });

      if (response.data.success) {
        // Fetch and store CSRF token after verification
        try {
          const csrfResponse = await base44.functions.invoke('getCSRFToken');
          if (csrfResponse.data?.csrfToken) {
            sessionStorage.setItem('csrf_token', csrfResponse.data.csrfToken);
          }
        } catch (err) {
          console.error('Failed to fetch CSRF token:', err);
        }
        onVerified();
      } else {
        setError(response.data.error || 'Verification failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await base44.functions.invoke('sendLoginVerification');
      
      if (response.data.success) {
        setResendCooldown(60);
        setError('');
      }
    } catch (err) {
      if (err.response?.status === 429) {
        setResendCooldown(err.response.data.retryAfter || 60);
      }
      setError(err.response?.data?.error || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-900" />
            </div>
          </div>
          <DialogTitle className="text-center">Verify Your Login</DialogTitle>
          <DialogDescription className="text-center">
            We've sent a 6-digit verification code to your email for security.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-widest font-mono"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full bg-blue-900 hover:bg-blue-800"
            disabled={loading || code.length !== 6}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify & Continue'
            )}
          </Button>

          <div className="space-y-2">
            <div className="text-center">
              <p className="text-sm text-slate-600 mb-2">
                Didn't receive the code?
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={handleResend}
                disabled={loading || resendCooldown > 0}
                className="text-blue-900 hover:text-blue-800"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
              </Button>
            </div>

            <div className="text-center pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleLogout}
                className="w-full"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-slate-500 text-center">
              Code expires in 10 minutes • 5 attempts maximum
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}