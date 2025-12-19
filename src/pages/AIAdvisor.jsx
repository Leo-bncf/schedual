import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { 
  Sparkles, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Zap,
  Brain,
  Scale,
  Loader2,
  Send,
  RefreshCw
} from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import AIAdvisorCard from '../components/ai/AIAdvisorCard';
import EmptyState from '../components/ui-custom/EmptyState';

const AGENT_TYPES = [
  { id: 'preference_interpreter', name: 'Preference Interpreter', icon: MessageSquare, description: 'Converts natural language preferences into scheduling constraints' },
  { id: 'schedule_critic', name: 'Schedule Critic', icon: AlertTriangle, description: 'Analyzes schedules for inefficiencies and improvements' },
  { id: 'what_if_simulator', name: 'What-If Simulator', icon: Zap, description: 'Simulates changes and predicts their impact' },
  { id: 'load_balancer', name: 'Load Balancer', icon: Scale, description: 'Ensures fair distribution of workload' },
  { id: 'pedagogy_compliance', name: 'Pedagogy & Compliance', icon: Brain, description: 'Checks IB requirements and best practices' },
];

export default function AIAdvisor() {
  const [activeTab, setActiveTab] = useState('all');
  const [userInput, setUserInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const queryClient = useQueryClient();

  const { data: aiLogs = [], isLoading } = useQuery({
    queryKey: ['aiLogs'],
    queryFn: () => base44.entities.AIAdvisorLog.list('-created_date', 50),
  });

  const { data: scheduleVersions = [] } = useQuery({
    queryKey: ['scheduleVersions'],
    queryFn: () => base44.entities.ScheduleVersion.list('-created_date', 1),
  });

  const updateLogMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AIAdvisorLog.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aiLogs'] }),
  });

  const createLogMutation = useMutation({
    mutationFn: (data) => base44.entities.AIAdvisorLog.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aiLogs'] }),
  });

  const handleApplySuggestion = async (log) => {
    await updateLogMutation.mutateAsync({
      id: log.id,
      data: { status: 'applied', reviewed_at: new Date().toISOString() }
    });
  };

  const handleDismissSuggestion = async (log) => {
    await updateLogMutation.mutateAsync({
      id: log.id,
      data: { status: 'dismissed', reviewed_at: new Date().toISOString() }
    });
  };

  const handleAnalyzeSchedule = async () => {
    if (!scheduleVersions[0]) return;
    
    setIsAnalyzing(true);
    
    // Simulate AI analysis
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const analyses = [
      {
        agent_type: 'schedule_critic',
        action: 'analysis',
        severity: 'warning',
        output: {
          message: 'Physics HL classes are concentrated at the end of the week, which may cause student fatigue.',
          recommendations: [
            'Consider distributing Physics HL across Monday-Wednesday',
            'Ensure adequate breaks between double periods'
          ]
        },
        status: 'pending'
      },
      {
        agent_type: 'load_balancer',
        action: 'analysis',
        severity: 'info',
        output: {
          message: 'Teacher workload is well balanced. Dr. Smith has 2 hours more than average.',
          recommendations: [
            'Consider redistributing one Chemistry SL section',
            'Overall workload variance is within acceptable limits'
          ]
        },
        status: 'pending'
      }
    ];

    for (const analysis of analyses) {
      await createLogMutation.mutateAsync({
        ...analysis,
        schedule_version_id: scheduleVersions[0]?.id
      });
    }
    
    setIsAnalyzing(false);
  };

  const handleInterpretPreference = async () => {
    if (!userInput.trim()) return;
    
    setIsAnalyzing(true);
    
    // Simulate preference interpretation
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    await createLogMutation.mutateAsync({
      agent_type: 'preference_interpreter',
      action: 'suggestion',
      severity: 'success',
      input_context: { user_input: userInput },
      output: {
        message: `Interpreted preference: "${userInput}"`,
        recommendations: [
          'Created soft constraint with weight 0.7',
          'Applied to relevant teaching groups',
          'Will be considered in next schedule generation'
        ]
      },
      status: 'pending'
    });
    
    setUserInput('');
    setIsAnalyzing(false);
  };

  const filteredLogs = activeTab === 'all' 
    ? aiLogs 
    : aiLogs.filter(log => log.agent_type === activeTab);

  const pendingCount = aiLogs.filter(l => l.status === 'pending').length;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="AI Advisor"
        description="Intelligent scheduling assistance and recommendations"
        actions={
          <Button 
            onClick={handleAnalyzeSchedule} 
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            disabled={isAnalyzing || !scheduleVersions[0]}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Analyze Schedule
              </>
            )}
          </Button>
        }
      />

      {/* Agent Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {AGENT_TYPES.map(agent => {
          const Icon = agent.icon;
          const agentLogs = aiLogs.filter(l => l.agent_type === agent.id);
          const pendingAgentLogs = agentLogs.filter(l => l.status === 'pending').length;
          
          return (
            <Card 
              key={agent.id} 
              className={`border-0 shadow-sm cursor-pointer transition-all hover:shadow-md ${
                activeTab === agent.id ? 'ring-2 ring-indigo-500' : ''
              }`}
              onClick={() => setActiveTab(agent.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-violet-100 to-indigo-100">
                    <Icon className="w-5 h-5 text-violet-600" />
                  </div>
                  {pendingAgentLogs > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 border-0">
                      {pendingAgentLogs}
                    </Badge>
                  )}
                </div>
                <h3 className="font-medium text-slate-900 text-sm">{agent.name}</h3>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Preference Input */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-violet-500" />
              Add Preference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea 
                placeholder="Describe a scheduling preference in natural language, e.g., 'Dr. Smith prefers not to teach on Wednesday afternoons' or 'Keep all DP2 Physics classes in the morning'"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                className="min-h-[120px] resize-none"
              />
              <Button 
                onClick={handleInterpretPreference}
                disabled={!userInput.trim() || isAnalyzing}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Interpret & Add Constraint
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Insights Feed */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Insights & Recommendations
                  {pendingCount > 0 && (
                    <Badge className="ml-2 bg-amber-100 text-amber-700 border-0">
                      {pendingCount} pending
                    </Badge>
                  )}
                </CardTitle>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="bg-slate-100 h-8">
                    <TabsTrigger value="all" className="text-xs px-3 h-6">All</TabsTrigger>
                    <TabsTrigger value="pending" className="text-xs px-3 h-6">Pending</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {filteredLogs.length === 0 && !isLoading ? (
                <EmptyState 
                  icon={Sparkles}
                  title="No insights yet"
                  description="Run an analysis or add preferences to get AI-powered recommendations."
                />
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {filteredLogs
                    .filter(log => activeTab !== 'pending' || log.status === 'pending')
                    .map(log => (
                      <AIAdvisorCard 
                        key={log.id}
                        log={log}
                        onApply={handleApplySuggestion}
                        onDismiss={handleDismissSuggestion}
                      />
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}