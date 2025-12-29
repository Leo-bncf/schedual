import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { motion } from 'framer-motion';
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
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button 
              onClick={handleAnalyzeSchedule} 
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-shadow"
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
          </motion.div>
        }
      />

      {/* Agent Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {AGENT_TYPES.map((agent, index) => {
          const Icon = agent.icon;
          const agentLogs = aiLogs.filter(l => l.agent_type === agent.id);
          const pendingAgentLogs = agentLogs.filter(l => l.status === 'pending').length;
          
          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05, y: -8 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card 
                className={`border-0 shadow-lg cursor-pointer transition-all overflow-hidden h-full ${
                  activeTab === agent.id ? 'ring-2 ring-violet-500 bg-gradient-to-br from-violet-50 via-indigo-50 to-purple-50' : 'hover:shadow-2xl bg-white'
                }`}
                onClick={() => setActiveTab(agent.id)}
              >
                <div className={`h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500 ${
                  activeTab === agent.id ? 'opacity-100' : 'opacity-0'
                }`} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <motion.div 
                      className="p-3 rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-purple-600 shadow-lg"
                      whileHover={{ rotate: 360, scale: 1.1 }}
                      transition={{ duration: 0.6 }}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </motion.div>
                    {pendingAgentLogs > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-md">
                          {pendingAgentLogs}
                        </Badge>
                      </motion.div>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">{agent.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{agent.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Preference Input */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-white to-violet-50/30 overflow-hidden h-full">
            <div className="h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500" />
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                Add Preference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea 
                  placeholder="Describe a scheduling preference in natural language, e.g., 'Dr. Smith prefers not to teach on Wednesday afternoons' or 'Keep all DP2 Physics classes in the morning'"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  className="min-h-[120px] resize-none border-violet-200 focus:ring-violet-500"
                />
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button 
                    onClick={handleInterpretPreference}
                    disabled={!userInput.trim() || isAnalyzing}
                    className="w-full bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:via-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Interpret & Add Constraint
                  </Button>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Insights Feed */}
        <motion.div 
          className="lg:col-span-2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <CardTitle className="text-base">
                    Insights & Recommendations
                  </CardTitle>
                  {pendingCount > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-md">
                        {pendingCount} pending
                      </Badge>
                    </motion.div>
                  )}
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="bg-slate-100 h-8">
                    <TabsTrigger 
                      value="all" 
                      className="text-xs px-3 h-6 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white transition-all"
                    >
                      All
                    </TabsTrigger>
                    <TabsTrigger 
                      value="pending" 
                      className="text-xs px-3 h-6 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white transition-all"
                    >
                      Pending
                    </TabsTrigger>
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
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredLogs
                    .filter(log => activeTab !== 'pending' || log.status === 'pending')
                    .map((log, index) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.01, x: 4 }}
                      >
                        <AIAdvisorCard 
                          log={log}
                          onApply={handleApplySuggestion}
                          onDismiss={handleDismissSuggestion}
                        />
                      </motion.div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}