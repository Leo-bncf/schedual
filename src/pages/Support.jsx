import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  Send, 
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from 'date-fns';

export default function Support() {
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    category: 'general',
    priority: 'medium'
  });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['supportTickets', user?.email],
    queryFn: async () => {
      const allTickets = await base44.entities.SupportTicket.list('-created_date');
      return allTickets.filter(ticket => ticket.user_email === user?.email);
    },
    enabled: !!user?.email,
  });

  const createTicketMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('createSupportTicket', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supportTickets'] });
      setShowNewTicket(false);
      setFormData({ subject: '', description: '', category: 'general', priority: 'medium' });
    },
  });

  const updateTicketMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SupportTicket.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supportTickets'] });
      setSelectedTicket(null);
    },
  });

  const handleCreateTicket = () => {
    createTicketMutation.mutate({
      ...formData,
      school_id: user.school_id
    });
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedTicket) return;

    const updatedMessages = [
      ...(selectedTicket.messages || []),
      {
        sender: user.full_name,
        message: newMessage,
        timestamp: new Date().toISOString(),
        is_admin: false
      }
    ];

    updateTicketMutation.mutate({
      id: selectedTicket.id,
      data: { messages: updatedMessages }
    });

    setNewMessage('');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-blue-100 text-blue-700 border-0"><Clock className="w-3 h-3 mr-1" />Open</Badge>;
      case 'in_progress':
        return <Badge className="bg-amber-100 text-amber-700 border-0"><AlertCircle className="w-3 h-3 mr-1" />In Progress</Badge>;
      case 'waiting_for_customer':
        return <Badge className="bg-violet-100 text-violet-700 border-0"><MessageCircle className="w-3 h-3 mr-1" />Waiting for You</Badge>;
      case 'resolved':
        return <Badge className="bg-emerald-100 text-emerald-700 border-0"><CheckCircle className="w-3 h-3 mr-1" />Resolved</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-600">Closed</Badge>;
    }
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      low: 'bg-slate-100 text-slate-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-rose-100 text-rose-700'
    };
    return <Badge className={`${colors[priority]} border-0`}>{priority}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Support"
        description="Get help and manage your support tickets"
        actions={
          <Button onClick={() => setShowNewTicket(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        }
      />

      {/* Tickets Grid */}
      <div className="grid gap-4">
        {tickets.length === 0 && !isLoading && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Support Tickets</h3>
              <p className="text-slate-500 mb-4">You haven't created any support tickets yet.</p>
              <Button onClick={() => setShowNewTicket(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Ticket
              </Button>
            </CardContent>
          </Card>
        )}

        {tickets.map(ticket => (
          <Card 
            key={ticket.id} 
            className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedTicket(ticket)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{ticket.subject}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(ticket.status)}
                    {getPriorityBadge(ticket.priority)}
                    <Badge variant="outline" className="text-slate-600 capitalize">{ticket.category}</Badge>
                  </div>
                </div>
                <p className="text-sm text-slate-500">{format(new Date(ticket.created_date), 'MMM d, yyyy')}</p>
              </div>
              <p className="text-sm text-slate-600 line-clamp-2 mb-3">{ticket.description}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {ticket.messages?.length || 1} message{(ticket.messages?.length || 1) !== 1 ? 's' : ''}
                </p>
                {ticket.status === 'waiting_for_customer' && (
                  <Badge className="bg-violet-100 text-violet-700 border-0 animate-pulse">
                    Response needed
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New Ticket Dialog */}
      <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
            <DialogDescription>
              Describe your issue and our team will get back to you as soon as possible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Subject</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                placeholder="Brief description of your issue"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">Technical Issue</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="feature_request">Feature Request</SelectItem>
                    <SelectItem value="bug_report">Bug Report</SelectItem>
                    <SelectItem value="general">General Question</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Please provide detailed information about your issue..."
                className="h-32"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewTicket(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateTicket}
                disabled={!formData.subject || !formData.description || createTicketMutation.isPending}
              >
                {createTicketMutation.isPending ? 'Creating...' : 'Create Ticket'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          {selectedTicket && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-xl mb-2">{selectedTicket.subject}</DialogTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(selectedTicket.status)}
                      {getPriorityBadge(selectedTicket.priority)}
                      <Badge variant="outline" className="capitalize">{selectedTicket.category}</Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedTicket(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {selectedTicket.messages?.map((msg, idx) => (
                  <div key={idx} className={`p-4 rounded-lg ${msg.is_admin ? 'bg-indigo-50 border border-indigo-200' : 'bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm text-slate-900">{msg.sender}</p>
                      <p className="text-xs text-slate-500">{format(new Date(msg.timestamp), 'MMM d, HH:mm')}</p>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.message}</p>
                  </div>
                ))}
              </div>

              {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' && (
                <div className="space-y-2 border-t pt-4">
                  <Label>Add Message</Label>
                  <div className="flex gap-2">
                    <Textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1"
                      rows={3}
                    />
                    <Button onClick={handleSendMessage} disabled={!newMessage.trim()} className="self-end">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Floating Support Button */}
      <Button
        onClick={() => setShowNewTicket(true)}
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg bg-indigo-600 hover:bg-indigo-700"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>
    </div>
  );
}