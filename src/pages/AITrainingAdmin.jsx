import React from 'react';
import { Brain } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import PageHeader from '@/components/ui-custom/PageHeader';
import AgentTrainingSection from '@/components/ai-training/AgentTrainingSection';

export default function AITrainingAdmin() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Training"
        description="Review and improve the platform training agents"
      />

      <Card className="bg-gradient-to-r from-blue-50 to-violet-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">AI Agent Training System</h3>
              <p className="text-sm text-slate-600 mb-3">
                Upload documents to train AI agents. Review extractions field-by-field and mark them as correct or incorrect.
              </p>
              <div className="text-sm text-slate-600">
                <p><strong>How it works:</strong></p>
                <ol className="list-decimal list-inside space-y-1 mt-2">
                  <li>Upload a training document for any agent</li>
                  <li>AI extracts data and shows it for review</li>
                  <li>Mark each field as correct or incorrect</li>
                  <li>AI learns from corrections for future imports</li>
                </ol>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AgentTrainingSection agentName="student_importer" agentTitle="Student Import Agent" agentDescription="Train the AI to extract student data from documents accurately" />
      <AgentTrainingSection agentName="teacher_importer" agentTitle="Teacher Import Agent" agentDescription="Train the AI to extract teacher information and qualifications" />
      <AgentTrainingSection agentName="room_importer" agentTitle="Room Import Agent" agentDescription="Train the AI to extract classroom and facility information" />
      <AgentTrainingSection agentName="subject_importer" agentTitle="Subject Import Agent" agentDescription="Train the AI to extract subject details and IB requirements" />
    </div>
  );
}