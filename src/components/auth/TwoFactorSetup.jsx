import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Smartphone, Copy, CheckCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function TwoFactorSetup({ onComplete, onCancel }) {
  const [step, setStep] = useState('loading'); // loading, setup, verify, complete
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    setupTwoFactor();
  }, []);

  const setupTwoFactor = async () => {
    try {
      const { data } = await base44.functions.invoke('setup2FA');
      setQrCode(data.qrCodeDataURL);
      setSecret(data.secret);
      setManualCode(data.manualEntryCode);
      setStep('setup');
    } catch (error) {
      setError(error.message || 'Failed to setup 2FA');
      setStep('setup');
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const { data } = await base44.functions.invoke('verify2FA', {
        code: verificationCode,
        enable: true
      });

      if (data.success) {
        setStep('complete');
        toast.success('2FA enabled successfully!');
        setTimeout(() => {
          onComplete();
        }, 2000);
      } else {
        setError(data.error || 'Invalid code');
      }
    } catch (error) {
      setError(error.message || 'Failed to verify code');
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-900 animate-spin mb-4" />
        <p className="text-slate-600">Setting up 2FA...</p>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">2FA Enabled!</h3>
        <p className="text-slate-600">Your account is now protected with two-factor authentication.</p>
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Smartphone className="w-6 h-6 text-blue-900" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Setup Google Authenticator</h3>
          <p className="text-sm text-slate-600">Scan the QR code with your authenticator app</p>
        </div>

        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            Install Google Authenticator, Microsoft Authenticator, or Authy on your phone before continuing.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Step 1: Scan QR Code</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              {qrCode ? (
                <div className="bg-white p-4 rounded-lg border-2 border-slate-200">
                  <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              ) : (
                <div className="w-48 h-48 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Or Enter Code Manually</CardTitle>
              <CardDescription>If you can't scan the QR code</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-sm font-mono">
                  {manualCode || secret}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(secret)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Button 
          onClick={() => setStep('verify')} 
          className="w-full bg-blue-900 hover:bg-blue-800"
        >
          Continue to Verification
        </Button>

        <Button 
          variant="outline" 
          onClick={onCancel} 
          className="w-full"
        >
          Cancel
        </Button>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6 text-blue-900" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Verify Setup</h3>
          <p className="text-sm text-slate-600">Enter the 6-digit code from your authenticator app</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verification_code">Verification Code</Label>
            <Input
              id="verification_code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-widest h-14"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleVerify}
            disabled={isVerifying || verificationCode.length !== 6}
            className="w-full bg-blue-900 hover:bg-blue-800 h-12"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              'Enable 2FA'
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => setStep('setup')}
            className="w-full"
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  return null;
}