import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { Shield, FileText } from 'lucide-react';

export default function TermsAcceptanceDialog() {
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const hasAccepted = localStorage.getItem('schedual_terms_accepted');
    if (!hasAccepted) {
      setOpen(true);
    }
  }, []);

  const handleAccept = () => {
    if (accepted) {
      localStorage.setItem('schedual_terms_accepted', 'true');
      setOpen(false);
    }
  };

  const handleDecline = () => {
    window.location.href = 'https://google.com';
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-900" />
            </div>
            <DialogTitle className="text-2xl">Welcome to Schedual</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            Before you continue, please review and accept our Terms of Use and Privacy Policy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-4">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-start gap-3 mb-3">
              <FileText className="w-5 h-5 text-slate-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Terms of Use</h4>
                <p className="text-sm text-slate-600 mb-3">
                  Our Terms of Use govern your access to and use of Schedual's intelligent timetable generation system. 
                  By using our platform, you agree to comply with these terms.
                </p>
                <Link 
                  to={createPageUrl('TermsOfUse')} 
                  target="_blank"
                  className="text-sm text-blue-900 hover:text-blue-800 font-medium"
                >
                  Read Terms of Use →
                </Link>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-start gap-3 mb-3">
              <Shield className="w-5 h-5 text-slate-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Privacy Policy</h4>
                <p className="text-sm text-slate-600 mb-3">
                  Our Privacy Policy explains how we collect, use, and protect your personal data in compliance with GDPR 
                  and applicable data protection laws.
                </p>
                <Link 
                  to={createPageUrl('PrivacyPolicy')} 
                  target="_blank"
                  className="text-sm text-blue-900 hover:text-blue-800 font-medium"
                >
                  Read Privacy Policy →
                </Link>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Checkbox 
              id="accept-terms" 
              checked={accepted}
              onCheckedChange={setAccepted}
              className="mt-0.5"
            />
            <label htmlFor="accept-terms" className="text-sm text-slate-700 cursor-pointer">
              I have read and agree to the <strong>Terms of Use</strong> and <strong>Privacy Policy</strong>. 
              I understand that by using Schedual, I consent to the processing of personal data as described in these documents.
            </label>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleDecline} className="w-full sm:w-auto">
            Decline & Exit
          </Button>
          <Button 
            onClick={handleAccept} 
            disabled={!accepted}
            className="bg-blue-900 hover:bg-blue-800 w-full sm:w-auto"
          >
            Accept & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}