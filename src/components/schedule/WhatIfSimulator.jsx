import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Zap, AlertCircle, CheckCircle2, BarChart3, Loader2 } from 'lucide-react';

export default function WhatIfSimulator({ scheduleVersionId, isOpen, onClose }) {
  const [scenario, setScenario] = useState('none');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);

  React.useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [teacherData, groupData] = await Promise.all([
        base44.entities.Teacher.list(),
        base44.entities.TeachingGroup.list()
      ]);
      setTeachers(teacherData);
      setGroups(groupData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const runSimulation = async () => {
    if (scenario === 'none') {
      alert('Please select a what-if scenario');
      return;
    }

    setIsSimulating(true);
    try {
      const payload = {
        schedule_version_id: scheduleVersionId,
        scenario_type: scenario,
        teacher_id: selectedTeacher,
        group_id: selectedGroup
      };

      const response = await base44.functions.invoke('simulateWhatIf', payload);
      
      setSimulationResult({
        scenario,
        before: response.data.before_metrics,
        after: response.data.after_metrics,
        changes: response.data.changes,
        feasible: response.data.is_feasible,
        recommendations: response.data.recommendations
      });
    } catch (error) {
      console.error('Simulation error:', error);
      alert('Simulation failed: ' + error.message);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-600" />
            What-If Simulator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Scenario Selection */}
          <div className="space-y-3">
            <Label>Select Scenario</Label>
            <Select value={scenario} onValueChange={setScenario}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a what-if scenario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Select --</SelectItem>
                <SelectItem value="remove_teacher">Remove Teacher</SelectItem>
                <SelectItem value="reduce_room">Reduce Room Capacity</SelectItem>
                <SelectItem value="add_hours">Increase Required Hours</SelectItem>
                <SelectItem value="add_constraint">Add Availability Constraint</SelectItem>
                <SelectItem value="move_period">Move to Different Period</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Scenario-Specific Options */}
          {scenario === 'remove_teacher' && (
            <div className="space-y-3">
              <Label>Select Teacher to Remove</Label>
              <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(scenario === 'add_hours' || scenario === 'move_period') && (
            <div className="space-y-3">
              <Label>Select Teaching Group</Label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Run Simulation Button */}
          <Button 
            onClick={runSimulation}
            disabled={isSimulating || scenario === 'none'}
            className="w-full bg-yellow-600 hover:bg-yellow-700"
          >
            {isSimulating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Simulating...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Run Simulation
              </>
            )}
          </Button>

          {/* Results */}
          {simulationResult && (
            <div className="space-y-4">
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  {simulationResult.feasible ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      Scenario Feasible
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      Scenario Infeasible
                    </>
                  )}
                </h3>

                {/* Metrics Comparison */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Current Conflicts</p>
                    <p className="text-2xl font-bold">{simulationResult.before?.conflicts || 0}</p>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">After Change</p>
                    <p className="text-2xl font-bold">{simulationResult.after?.conflicts || 0}</p>
                  </div>
                </div>

                {/* Changes */}
                {simulationResult.changes && simulationResult.changes.length > 0 && (
                  <div className="bg-blue-50 p-3 rounded-lg mb-4">
                    <p className="text-sm font-medium mb-2">Required Changes:</p>
                    <ul className="text-sm space-y-1">
                      {simulationResult.changes.map((change, idx) => (
                        <li key={idx} className="text-slate-700">• {change}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendations */}
                {simulationResult.recommendations && (
                  <Alert>
                    <BarChart3 className="w-4 h-4" />
                    <AlertDescription>
                      {simulationResult.recommendations}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Close
          </Button>
          {simulationResult && (
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700">
              Apply Changes
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}