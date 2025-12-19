import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  Database, 
  Settings, 
  Sparkles, 
  Zap,
  Shield,
  Users,
  Calendar,
  GitBranch,
  FileText,
  AlertCircle
} from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';

export default function Documentation() {
  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader 
        title="Documentation"
        description="Comprehensive guide to IB Schedule system architecture and usage"
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="constraints">Constraints</TabsTrigger>
          <TabsTrigger value="ai">AI Agents</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                System Overview
              </CardTitle>
              <CardDescription>Understanding the IB Schedule architecture</CardDescription>
            </CardHeader>
            <CardContent className="prose prose-slate max-w-none">
              <h3>What is IB Schedule?</h3>
              <p>
                IB Schedule is a comprehensive scheduling engine specifically designed for IB Diploma Programme schools. 
                It combines constraint-based optimization with AI-powered advisory to create optimal timetables that 
                satisfy complex IB requirements.
              </p>

              <h3>Key Features</h3>
              <ul>
                <li><strong>Constraint Engine:</strong> Hard and soft constraints ensure schedules meet requirements and preferences</li>
                <li><strong>AI Agents:</strong> Intelligent advisors provide suggestions and analyze schedule quality</li>
                <li><strong>Teaching Groups:</strong> Organize students into HL/SL sections with proper teacher assignments</li>
                <li><strong>Multi-tenancy:</strong> Secure separation of data between schools</li>
                <li><strong>Explainability:</strong> Full transparency in scheduling decisions</li>
                <li><strong>Scenario Testing:</strong> What-if analysis for schedule changes</li>
              </ul>

              <h3>Architecture Components</h3>
              <div className="grid grid-cols-2 gap-4 not-prose">
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <Database className="w-6 h-6 text-blue-600 mb-2" />
                  <h4 className="font-semibold text-blue-900">Data Layer</h4>
                  <p className="text-sm text-blue-700">Entities with relationships and constraints</p>
                </div>
                <div className="p-4 rounded-lg bg-violet-50 border border-violet-200">
                  <Sparkles className="w-6 h-6 text-violet-600 mb-2" />
                  <h4 className="font-semibold text-violet-900">AI Agents</h4>
                  <p className="text-sm text-violet-700">Advisory and optimization intelligence</p>
                </div>
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                  <Shield className="w-6 h-6 text-emerald-600 mb-2" />
                  <h4 className="font-semibold text-emerald-900">Constraint Engine</h4>
                  <p className="text-sm text-emerald-700">Rule validation and conflict detection</p>
                </div>
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <Calendar className="w-6 h-6 text-amber-600 mb-2" />
                  <h4 className="font-semibold text-amber-900">Schedule Generator</h4>
                  <p className="text-sm text-amber-700">Optimization algorithms and timetabling</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Database Schema
              </CardTitle>
              <CardDescription>Entity relationships and data model</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-slate-900 mb-4">Core Entities</h3>
                <div className="space-y-3">
                  <EntityDoc 
                    name="School"
                    description="Top-level entity for multi-tenancy"
                    fields={["name", "code", "ib_school_code", "timezone", "academic_year", "periods_per_day"]}
                  />
                  <EntityDoc 
                    name="Subject"
                    description="IB subjects with group, level, and hours configuration"
                    fields={["name", "code", "ib_group", "available_levels", "hl_hours_per_week", "sl_hours_per_week"]}
                    references={["school_id"]}
                  />
                  <EntityDoc 
                    name="Teacher"
                    description="Teaching staff with availability and preferences"
                    fields={["full_name", "email", "subjects", "max_hours_per_week", "preferred_free_day", "unavailable_slots"]}
                    references={["school_id", "user_id"]}
                  />
                  <EntityDoc 
                    name="Student"
                    description="IB students with subject choices"
                    fields={["full_name", "student_id", "year_group", "subject_choices", "assigned_groups"]}
                    references={["school_id", "user_id"]}
                  />
                  <EntityDoc 
                    name="TeachingGroup"
                    description="Class sections grouping students by subject/level"
                    fields={["name", "level", "year_group", "student_ids", "hours_per_week", "requires_double_periods"]}
                    references={["school_id", "subject_id", "teacher_id", "preferred_room_id"]}
                  />
                  <EntityDoc 
                    name="Room"
                    description="Physical spaces with capacity and type"
                    fields={["name", "capacity", "room_type", "equipment"]}
                    references={["school_id"]}
                  />
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-4">Schedule Entities</h3>
                <div className="space-y-3">
                  <EntityDoc 
                    name="ScheduleVersion"
                    description="Schedule iterations with status and metrics"
                    fields={["name", "status", "academic_year", "score", "conflicts_count", "generated_at"]}
                    references={["school_id"]}
                  />
                  <EntityDoc 
                    name="ScheduleSlot"
                    description="Individual time slot assignments"
                    fields={["day", "period", "is_double_period", "status"]}
                    references={["school_id", "schedule_version", "teaching_group_id", "room_id"]}
                  />
                  <EntityDoc 
                    name="ConflictReport"
                    description="Detected scheduling conflicts"
                    fields={["conflict_type", "severity", "affected_entities", "suggested_resolution", "status"]}
                    references={["school_id", "schedule_version_id"]}
                  />
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-4">Control Entities</h3>
                <div className="space-y-3">
                  <EntityDoc 
                    name="Constraint"
                    description="Scheduling rules (hard/soft)"
                    fields={["name", "type", "category", "rule", "weight", "is_active", "source"]}
                    references={["school_id"]}
                  />
                  <EntityDoc 
                    name="AIAdvisorLog"
                    description="AI agent suggestions and analysis"
                    fields={["agent_type", "action", "input_context", "output", "severity", "status"]}
                    references={["school_id", "schedule_version_id"]}
                  />
                  <EntityDoc 
                    name="OptimizationRun"
                    description="Optimization execution tracking"
                    fields={["algorithm", "status", "objective_score", "iterations", "execution_log"]}
                    references={["school_id", "schedule_version_id"]}
                  />
                  <EntityDoc 
                    name="AuditLog"
                    description="System activity audit trail"
                    fields={["action", "entity_type", "entity_id", "changes", "metadata"]}
                    references={["school_id", "user_id"]}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="constraints" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Constraint System
              </CardTitle>
              <CardDescription>Understanding hard and soft constraints</CardDescription>
            </CardHeader>
            <CardContent className="prose prose-slate max-w-none">
              <h3>Constraint Types</h3>
              
              <div className="grid grid-cols-2 gap-4 not-prose mb-6">
                <div className="p-4 rounded-lg bg-rose-50 border border-rose-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-rose-600" />
                    <h4 className="font-semibold text-rose-900">Hard Constraints</h4>
                  </div>
                  <p className="text-sm text-rose-700">Must be satisfied. Schedule is invalid if violated.</p>
                </div>
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="w-5 h-5 text-amber-600" />
                    <h4 className="font-semibold text-amber-900">Soft Constraints</h4>
                  </div>
                  <p className="text-sm text-amber-700">Preferences. Optimizer tries to maximize satisfaction.</p>
                </div>
              </div>

              <h3>Hard Constraint Examples</h3>
              <ul>
                <li><strong>No Double Booking:</strong> Teachers/students/rooms cannot be in multiple places simultaneously</li>
                <li><strong>Teacher Availability:</strong> Teachers cannot teach during unavailable time slots</li>
                <li><strong>Room Capacity:</strong> Teaching group size must not exceed room capacity</li>
                <li><strong>IB Requirements:</strong> HL subjects must meet minimum 6 hours/week</li>
                <li><strong>Subject Groups:</strong> Students must take one subject from each IB group (1-6)</li>
              </ul>

              <h3>Soft Constraint Examples</h3>
              <ul>
                <li><strong>Teacher Free Day:</strong> Preference for specific day without teaching</li>
                <li><strong>Gap Minimization:</strong> Reduce free periods for students</li>
                <li><strong>Morning Preference:</strong> Schedule certain subjects in morning periods</li>
                <li><strong>Balanced Workload:</strong> Distribute teaching hours evenly</li>
                <li><strong>Double Period Grouping:</strong> Keep double periods on same day</li>
              </ul>

              <h3>Constraint Categories</h3>
              <div className="grid grid-cols-2 gap-3 not-prose">
                <ConstraintCategory icon="👨‍🏫" name="Teacher" description="Staff scheduling preferences" />
                <ConstraintCategory icon="🎓" name="Student" description="Student welfare and optimization" />
                <ConstraintCategory icon="🏫" name="Room" description="Space allocation rules" />
                <ConstraintCategory icon="📚" name="Subject" description="Subject-specific requirements" />
                <ConstraintCategory icon="⏰" name="Time" description="Temporal constraints" />
                <ConstraintCategory icon="🎯" name="IB Requirement" description="Official IB DP rules" />
              </div>

              <h3>Constraint Weight System</h3>
              <p>
                Soft constraints use a weight (0.0 to 1.0) to indicate importance:
              </p>
              <ul>
                <li><strong>0.9-1.0:</strong> Critical preference, strongly enforce</li>
                <li><strong>0.7-0.8:</strong> Important preference, should satisfy if possible</li>
                <li><strong>0.4-0.6:</strong> Moderate preference, nice to have</li>
                <li><strong>0.1-0.3:</strong> Low priority, optional</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                AI Advisory Agents
              </CardTitle>
              <CardDescription>Intelligent scheduling assistance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <AgentDoc 
                name="Preference Interpreter"
                description="Converts natural language preferences into formal constraints"
                inputs={["Natural language text", "Context (teacher/student/school)"]}
                outputs={["Structured constraint definition", "Weight suggestion", "Category assignment"]}
                example='Input: "Dr. Smith prefers not to teach on Wednesday afternoons"
Output: Soft constraint with teacher_id, day=Wednesday, period_range=[5-8], weight=0.7'
              />

              <AgentDoc 
                name="Schedule Critic"
                description="Analyzes candidate schedules and identifies improvements"
                inputs={["Schedule version", "All constraints", "Historical data"]}
                outputs={["Efficiency score", "Violation warnings", "Improvement suggestions"]}
                example='Detects: "Physics HL classes concentrated at week end, may cause student fatigue"
Suggests: "Redistribute Physics across Monday-Wednesday"'
              />

              <AgentDoc 
                name="What-If Simulator"
                description="Tests impact of schedule changes without committing"
                inputs={["Current schedule", "Proposed change", "Constraints"]}
                outputs={["Impact analysis", "New conflicts", "Score delta", "Recommendation"]}
                example='Query: "What if we add another Chemistry HL section?"
Output: Creates 2 new conflicts, reduces average class size, requires 1 additional room'
              />

              <AgentDoc 
                name="Load Balancer"
                description="Ensures equitable workload distribution"
                inputs={["All teaching assignments", "Teacher availability", "Workload limits"]}
                outputs={["Workload distribution report", "Rebalancing suggestions", "Fairness metrics"]}
                example='Detects: Teacher A has 28 hours, Teacher B has 18 hours
Suggests: Reassign one Chemistry SL section from A to B'
              />

              <AgentDoc 
                name="Pedagogy & Compliance"
                description="Validates IB-specific requirements and best practices"
                inputs={["Schedule", "IB curriculum rules", "School policies"]}
                outputs={["Compliance report", "Pedagogical warnings", "Sequencing recommendations"]}
                example='Checks: Core components (TOK, EE, CAS) properly scheduled
Validates: HL subjects follow recommended topic sequence'
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflow" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                Scheduling Workflow
              </CardTitle>
              <CardDescription>Step-by-step process for schedule generation</CardDescription>
            </CardHeader>
            <CardContent className="prose prose-slate max-w-none">
              <h3>1. Setup Phase</h3>
              <ol>
                <li>Configure school settings (periods, duration, start time)</li>
                <li>Add subjects with IB group assignments and HL/SL hours</li>
                <li>Register teachers with availability and preferences</li>
                <li>Import students with subject choices</li>
                <li>Define rooms with capacities and types</li>
                <li>Set up constraints (system + custom)</li>
              </ol>

              <h3>2. Teaching Group Formation</h3>
              <ol>
                <li>Create teaching groups for each subject/level combination</li>
                <li>Assign teachers based on subject expertise</li>
                <li>Allocate students based on their choices and level</li>
                <li>Set preferred rooms (especially for labs, studios)</li>
                <li>Configure double period requirements</li>
              </ol>

              <h3>3. Schedule Generation</h3>
              <ol>
                <li>Create new schedule version (Draft)</li>
                <li>Run optimization engine with selected algorithm</li>
                <li>Engine evaluates all constraints iteratively</li>
                <li>AI agents provide feedback and suggestions</li>
                <li>Optimizer adjusts soft constraint weights</li>
                <li>Process repeats until convergence or timeout</li>
              </ol>

              <h3>4. Review & Refinement</h3>
              <ol>
                <li>Review conflicts and warnings</li>
                <li>Analyze AI advisor suggestions</li>
                <li>Run what-if scenarios for alternatives</li>
                <li>Manual adjustments if needed</li>
                <li>Re-run optimization with refined constraints</li>
              </ol>

              <h3>5. Publication</h3>
              <ol>
                <li>Verify all hard constraints satisfied</li>
                <li>Check soft constraint satisfaction score</li>
                <li>Publish schedule (makes it active)</li>
                <li>Notify stakeholders</li>
                <li>Archive previous published version</li>
              </ol>

              <h3>6. Maintenance</h3>
              <ol>
                <li>Monitor for changes (teacher absences, room closures)</li>
                <li>Use what-if simulator for impact analysis</li>
                <li>Create new version for significant changes</li>
                <li>Maintain audit log of all modifications</li>
              </ol>

              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 not-prose">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">Best Practices</h4>
                    <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                      <li>Start with draft versions and iterate</li>
                      <li>Test scenarios before major changes</li>
                      <li>Review AI suggestions carefully</li>
                      <li>Balance hard rules with soft preferences</li>
                      <li>Document custom constraints clearly</li>
                      <li>Maintain regular backups</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EntityDoc({ name, description, fields, references = [] }) {
  return (
    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-semibold text-slate-900">{name}</h4>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <Database className="w-5 h-5 text-slate-400" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-1">
          {fields.map((field, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {field}
            </Badge>
          ))}
        </div>
        {references.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>References:</span>
            {references.map((ref, i) => (
              <Badge key={i} className="bg-indigo-100 text-indigo-700 border-0 text-xs">
                {ref}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentDoc({ name, description, inputs, outputs, example }) {
  return (
    <div className="p-5 rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50">
      <div className="flex items-start gap-3 mb-3">
        <Sparkles className="w-6 h-6 text-violet-600 mt-0.5" />
        <div>
          <h4 className="font-semibold text-violet-900 text-lg">{name}</h4>
          <p className="text-sm text-violet-700">{description}</p>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-xs font-semibold text-violet-800 mb-2">INPUTS:</p>
          <ul className="text-sm text-violet-700 space-y-1">
            {inputs.map((input, i) => (
              <li key={i}>• {input}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-violet-800 mb-2">OUTPUTS:</p>
          <ul className="text-sm text-violet-700 space-y-1">
            {outputs.map((output, i) => (
              <li key={i}>• {output}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="p-3 rounded-lg bg-white/70 border border-violet-200">
        <p className="text-xs font-semibold text-violet-800 mb-1">EXAMPLE:</p>
        <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono">{example}</pre>
      </div>
    </div>
  );
}

function ConstraintCategory({ icon, name, description }) {
  return (
    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <span className="font-medium text-slate-900">{name}</span>
      </div>
      <p className="text-xs text-slate-600">{description}</p>
    </div>
  );
}