import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  MessageCircle,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Mail,
  Building2,
  X
} from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import DataTable from '../components/ui-custom/DataTable';
import {
  Dialog,
  DialogContent,
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

export default function SupportTickets() {
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['allTickets'],
    queryFn: () => base44.entities.SupportTicket.list('-created_date'),
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const updateTicketMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SupportTicket.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['allTickets']);
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedTicket) return;

    const updatedMessages = [
      ...(selectedTicket.messages || []),
      {
        sender: user.full_name,
        message: newMessage,
        timestamp: new Date().toISOString(),
        is_admin: true
      }
    ];

    updateTicketMutation.mutate({
      id: selectedTicket.id,
      data: { 
        messages: updatedMessages,
        status: 'waiting_for_customer'
      }
    });

    setNewMessage('');
  };

  const handleStatusChange = (status) => {
    if (!selectedTicket) return;
    
    const updateData = { status };
    if (status === 'resolved' || status === 'closed') {
      updateData.resolved_at = new Date().toISOString();
    }

    updateTicketMutation.mutate({
      id: selectedTicket.id,
      data: updateData
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-blue-100 text-blue-700 border-0"><Clock className="w-3 h-3 mr-1" />Open</Badge>;
      case 'in_progress':
        return <Badge className="bg-amber-100 text-amber-700 border-0"><AlertCircle className="w-3 h-3 mr-1" />In Progress</Badge>;
      case 'waiting_for_customer':
        return <Badge className="bg-violet-100 text-violet-700 border-0"><MessageCircle className="w-3 h-3 mr-1" />Waiting</Badge>;
      case 'resolved':
        return <Badge className="bg-emerald-100 text-emerald-700 border-0"><CheckCircle className="w-3 h-3 mr-1" />Resolved</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-600">Closed</Badge>;
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'text-slate-600',
      medium: 'text-blue-600',
      high: 'text-orange-600',
      urgent: 'text-rose-600'
    };
    return colors[priority] || 'text-slate-600';
  };

  const filteredTickets = filterStatus === 'all' 
    ? tickets 
    : tickets.filter(t => t.status === filterStatus);

  const columns = [
    {
      header: 'Ticket',
      accessor: 'subject',
      cell: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.subject}</p>
          <p className="text-xs text-slate-500 line-clamp-1">{row.description}</p>
        </div>
      )
    },
    {
      header: 'Customer',
      accessor: 'user_name',
      cell: (row) => (
        <div>
          <p className="text-sm font-medium text-slate-900">{row.user_name}</p>
          <p className="text-xs text-slate-500">{row.user_email}</p>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      cell: (row) => getStatusBadge(row.status)
    },
    {
      header: 'Priority',
      accessor: 'priority',
      cell: (row) => (
        <span className={`text-sm font-medium capitalize ${getPriorityColor(row.priority)}`}>
          {row.priority}
        </span>
      )
    },
    {
      header: 'Category',
      accessor: 'category',
      cell: (row) => (
        <Badge variant="outline" className="capitalize text-slate-600">
          {row.category.replace('_', ' ')}
        </Badge>
      )
    },
    {
      header: 'Messages',
      accessor: 'messages',
      cell: (row) => (
        <span className="text-sm text-slate-600">{row.messages?.length || 1}</span>
      )
    },
    {
      header: 'Created',
      accessor: 'created_date',
      cell: (row) => (
        <span className="text-sm text-slate-600">
          {format(new Date(row.created_date), 'MMM d, yyyy')}
        </span>
      )
    }
  ];

  // Stats
  const openCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;
  const waitingCount = tickets.filter(t => t.status === 'waiting_for_customer').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Support Tickets"
        description="Manage customer support requests"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Open</p>
                <p className="text-2xl font-bold text-slate-900">{openCount}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">In Progress</p>
                <p className="text-2xl font-bold text-slate-900">{inProgressCount}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Waiting</p>
                <p className="text-2xl font-bold text-slate-900">{waitingCount}</p>
              </div>
              <MessageCircle className="w-8 h-8 text-violet-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Resolved</p>
                <p className="text-2xl font-bold text-slate-900">{resolvedCount}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Filter:</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tickets</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="waiting_for_customer">Waiting for Customer</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <DataTable
            columns={columns}
            data={filteredTickets}
            isLoading={isLoading}
            emptyMessage="No tickets found"
            onRowClick={(ticket) => setSelectedTicket(ticket)}
          />
        </CardContent>
      </Card>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          {selectedTicket && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <DialogTitle className="text-xl mb-3">{selectedTicket.subject}</DialogTitle>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {selectedTicket.user_name}
                      </div>
                      <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {selectedTicket.user_email}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(selectedTicket.status)}
                        <Badge className="capitalize">{selectedTicket.priority}</Badge>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedTicket(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {/* Status Update */}
                <div className="flex items-center gap-2">
                  <Label>Change Status:</Label>
                  <Select value={selectedTicket.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="waiting_for_customer">Waiting for Customer</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Messages */}
                <div className="space-y-3 max-h-96 overflow-y-auto border rounded-lg p-4 bg-slate-50">
                  {selectedTicket.messages?.map((msg, idx) => (
                    <div key={idx} className={`p-4 rounded-lg ${msg.is_admin ? 'bg-indigo-100 border border-indigo-200' : 'bg-white border border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-slate-900">{msg.sender}</p>
                          {msg.is_admin && <Badge className="bg-indigo-600 text-white text-xs">Admin</Badge>}
                        </div>
                        <p className="text-xs text-slate-500">{format(new Date(msg.timestamp), 'MMM d, HH:mm')}</p>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  ))}
                </div>

                {/* Reply */}
                {selectedTicket.status !== 'closed' && (
                  <div className="space-y-2 border-t pt-4">
                    <Label>Reply to Customer</Label>
                    <Textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your response..."
                      className="min-h-32"
                    />
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleSendMessage} 
                        disabled={!newMessage.trim() || updateTicketMutation.isPending}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Send Reply
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}