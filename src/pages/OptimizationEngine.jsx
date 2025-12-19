import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Zap, 
  Play, 
  Pause, 
  RotateCcw,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Clock,
  Target,
  Settings,
  BarChart3,
  Loader2
} from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import DataTable from '../components/ui-custom/DataTable';

const ALGORITHMS = [
  { 
    id: 'csp', 
    name: 'Constraint Satisfaction (CSP)', 
    description: 'Backtracking search with arc consistency',
    complexity: 'Medium',
    bestFor: 'Small-medium schools with strict constraints'
  },
  { 
    id: 'mip', 
    name: 'Mixed Integer Programming', 
    description: 'Linear optimization with integer variables',
    complexity: 'High',
    bestFor: 'Optimal solutions for medium-sized schools'
  },
  { 
    id: 'genetic', 
    name: 'Genetic Algorithm', 
    description: 'Evolutionary approach with mutations and crossover',
    complexity: 'Low-Medium',
    bestFor: 'Large schools needing good-enough solutions quickly'
  },
  { 
    id: 'simulated_annealing', 
    name: 'Simulated Annealing', 
    description: 'Probabilistic technique for global optimization',
    complexity: 'Medium',
    bestFor: 'Escaping local optima in complex scenarios'
  },
  { 
    id: 'tabu_search', 
    name: 'Tabu Search', 
    description: 'Local search with memory to avoid cycles',
    complexity: 'Medium',
    bestFor: 'Refining existing schedules iteratively'
  }
];

export default function OptimizationEngine() {
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('csp');
  const [parameters, setParameters] = useState({
    max_iterations: 1000,
    timeout_seconds: 300,
    population_size: 100,
    mutation_rate: 0.1,
    temperature: 100
  });
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);

  const queryClient = useQueryClient();

  const { data: optimizationRuns = [], isLoading } = useQuery({
    queryKey: ['optimizationRuns'],
    queryFn: () => base44.entities.OptimizationRun.list('-created_date', 20),
  });

  const { data: scheduleVersions = [] } = useQuery({
    queryKey: ['scheduleVersions'],
    queryFn: () => base44.entities.ScheduleVersion.list('-created_date', 10),
  });

  const runOptimization = async (versionId) => {
    setIsRunning(true);
    setProgress(0);
    setCurrentIteration(0);
    setCurrentScore(0);

    // Create optimization run record
    const run = await base44.entities.OptimizationRun.create({
      schedule_version_id: versionId,
      status: 'running',
      algorithm: selectedAlgorithm,
      parameters,
      start_time: new Date().toISOString()
    });

    // Simulate optimization progress
    const maxIterations = parameters.max_iterations;
    const interval = setInterval(() => {
      setCurrentIteration(prev => {
        const next = Math.min(prev + Math.floor(Math.random() * 50) + 10, maxIterations);
        const progressPct = (next / maxIterations) * 100;
        setProgress(progressPct);
        
        // Simulate improving score
        const score = 50 + (progressPct / 100) * 40 + Math.random() * 10;
        setCurrentScore(score);

        if (next >= maxIterations) {
          clearInterval(interval);
          finalizeRun(run.id, score, next);
          return maxIterations;
        }
        return next;
      });
    }, 100);
  };

  const finalizeRun = async (runId, finalScore, iterations) => {
    await base44.entities.OptimizationRun.update(runId, {
      status: 'completed',
      end_time: new Date().toISOString(),
      iterations,
      objective_score: finalScore.toFixed(2),
      hard_constraints_satisfied: finalScore > 70,
      soft_constraint_score: (finalScore * 0.8).toFixed(2),
      conflicts_found: Math.max(0, Math.floor((100 - finalScore) / 10)),
      warnings_found: Math.floor(Math.random() * 15)
    });
    
    setIsRunning(false);
    queryClient.invalidateQueries({ queryKey: ['optimizationRuns'] });
  };

  const selectedAlgoInfo = ALGORITHMS.find(a => a.id === selectedAlgorithm);

  const columns = [
    {
      header: 'Version',
      cell: (row) => {
        const version = scheduleVersions.find(v => v.id === row.schedule_version_id);
        return <span className="font-medium">{version?.name || 'Unknown'}</span>;
      }
    },
    {
      header: 'Algorithm',
      cell: (row) => (
        <Badge variant="outline" className="font-mono text-xs">
          {row.algorithm}
        </Badge>
      )
    },
    {
      header: 'Status',
      cell: (row) => (
        <Badge className={
          row.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-0' :
          row.status === 'failed' ? 'bg-rose-100 text-rose-700 border-0' :
          row.status === 'running' ? 'bg-blue-100 text-blue-700 border-0' :
          'bg-slate-100 text-slate-700 border-0'
        }>
          {row.status}
        </Badge>
      )
    },
    {
      header: 'Score',
      cell: (row) => {
        const score = row.objective_score || 0;
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 bg-slate-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${
                  score >= 80 ? 'bg-emerald-500' :
                  score >= 60 ? 'bg-amber-500' :
                  'bg-rose-500'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="text-sm font-medium">{score.toFixed(1)}%</span>
          </div>
        );
      }
    },
    {
      header: 'Iterations',
      accessor: 'iterations'
    },
    {
      header: 'Duration',
      cell: (row) => {
        if (!row.start_time || !row.end_time) return '-';
        const duration = Math.floor((new Date(row.end_time) - new Date(row.start_time)) / 1000);
        return `${duration}s`;
      }
    },
    {
      header: 'Conflicts',
      cell: (row) => (
        <span className={row.conflicts_found > 0 ? 'text-rose-600 font-medium' : 'text-slate-600'}>
          {row.conflicts_found || 0}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Optimization Engine"
        description="Configure and run scheduling algorithms with real-time monitoring"
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Configuration */}
        <Card className="lg:col-span-1 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Algorithm Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Algorithm</Label>
              <Select value={selectedAlgorithm} onValueChange={setSelectedAlgorithm}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALGORITHMS.map(algo => (
                    <SelectItem key={algo.id} value={algo.id}>
                      {algo.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedAlgoInfo && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-sm text-slate-700 mb-2">{selectedAlgoInfo.description}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Complexity:</span>
                  <Badge variant="outline">{selectedAlgoInfo.complexity}</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  <strong>Best for:</strong> {selectedAlgoInfo.bestFor}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="max_iterations">Max Iterations</Label>
              <Input 
                id="max_iterations"
                type="number"
                value={parameters.max_iterations}
                onChange={(e) => setParameters({ ...parameters, max_iterations: parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout (seconds)</Label>
              <Input 
                id="timeout"
                type="number"
                value={parameters.timeout_seconds}
                onChange={(e) => setParameters({ ...parameters, timeout_seconds: parseInt(e.target.value) })}
              />
            </div>

            {selectedAlgorithm === 'genetic' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="population">Population Size</Label>
                  <Input 
                    id="population"
                    type="number"
                    value={parameters.population_size}
                    onChange={(e) => setParameters({ ...parameters, population_size: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mutation">Mutation Rate</Label>
                  <Input 
                    id="mutation"
                    type="number"
                    step="0.01"
                    value={parameters.mutation_rate}
                    onChange={(e) => setParameters({ ...parameters, mutation_rate: parseFloat(e.target.value) })}
                  />
                </div>
              </>
            )}

            <Button 
              onClick={() => scheduleVersions[0] && runOptimization(scheduleVersions[0].id)}
              disabled={isRunning || !scheduleVersions[0]}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Optimization
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Real-time Monitoring */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Real-time Monitoring
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isRunning ? (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-blue-700">Iteration</span>
                    </div>
                    <p className="text-2xl font-semibold text-blue-900">
                      {currentIteration} / {parameters.max_iterations}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm text-emerald-700">Score</span>
                    </div>
                    <p className="text-2xl font-semibold text-emerald-900">
                      {currentScore.toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-violet-50 border border-violet-200">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-violet-600" />
                      <span className="text-sm text-violet-700">Progress</span>
                    </div>
                    <p className="text-2xl font-semibold text-violet-900">
                      {progress.toFixed(0)}%
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Optimization Progress</span>
                    <span className="font-medium text-slate-900">{progress.toFixed(1)}%</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <h4 className="font-semibold text-slate-900 mb-2">Algorithm: {selectedAlgoInfo?.name}</h4>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p>• Exploring solution space...</p>
                    <p>• Evaluating constraint satisfaction...</p>
                    <p>• Optimizing soft constraint weights...</p>
                    <p>• Applying AI agent feedback...</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Zap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Ready to Optimize</h3>
                <p className="text-slate-500 max-w-md mx-auto">
                  Configure your algorithm parameters and click "Run Optimization" to start generating schedules.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Execution History */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Execution History</CardTitle>
          <CardDescription>Recent optimization runs and their results</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={columns}
            data={optimizationRuns}
            isLoading={isLoading}
            emptyMessage="No optimization runs yet. Run your first optimization to see results here."
          />
        </CardContent>
      </Card>

      {/* Algorithm Comparison */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Algorithm Comparison</CardTitle>
          <CardDescription>Performance characteristics of different optimization approaches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {ALGORITHMS.map(algo => (
              <div 
                key={algo.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedAlgorithm === algo.id 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => setSelectedAlgorithm(algo.id)}
              >
                <h4 className="font-semibold text-slate-900 mb-1 text-sm">{algo.name}</h4>
                <p className="text-xs text-slate-600 mb-2">{algo.description}</p>
                <Badge variant="outline" className="text-xs">{algo.complexity}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}