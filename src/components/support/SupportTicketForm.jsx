import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageCircle, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function SupportTicketForm({ onSuccess }) {
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium'
  });
  const [success, setSuccess] = useState(false);

  const queryClient = useQueryClient();

  const createTicketMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('createSupportTicket', data),
    onSuccess: () => {
      setSuccess(true);
      setFormData({ subject: '', description: '', priority: 'medium' });
      setTimeout(() => setSuccess(false), 5000);
      queryClient.invalidateQueries(['supportTickets']);
      queryClient.invalidateQueries(['allSupportTickets']);
      if (onSuccess) onSuccess();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createTicketMutation.mutate(formData);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-blue-900" />
          </div>
          <div>
            <CardTitle>Need Help?</CardTitle>
            <CardDescription>Submit a support ticket to our team</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {success ? (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Support ticket submitted successfully! Our team will respond within 24 hours.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                placeholder="Brief description of your issue"
                required
              />
            </div>

            <div>
              <Label htmlFor="priority">Priority *</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - General inquiry</SelectItem>
                  <SelectItem value="medium">Medium - Minor issue</SelectItem>
                  <SelectItem value="high">High - Important issue</SelectItem>
                  <SelectItem value="urgent">Urgent - Critical problem</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Please describe your issue in detail..."
                className="h-32"
                required
              />
            </div>

            {createTicketMutation.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {createTicketMutation.error?.response?.data?.error || 'Failed to submit ticket. Please try again.'}
                </AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full bg-blue-900 hover:bg-blue-800"
              disabled={createTicketMutation.isPending || !formData.subject || !formData.description}
            >
              {createTicketMutation.isPending ? (
                'Submitting...'
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Support Ticket
                </>
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}