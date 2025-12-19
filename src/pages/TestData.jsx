import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Database, 
  PlayCircle, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Users,
  GraduationCap,
  BookOpen,
  Building2,
  Calendar
} from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';

const SAMPLE_SUBJECTS = [
  { name: "English A: Language & Literature", code: "ENG-A", ib_group: 1, ib_group_name: "Language & Literature", available_levels: ["HL", "SL"], hl_hours_per_week: 6, sl_hours_per_week: 4 },
  { name: "Spanish B", code: "SPA-B", ib_group: 2, ib_group_name: "Language Acquisition", available_levels: ["HL", "SL"], hl_hours_per_week: 6, sl_hours_per_week: 4 },
  { name: "History", code: "HIST", ib_group: 3, ib_group_name: "Individuals & Societies", available_levels: ["HL", "SL"], hl_hours_per_week: 6, sl_hours_per_week: 4 },
  { name: "Economics", code: "ECON", ib_group: 3, ib_group_name: "Individuals & Societies", available_levels: ["HL", "SL"], hl_hours_per_week: 6, sl_hours_per_week: 4 },
  { name: "Physics", code: "PHY", ib_group: 4, ib_group_name: "Sciences", available_levels: ["HL", "SL"], hl_hours_per_week: 6, sl_hours_per_week: 4, requires_lab: true },
  { name: "Chemistry", code: "CHEM", ib_group: 4, ib_group_name: "Sciences", available_levels: ["HL", "SL"], hl_hours_per_week: 6, sl_hours_per_week: 4, requires_lab: true },
  { name: "Biology", code: "BIO", ib_group: 4, ib_group_name: "Sciences", available_levels: ["HL", "SL"], hl_hours_per_week: 6, sl_hours_per_week: 4, requires_lab: true },
  { name: "Mathematics: Analysis & Approaches", code: "MATH-AA", ib_group: 5, ib_group_name: "Mathematics", available_levels: ["HL", "SL"], hl_hours_per_week: 6, sl_hours_per_week: 4 },
  { name: "Visual Arts", code: "VA", ib_group: 6, ib_group_name: "The Arts", available_levels: ["HL", "SL"], hl_hours_per_week: 6, sl_hours_per_week: 4 },
  { name: "Computer Science", code: "CS", ib_group: 6, ib_group_name: "The Arts", available_levels: ["HL", "SL"], hl_hours_per_week: 6, sl_hours_per_week: 4 },
  { name: "Theory of Knowledge", code: "TOK", ib_group: 0, ib_group_name: "Core", is_core: true, hl_hours_per_week: 2, sl_hours_per_week: 2 },
];

const SAMPLE_TEACHERS = [
  { full_name: "Dr. Sarah Mitchell", email: "s.mitchell@school.edu", employee_id: "T001", max_hours_per_week: 25, preferred_free_day: "Wednesday" },
  { full_name: "Prof. James Chen", email: "j.chen@school.edu", employee_id: "T002", max_hours_per_week: 24 },
  { full_name: "Ms. Emma Rodriguez", email: "e.rodriguez@school.edu", employee_id: "T003", max_hours_per_week: 26, preferred_free_day: "Friday" },
  { full_name: "Dr. Michael Johnson", email: "m.johnson@school.edu", employee_id: "T004", max_hours_per_week: 25 },
  { full_name: "Mrs. Lisa Thompson", email: "l.thompson@school.edu", employee_id: "T005", max_hours_per_week: 20, preferred_free_day: "Monday" },
  { full_name: "Mr. David Park", email: "d.park@school.edu", employee_id: "T006", max_hours_per_week: 25 },
  { full_name: "Dr. Rachel Green", email: "r.green@school.edu", employee_id: "T007", max_hours_per_week: 24 },
  { full_name: "Prof. Ahmed Hassan", email: "a.hassan@school.edu", employee_id: "T008", max_hours_per_week: 26 },
];

const SAMPLE_STUDENTS_DP1 = [
  { full_name: "Alice Anderson", student_id: "DP1-001", year_group: "DP1", email: "alice.a@students.edu" },
  { full_name: "Bob Bradley", student_id: "DP1-002", year_group: "DP1", email: "bob.b@students.edu" },
  { full_name: "Carol Chen", student_id: "DP1-003", year_group: "DP1", email: "carol.c@students.edu" },
  { full_name: "David Davis", student_id: "DP1-004", year_group: "DP1", email: "david.d@students.edu" },
  { full_name: "Emma Evans", student_id: "DP1-005", year_group: "DP1", email: "emma.e@students.edu" },
  { full_name: "Frank Foster", student_id: "DP1-006", year_group: "DP1", email: "frank.f@students.edu" },
  { full_name: "Grace Garcia", student_id: "DP1-007", year_group: "DP1", email: "grace.g@students.edu" },
  { full_name: "Henry Harris", student_id: "DP1-008", year_group: "DP1", email: "henry.h@students.edu" },
  { full_name: "Iris Ibrahim", student_id: "DP1-009", year_group: "DP1", email: "iris.i@students.edu" },
  { full_name: "Jack Johnson", student_id: "DP1-010", year_group: "DP1", email: "jack.j@students.edu" },
];

const SAMPLE_STUDENTS_DP2 = [
  { full_name: "Kate Kim", student_id: "DP2-001", year_group: "DP2", email: "kate.k@students.edu" },
  { full_name: "Leo Lopez", student_id: "DP2-002", year_group: "DP2", email: "leo.l@students.edu" },
  { full_name: "Maya Martinez", student_id: "DP2-003", year_group: "DP2", email: "maya.m@students.edu" },
  { full_name: "Noah Nelson", student_id: "DP2-004", year_group: "DP2", email: "noah.n@students.edu" },
  { full_name: "Olivia O'Brien", student_id: "DP2-005", year_group: "DP2", email: "olivia.o@students.edu" },
  { full_name: "Peter Patel", student_id: "DP2-006", year_group: "DP2", email: "peter.p@students.edu" },
  { full_name: "Quinn Quinn", student_id: "DP2-007", year_group: "DP2", email: "quinn.q@students.edu" },
  { full_name: "Ruby Rodriguez", student_id: "DP2-008", year_group: "DP2", email: "ruby.r@students.edu" },
];

const SAMPLE_ROOMS = [
  { name: "Room 101", building: "Main Building", floor: "1", capacity: 25, room_type: "classroom" },
  { name: "Room 102", building: "Main Building", floor: "1", capacity: 25, room_type: "classroom" },
  { name: "Room 201", building: "Main Building", floor: "2", capacity: 30, room_type: "classroom" },
  { name: "Room 202", building: "Main Building", floor: "2", capacity: 30, room_type: "classroom" },
  { name: "Lab A", building: "Science Wing", floor: "1", capacity: 20, room_type: "lab" },
  { name: "Lab B", building: "Science Wing", floor: "1", capacity: 20, room_type: "lab" },
  { name: "Lab C", building: "Science Wing", floor: "2", capacity: 18, room_type: "lab" },
  { name: "Art Studio", building: "Arts Building", floor: "1", capacity: 22, room_type: "art_studio" },
  { name: "Computer Lab", building: "Tech Center", floor: "2", capacity: 28, room_type: "computer_lab" },
  { name: "Lecture Hall", building: "Main Building", floor: "3", capacity: 60, room_type: "auditorium" },
];

const SAMPLE_CONSTRAINTS = [
  { name: "No Teacher Double Booking", description: "Teachers cannot be in two places simultaneously", type: "hard", category: "teacher", rule: { type: "no_overlap" }, source: "system" },
  { name: "No Student Double Booking", description: "Students cannot be in two classes simultaneously", type: "hard", category: "student", rule: { type: "no_overlap" }, source: "system" },
  { name: "Room Capacity Limit", description: "Teaching group size must not exceed room capacity", type: "hard", category: "room", rule: { type: "capacity_check" }, source: "system" },
  { name: "HL Minimum Hours", description: "HL subjects require minimum 6 hours per week", type: "hard", category: "ib_requirement", rule: { type: "min_hours", level: "HL", min: 6 }, source: "system" },
  { name: "Teacher Free Day Preference", description: "Prefer to give teachers their requested free day", type: "soft", category: "teacher", rule: { type: "free_day" }, weight: 0.7 },
  { name: "Minimize Student Gaps", description: "Reduce free periods between classes for students", type: "soft", category: "student", rule: { type: "gap_minimize" }, weight: 0.6 },
  { name: "Balanced Teacher Workload", description: "Distribute teaching hours evenly among staff", type: "soft", category: "teacher", rule: { type: "balance_workload" }, weight: 0.5 },
  { name: "Lab Room for Sciences", description: "Science subjects should be in laboratory rooms", type: "soft", category: "room", rule: { type: "room_type_match" }, weight: 0.8 },
];

export default function TestData() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();

  const generateData = async () => {
    setGenerating(true);
    setProgress(0);
    setStatus({ type: 'info', message: 'Starting data generation...' });

    try {
      // 1. Subjects
      setStatus({ type: 'info', message: 'Creating subjects...' });
      const subjects = await base44.entities.Subject.bulkCreate(SAMPLE_SUBJECTS);
      setProgress(20);

      // 2. Teachers
      setStatus({ type: 'info', message: 'Creating teachers...' });
      await base44.entities.Teacher.bulkCreate(SAMPLE_TEACHERS.map(t => ({
        ...t,
        subjects: [subjects[0]?.id, subjects[1]?.id].filter(Boolean) // Assign first 2 subjects
      })));
      setProgress(35);

      // 3. Students
      setStatus({ type: 'info', message: 'Creating students...' });
      await base44.entities.Student.bulkCreate([...SAMPLE_STUDENTS_DP1, ...SAMPLE_STUDENTS_DP2]);
      setProgress(50);

      // 4. Rooms
      setStatus({ type: 'info', message: 'Creating rooms...' });
      await base44.entities.Room.bulkCreate(SAMPLE_ROOMS);
      setProgress(65);

      // 5. Constraints
      setStatus({ type: 'info', message: 'Creating constraints...' });
      await base44.entities.Constraint.bulkCreate(SAMPLE_CONSTRAINTS);
      setProgress(80);

      // 6. Schedule Version
      setStatus({ type: 'info', message: 'Creating schedule version...' });
      await base44.entities.ScheduleVersion.create({
        name: "Fall 2024 Draft v1",
        status: "draft",
        academic_year: "2024-2025",
        term: "Fall"
      });
      setProgress(100);

      setStatus({ type: 'success', message: 'Sample data generated successfully!' });
      queryClient.invalidateQueries();
      
    } catch (error) {
      setStatus({ type: 'error', message: `Error: ${error.message}` });
    } finally {
      setGenerating(false);
    }
  };

  const clearData = async () => {
    if (!confirm('This will delete ALL data. Are you sure?')) return;
    
    setGenerating(true);
    setStatus({ type: 'info', message: 'Clearing all data...' });

    try {
      // Delete in reverse dependency order
      await base44.entities.ScheduleSlot.delete({});
      await base44.entities.ScheduleVersion.delete({});
      await base44.entities.TeachingGroup.delete({});
      await base44.entities.ConflictReport.delete({});
      await base44.entities.Constraint.delete({});
      await base44.entities.Student.delete({});
      await base44.entities.Teacher.delete({});
      await base44.entities.Room.delete({});
      await base44.entities.Subject.delete({});
      
      setStatus({ type: 'success', message: 'All data cleared!' });
      queryClient.invalidateQueries();
    } catch (error) {
      setStatus({ type: 'error', message: `Error: ${error.message}` });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Test Data Generator"
        description="Generate realistic sample data for testing and development"
      />

      {status.message && (
        <Alert className={
          status.type === 'success' ? 'border-emerald-200 bg-emerald-50' :
          status.type === 'error' ? 'border-rose-200 bg-rose-50' :
          'border-blue-200 bg-blue-50'
        }>
          {status.type === 'success' ? <CheckCircle className="h-4 w-4 text-emerald-600" /> :
           status.type === 'error' ? <AlertCircle className="h-4 w-4 text-rose-600" /> :
           <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
          <AlertTitle>
            {status.type === 'success' ? 'Success' :
             status.type === 'error' ? 'Error' : 'Processing'}
          </AlertTitle>
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}

      {generating && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-slate-500 mt-2">{progress}% complete</p>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-emerald-600" />
              Generate Sample Data
            </CardTitle>
            <CardDescription>
              Create a complete realistic dataset for testing IB Schedule features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DatasetPreview 
              icon={BookOpen}
              label="Subjects"
              count={SAMPLE_SUBJECTS.length}
              description="IB subjects across all 6 groups + TOK"
            />
            <DatasetPreview 
              icon={Users}
              label="Teachers"
              count={SAMPLE_TEACHERS.length}
              description="Staff with varying preferences and availability"
            />
            <DatasetPreview 
              icon={GraduationCap}
              label="Students"
              count={SAMPLE_STUDENTS_DP1.length + SAMPLE_STUDENTS_DP2.length}
              description="DP1 and DP2 students with subject choices"
            />
            <DatasetPreview 
              icon={Building2}
              label="Rooms"
              count={SAMPLE_ROOMS.length}
              description="Classrooms, labs, and special spaces"
            />
            <DatasetPreview 
              icon={Database}
              label="Constraints"
              count={SAMPLE_CONSTRAINTS.length}
              description="Hard and soft scheduling rules"
            />
            <DatasetPreview 
              icon={Calendar}
              label="Schedule Version"
              count={1}
              description="Draft schedule ready for generation"
            />

            <Button 
              onClick={generateData} 
              disabled={generating}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Generate Sample Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm border-rose-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-700">
              <Trash2 className="w-5 h-5" />
              Clear All Data
            </CardTitle>
            <CardDescription>
              Remove all entities from the database (cannot be undone)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-rose-200 bg-rose-50">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                This action will permanently delete all:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Subjects, Teachers, Students, Rooms</li>
                  <li>Teaching Groups and Assignments</li>
                  <li>Schedule Versions and Time Slots</li>
                  <li>Constraints and AI Logs</li>
                  <li>Conflict Reports and Audit Trails</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Button 
              onClick={clearData}
              disabled={generating}
              variant="destructive"
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Test Scenarios</CardTitle>
          <CardDescription>Pre-configured scenarios for testing specific features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ScenarioCard 
            title="Complex HL/SL Mix"
            description="Students with 3-4 HL subjects and various SL combinations"
            features={["Subject group validation", "Workload balancing", "Room allocation"]}
          />
          <ScenarioCard 
            title="Teacher Conflicts"
            description="Overlapping availability and preference conflicts"
            features={["Constraint violation detection", "AI suggestions", "What-if scenarios"]}
          />
          <ScenarioCard 
            title="Room Capacity Stress"
            description="Limited lab spaces with high demand"
            features={["Hard constraint enforcement", "Conflict reporting", "Alternative suggestions"]}
          />
          <ScenarioCard 
            title="Optimization Testing"
            description="Large dataset to test algorithm performance"
            features={["Scalability", "Execution time", "Quality metrics"]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function DatasetPreview({ icon: Icon, label, count, description }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
      <Icon className="w-5 h-5 text-slate-600 mt-0.5" />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-slate-900">{label}</span>
          <Badge variant="outline">{count}</Badge>
        </div>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function ScenarioCard({ title, description, features }) {
  return (
    <div className="p-4 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer">
      <h4 className="font-semibold text-slate-900 mb-1">{title}</h4>
      <p className="text-sm text-slate-600 mb-2">{description}</p>
      <div className="flex flex-wrap gap-1">
        {features.map((feature, i) => (
          <Badge key={i} variant="secondary" className="text-xs">
            {feature}
          </Badge>
        ))}
      </div>
    </div>
  );
}