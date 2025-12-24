import React from 'react';
import PageHeader from '../components/ui-custom/PageHeader';
import SupportTicketForm from '../components/support/SupportTicketForm';

export default function Support() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader 
        title="Support"
        description="Submit a support ticket and our team will respond within 24 hours"
      />
      
      <SupportTicketForm />
    </div>
  );
}