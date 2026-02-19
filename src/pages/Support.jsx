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

  const getStatusIcon = (status) => {
    const icons = {
      open: Clock,
      in_progress: Loader2,
      waiting_for_customer: AlertCircle,
      resolved: CheckCircle,
      closed: CheckCircle
    };
    return icons[status] || Clock;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-slate-900 mb-3">Support Center</h1>
              <p className="text-lg text-slate-600 mb-4">
                Need help with Schedual? Our team is here to assist you with technical issues, 
                account questions, scheduling problems, or any other concerns.
              </p>
              <div className="grid sm:grid-cols-3 gap-4 mt-6">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <Clock className="w-5 h-5 text-blue-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-blue-900 text-sm">Response Time</div>
                    <div className="text-xs text-blue-700 mt-1">Within 24-48 hours</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
                  <CheckCircle className="w-5 h-5 text-green-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-green-900 text-sm">Priority Support</div>
                    <div className="text-xs text-green-700 mt-1">Available for all plans</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                  <Inbox className="w-5 h-5 text-indigo-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-indigo-900 text-sm">Track Progress</div>
                    <div className="text-xs text-indigo-700 mt-1">Real-time ticket updates</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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