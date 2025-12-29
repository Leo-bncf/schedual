import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, X, Clock } from 'lucide-react';

const agentLabels = {
  preference_interpreter: 'Preference Interpreter',
  schedule_critic: 'Schedule Critic',
  what_if_simulator: 'What-If Simulator',
  load_balancer: 'Load Balancer',
  pedagogy_compliance: 'Pedagogy & Compliance',
};

const severityColors = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-rose-100 text-rose-700',
  success: 'bg-emerald-100 text-emerald-700',
};

const statusIcons = {
  pending: Clock,
  reviewed: Check,
  applied: Check,
  dismissed: X,
};

export default function AIAdvisorCard({ log, onApply, onDismiss }) {
  const StatusIcon = statusIcons[log.status] || Clock;

  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden bg-gradient-to-br from-white to-slate-50/50 relative">
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-500 via-indigo-500 to-purple-500" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-100 via-indigo-100 to-purple-100 shadow-sm">
              <Sparkles className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                {agentLabels[log.agent_type] || log.agent_type}
              </CardTitle>
              <p className="text-sm text-slate-500 capitalize">{log.action}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${severityColors[log.severity]} border-0 font-medium shadow-sm`}>
              {log.severity}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1 border-slate-200">
              <StatusIcon className="w-3 h-3" />
              {log.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {log.output?.message && (
          <p className="text-slate-700 mb-4 leading-relaxed">{log.output.message}</p>
        )}
        {log.output?.recommendations && (
          <div className="space-y-2 mb-4 p-3 rounded-lg bg-gradient-to-br from-violet-50/50 to-indigo-50/50 border border-violet-100">
            <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <div className="w-1 h-4 bg-gradient-to-b from-violet-500 to-indigo-500 rounded-full" />
              Recommendations:
            </p>
            <ul className="list-disc list-inside text-sm text-slate-700 space-y-1.5 ml-3">
              {log.output.recommendations.map((rec, i) => (
                <li key={i} className="leading-relaxed">{rec}</li>
              ))}
            </ul>
          </div>
        )}
        {log.status === 'pending' && (
          <div className="flex gap-2 mt-4">
            <Button 
              size="sm" 
              onClick={() => onApply && onApply(log)} 
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all"
            >
              <Check className="w-3 h-3 mr-1" />
              Apply Suggestion
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onDismiss && onDismiss(log)}
              className="hover:bg-slate-100 border-slate-200"
            >
              <X className="w-3 h-3 mr-1" />
              Dismiss
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}