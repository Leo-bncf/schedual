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
        <TabsList className="bg-white border border-slate-200 w-full sm:w-auto shadow-sm">
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
        <TabsContent value="new" className="mt-8">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Form Section */}
            <div className="lg:col-span-2">
              <SupportTicketForm onSuccess={() => setActiveTab('history')} />
            </div>

            {/* Info Section */}
            <div className="space-y-6">
              <Card className="border-blue-200 bg-white shadow-lg">
                <CardHeader className="bg-gradient-to-br from-blue-50 to-white border-b border-blue-100">
                  <CardTitle className="text-lg text-blue-900">What We Can Help With</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-700 font-bold text-sm">1</span>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">Technical Issues</div>
                        <div className="text-xs text-slate-600 mt-0.5">Bugs, errors, or features not working as expected</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-700 font-bold text-sm">2</span>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">Scheduling Problems</div>
                        <div className="text-xs text-slate-600 mt-0.5">Conflicts, constraints, or optimization questions</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-700 font-bold text-sm">3</span>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">Account & Billing</div>
                        <div className="text-xs text-slate-600 mt-0.5">Subscription, payments, or account management</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-700 font-bold text-sm">4</span>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">Feature Requests</div>
                        <div className="text-xs text-slate-600 mt-0.5">Suggestions for new features or improvements</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white shadow-lg">
                <CardHeader className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-100">
                  <CardTitle className="text-lg text-slate-900">Tips for Quick Resolution</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ul className="space-y-2 text-xs text-slate-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Be specific about the issue you're experiencing</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Include relevant details (page, feature, error messages)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Mention what you've already tried</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Set priority level appropriately</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Ticket History Tab */}
        <TabsContent value="history" className="mt-8">
          {isLoading ? (
            <Card className="border-slate-200 shadow-lg">
              <CardContent className="py-20 text-center">
                <Loader2 className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-spin" />
                <p className="text-lg font-medium text-slate-700">Loading your tickets...</p>
              </CardContent>
            </Card>
          ) : tickets.length === 0 ? (
            <Card className="border-slate-200 shadow-lg bg-white">
              <CardContent className="py-28 text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mx-auto mb-6">
                  <Inbox className="w-10 h-10 text-blue-700" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">No Support Tickets Yet</h3>
                <p className="text-slate-600 mb-8 max-w-md mx-auto">
                  You haven't submitted any support tickets. If you need help, 
                  switch to the "New Ticket" tab to get started.
                </p>
                <button
                  onClick={() => setActiveTab('new')}
                  className="px-6 py-3 bg-blue-900 hover:bg-blue-800 text-white rounded-lg font-medium transition-colors"
                >
                  <MessageCircle className="w-4 h-4 inline mr-2" />
                  Create Your First Ticket
                </button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Tickets Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {['open', 'in_progress', 'resolved', 'closed'].map(status => {
                  const count = tickets.filter(t => t.status === status).length;
                  const StatusIcon = getStatusIcon(status);
                  return (
                    <Card key={status} className={`border-2 ${getStatusColor(status).replace('bg-', 'border-').split(' ')[0].replace('border-', 'border-')} bg-white shadow-sm`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${getStatusColor(status).split(' ')[0]} flex items-center justify-center`}>
                            <StatusIcon className={`w-5 h-5 ${getStatusColor(status).split(' ')[1]}`} />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-slate-900">{count}</div>
                            <div className="text-xs text-slate-600 capitalize">{status.replace(/_/g, ' ')}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Tickets List */}
              <div className="grid gap-5">
                {tickets.map((ticket) => {
                  const StatusIcon = getStatusIcon(ticket.status);
                  return (
                    <Card key={ticket.id} className="border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all bg-white">
                      <CardHeader className="pb-4 border-b border-slate-100">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1">
                            <div className={`w-12 h-12 rounded-xl ${getStatusColor(ticket.status).split(' ')[0]} flex items-center justify-center flex-shrink-0`}>
                              <StatusIcon className={`w-6 h-6 ${getStatusColor(ticket.status).split(' ')[1]} ${ticket.status === 'in_progress' ? 'animate-spin' : ''}`} />
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-xl mb-3">{ticket.subject}</CardTitle>
                              <div className="flex flex-wrap gap-2">
                                <Badge className={`${getStatusColor(ticket.status)} border`}>
                                  {ticket.status.replace(/_/g, ' ')}
                                </Badge>
                                <Badge className={getPriorityColor(ticket.priority)}>
                                  {ticket.priority} priority
                                </Badge>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 px-3 py-1 bg-slate-50 rounded-full">
                                  <Clock className="w-3.5 h-3.5" />
                                  {format(new Date(ticket.created_date), 'MMM d, yyyy • h:mm a')}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-5">
                        {/* Ticket Description */}
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                          <div className="text-xs font-semibold text-slate-500 mb-3">Your Message</div>
                          <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
                        </div>

                        {/* Admin Response */}
                        {ticket.admin_notes && (
                          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-200">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                                <CheckCircle className="w-4 h-4 text-white" />
                              </div>
                              <div className="text-xs font-semibold text-blue-900">Support Team Response</div>
                            </div>
                            <p className="text-sm text-blue-900 whitespace-pre-wrap leading-relaxed">{ticket.admin_notes}</p>
                          </div>
                        )}

                        {/* Waiting for customer message */}
                        {ticket.status === 'waiting_for_customer' && !ticket.admin_notes && (
                          <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                            <div className="flex items-center gap-3 text-purple-800">
                              <AlertCircle className="w-5 h-5 flex-shrink-0" />
                              <span className="font-medium text-sm">We need more information to help resolve this issue. Please check your email for details.</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}