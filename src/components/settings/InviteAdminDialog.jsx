import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle, Info, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function InviteAdminDialog({ open, onOpenChange, inviteEmail, setInviteEmail, inviteLink, setInviteLink, showInviteLink, setShowInviteLink, generateInviteLinkMutation, effectiveAdminSeatLimit, schoolAdmins }) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        setInviteEmail('');
        setInviteLink('');
        setShowInviteLink(false);
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite School Admin</DialogTitle>
          <DialogDescription>
            {showInviteLink ? 'Share this link with the new admin. They must create an account or log in to accept.' : 'Enter the email of the person you want to invite as an administrator.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!showInviteLink ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">How it works:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Enter the admin's email address</li>
                      <li>We'll generate a secure invitation link</li>
                      <li>Share the link with them via email or messaging</li>
                      <li>They create an account or log in</li>
                      <li>They're automatically added as admin</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="invite-email" className="text-sm font-medium">Admin Email Address</label>
                <Input id="invite-email" type="email" placeholder="admin@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800"><strong>Available seats:</strong> {effectiveAdminSeatLimit === null ? 'Unlimited' : `${Math.max(effectiveAdminSeatLimit - schoolAdmins.length, 0)} / ${effectiveAdminSeatLimit}`}</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <label className="text-sm font-medium">Invitation Link</label>
                <div className="p-3 bg-slate-50 border-2 border-slate-200 rounded-lg">
                  <p className="text-xs font-mono text-slate-600 break-all mb-3">{inviteLink}</p>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => {
                    navigator.clipboard.writeText(inviteLink);
                    toast.success('Link copied to clipboard');
                  }}>Copy Link</Button>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-green-800">
                    <p className="font-semibold mb-1">✓ Link generated successfully</p>
                    <p>Share this link with <strong>{inviteEmail}</strong>. It will expire in 30 days.</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => {
            onOpenChange(false);
            setInviteEmail('');
            setInviteLink('');
            setShowInviteLink(false);
          }}>{showInviteLink ? 'Close' : 'Cancel'}</Button>
          {!showInviteLink && (
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => {
              if (inviteEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
                generateInviteLinkMutation.mutate(inviteEmail);
              } else {
                toast.error('Please enter a valid email address');
              }
            }} disabled={generateInviteLinkMutation.isPending || !inviteEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)}>
              {generateInviteLinkMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Mail className="w-4 h-4 mr-2" />Generate Invite Link</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}