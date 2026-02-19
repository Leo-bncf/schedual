import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Clock, CheckCircle, Loader2, AlertCircle, Inbox } from 'lucide-react';
import SupportTicketForm from '../components/support/SupportTicketForm';
import { format } from 'date-fns';

export default function Support() {
  const [activeTab, setActiveTab] = useState('new');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['supportTickets', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await base44.entities.SupportTicket.filter({ user_email: user.email }, '-created_date');
    },
    enabled: !!user?.email,
  });

  const getStatusColor = (status) => {
    const colors = {
      open: 'bg-blue-100 text-blue-800 border-blue-300',
      in_progress: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      waiting_for_customer: 'bg-purple-100 text-purple-800 border-purple-300',
      resolved: 'bg-green-100 text-green-800 border-green-300',
      closed: 'bg-slate-100 text-slate-800 border-slate-300'
    };
    return colors[status] || colors.open;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-slate-100 text-slate-700',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-rose-100 text-rose-800',
      urgent: 'bg-rose-200 text-rose-900 font-bold'
    };
    return colors[priority] || colors.medium;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Support Center</h1>
        <p className="text-slate-600">Submit tickets and track your support requests</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border border-slate-200 w-full sm:w-auto">
          <TabsTrigger value="new" className="data-[state=active]:bg-blue-900 data-[state=active]:text-white flex-1 sm:flex-none">
            <MessageCircle className="w-4 h-4 mr-2" />
            New Ticket
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-blue-900 data-[state=active]:text-white flex-1 sm:flex-none">
            <Inbox className="w-4 h-4 mr-2" />
            My Tickets ({tickets.length})
          </TabsTrigger>
        </TabsList>

        {/* New Ticket Tab */}
        <TabsContent value="new" className="mt-6">
          <div className="max-w-3xl">
            <SupportTicketForm onSuccess={() => setActiveTab('history')} />
          </div>
        </TabsContent>

        {/* Ticket History Tab */}
        <TabsContent value="history" className="mt-6">
          {isLoading ? (
            <Card className="border-slate-200">
              <CardContent className="py-12 text-center">
                <Loader2 className="w-12 h-12 text-slate-300 mx-auto mb-4 animate-spin" />
                <p className="text-slate-500">Loading your tickets...</p>
              </CardContent>
            </Card>
          ) : tickets.length === 0 ? (
            <Card className="border-slate-200">
              <CardContent className="py-20 text-center">
                <Inbox className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Support Tickets Yet</h3>
                <p className="text-slate-500 mb-6">You haven't submitted any support tickets</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {tickets.map((ticket) => (
                <Card key={ticket.id} className="border-slate-200 hover:border-blue-300 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{ticket.subject}</CardTitle>
                        <div className="flex flex-wrap gap-2">
                          <Badge className={`${getStatusColor(ticket.status)} border`}>
                            {ticket.status.replace(/_/g, ' ')}
                          </Badge>
                          <Badge className={getPriorityColor(ticket.priority)}>
                            {ticket.priority} priority
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            {format(new Date(ticket.created_date), 'MMM d, yyyy • h:mm a')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Ticket Description */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <div className="text-xs font-semibold text-slate-500 mb-2">Your Message</div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{ticket.description}</p>
                    </div>

                    {/* Admin Response */}
                    {ticket.admin_notes && (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-blue-700" />
                          <div className="text-xs font-semibold text-blue-900">Support Team Response</div>
                        </div>
                        <p className="text-sm text-blue-900 whitespace-pre-wrap">{ticket.admin_notes}</p>
                      </div>
                    )}

                    {/* Waiting for customer message */}
                    {ticket.status === 'waiting_for_customer' && !ticket.admin_notes && (
                      <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-2 text-purple-800 text-sm">
                          <AlertCircle className="w-4 h-4" />
                          <span className="font-medium">Waiting for additional information from you</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}