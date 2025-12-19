import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, Key, Link as LinkIcon, Zap, Shield, GitBranch, Copy, CheckCircle } from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';

const SCHEMA_SQL = `-- IB Schedule Database Schema
-- PostgreSQL with multi-tenancy support

-- ============================================
-- CORE TABLES
-- ============================================

CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    ib_school_code VARCHAR(50),
    address TEXT,
    timezone VARCHAR(100) DEFAULT 'UTC',
    academic_year VARCHAR(20),
    periods_per_day INTEGER DEFAULT 8,
    period_duration_minutes INTEGER DEFAULT 45,
    days_per_week INTEGER DEFAULT 5,
    school_start_time TIME DEFAULT '08:00',
    settings JSONB DEFAULT '{}',
    created_date TIMESTAMP DEFAULT NOW(),
    updated_date TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_schools_code ON schools(code);
CREATE INDEX idx_schools_academic_year ON schools(academic_year);

-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user', -- 'admin', 'teacher', 'student', 'user'
    teacher_profile_id UUID,
    student_profile_id UUID,
    preferences JSONB DEFAULT '{}',
    last_login TIMESTAMP,
    created_date TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE INDEX idx_users_school_id ON users(school_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================

CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    ib_group INTEGER CHECK (ib_group BETWEEN 1 AND 6),
    ib_group_name VARCHAR(100),
    available_levels TEXT[] DEFAULT ARRAY['HL', 'SL'],
    hl_hours_per_week INTEGER DEFAULT 6,
    sl_hours_per_week INTEGER DEFAULT 4,
    requires_lab BOOLEAN DEFAULT FALSE,
    requires_special_room VARCHAR(100),
    is_core BOOLEAN DEFAULT FALSE,
    color VARCHAR(7),
    is_active BOOLEAN DEFAULT TRUE,
    created_date TIMESTAMP DEFAULT NOW(),
    updated_date TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),
    CONSTRAINT unique_subject_code_per_school UNIQUE(school_id, code)
);

CREATE INDEX idx_subjects_school_id ON subjects(school_id);
CREATE INDEX idx_subjects_ib_group ON subjects(ib_group);
CREATE INDEX idx_subjects_is_active ON subjects(is_active);
CREATE INDEX idx_subjects_is_core ON subjects(is_core);

-- ============================================

CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    employee_id VARCHAR(100),
    subjects UUID[] DEFAULT ARRAY[]::UUID[], -- Array of subject IDs
    max_hours_per_week INTEGER DEFAULT 25,
    max_consecutive_periods INTEGER DEFAULT 4,
    preferred_free_day VARCHAR(20),
    unavailable_slots JSONB DEFAULT '[]',
    preferences JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_date TIMESTAMP DEFAULT NOW(),
    updated_date TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE INDEX idx_teachers_school_id ON teachers(school_id);
CREATE INDEX idx_teachers_user_id ON teachers(user_id);
CREATE INDEX idx_teachers_is_active ON teachers(is_active);
CREATE INDEX idx_teachers_subjects ON teachers USING GIN(subjects);

-- ============================================

CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    student_id VARCHAR(100),
    year_group VARCHAR(10) CHECK (year_group IN ('DP1', 'DP2')),
    subject_choices JSONB DEFAULT '[]',
    assigned_groups UUID[] DEFAULT ARRAY[]::UUID[],
    special_requirements TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_date TIMESTAMP DEFAULT NOW(),
    updated_date TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_students_year_group ON students(year_group);
CREATE INDEX idx_students_is_active ON students(is_active);

-- ============================================

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    building VARCHAR(100),
    floor VARCHAR(20),
    capacity INTEGER NOT NULL,
    room_type VARCHAR(50) DEFAULT 'classroom',
    equipment TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_date TIMESTAMP DEFAULT NOW(),
    updated_date TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE INDEX idx_rooms_school_id ON rooms(school_id);
CREATE INDEX idx_rooms_room_type ON rooms(room_type);
CREATE INDEX idx_rooms_is_active ON rooms(is_active);

-- ============================================
-- SCHEDULING TABLES
-- ============================================

CREATE TABLE teaching_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    level VARCHAR(10) CHECK (level IN ('HL', 'SL')),
    year_group VARCHAR(10) CHECK (year_group IN ('DP1', 'DP2')),
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    student_ids UUID[] DEFAULT ARRAY[]::UUID[],
    preferred_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    hours_per_week INTEGER,
    min_students INTEGER DEFAULT 3,
    max_students INTEGER DEFAULT 20,
    requires_double_periods BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_date TIMESTAMP DEFAULT NOW(),
    updated_date TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE INDEX idx_teaching_groups_school_id ON teaching_groups(school_id);
CREATE INDEX idx_teaching_groups_subject_id ON teaching_groups(subject_id);
CREATE INDEX idx_teaching_groups_teacher_id ON teaching_groups(teacher_id);
CREATE INDEX idx_teaching_groups_year_group ON teaching_groups(year_group);
CREATE INDEX idx_teaching_groups_level ON teaching_groups(level);

-- ============================================

CREATE TABLE schedule_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    academic_year VARCHAR(20),
    term VARCHAR(50),
    generation_params JSONB DEFAULT '{}',
    score NUMERIC(5,2),
    conflicts_count INTEGER DEFAULT 0,
    warnings_count INTEGER DEFAULT 0,
    generated_at TIMESTAMP,
    published_at TIMESTAMP,
    notes TEXT,
    created_date TIMESTAMP DEFAULT NOW(),
    updated_date TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE INDEX idx_schedule_versions_school_id ON schedule_versions(school_id);
CREATE INDEX idx_schedule_versions_status ON schedule_versions(status);
CREATE INDEX idx_schedule_versions_academic_year ON schedule_versions(academic_year);

-- ============================================

CREATE TABLE schedule_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    schedule_version VARCHAR(255) NOT NULL,
    teaching_group_id UUID NOT NULL REFERENCES teaching_groups(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    day VARCHAR(20) NOT NULL CHECK (day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')),
    period INTEGER NOT NULL CHECK (period BETWEEN 1 AND 12),
    is_double_period BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'tentative', 'cancelled')),
    notes TEXT,
    created_date TIMESTAMP DEFAULT NOW(),
    updated_date TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),
    CONSTRAINT unique_slot_time UNIQUE(school_id, schedule_version, day, period, room_id)
);

CREATE INDEX idx_schedule_slots_school_id ON schedule_slots(school_id);
CREATE INDEX idx_schedule_slots_version ON schedule_slots(schedule_version);
CREATE INDEX idx_schedule_slots_teaching_group ON schedule_slots(teaching_group_id);
CREATE INDEX idx_schedule_slots_room ON schedule_slots(room_id);
CREATE INDEX idx_schedule_slots_day_period ON schedule_slots(day, period);

-- ============================================
-- CONSTRAINT & OPTIMIZATION TABLES
-- ============================================

CREATE TABLE constraints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(10) CHECK (type IN ('hard', 'soft')),
    category VARCHAR(50),
    rule JSONB NOT NULL,
    weight NUMERIC(3,2) DEFAULT 1.0 CHECK (weight BETWEEN 0 AND 1),
    is_active BOOLEAN DEFAULT TRUE,
    source VARCHAR(50) DEFAULT 'admin' CHECK (source IN ('system', 'admin', 'ai_suggested')),
    created_date TIMESTAMP DEFAULT NOW(),
    updated_date TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE INDEX idx_constraints_school_id ON constraints(school_id);
CREATE INDEX idx_constraints_type ON constraints(type);
CREATE INDEX idx_constraints_category ON constraints(category);
CREATE INDEX idx_constraints_is_active ON constraints(is_active);

-- ============================================

CREATE TABLE conflict_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    schedule_version_id UUID NOT NULL REFERENCES schedule_versions(id) ON DELETE CASCADE,
    conflict_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'high' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    affected_entities JSONB,
    description TEXT NOT NULL,
    slot_references UUID[] DEFAULT ARRAY[]::UUID[],
    suggested_resolution TEXT,
    status VARCHAR(50) DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'acknowledged', 'resolved', 'ignored')),
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(255),
    created_date TIMESTAMP DEFAULT NOW(),
    updated_date TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conflict_reports_school_id ON conflict_reports(school_id);
CREATE INDEX idx_conflict_reports_version ON conflict_reports(schedule_version_id);
CREATE INDEX idx_conflict_reports_severity ON conflict_reports(severity);
CREATE INDEX idx_conflict_reports_status ON conflict_reports(status);

-- ============================================

CREATE TABLE optimization_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    schedule_version_id UUID NOT NULL REFERENCES schedule_versions(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    algorithm VARCHAR(50),
    parameters JSONB DEFAULT '{}',
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    iterations INTEGER,
    objective_score NUMERIC(5,2),
    hard_constraints_satisfied BOOLEAN DEFAULT FALSE,
    soft_constraint_score NUMERIC(5,2),
    conflicts_found INTEGER DEFAULT 0,
    warnings_found INTEGER DEFAULT 0,
    execution_log JSONB DEFAULT '[]',
    error_message TEXT,
    created_date TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_optimization_runs_school_id ON optimization_runs(school_id);
CREATE INDEX idx_optimization_runs_version ON optimization_runs(schedule_version_id);
CREATE INDEX idx_optimization_runs_status ON optimization_runs(status);

-- ============================================
-- AI & AUDIT TABLES
-- ============================================

CREATE TABLE ai_advisor_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    schedule_version_id UUID REFERENCES schedule_versions(id) ON DELETE CASCADE,
    agent_type VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    input_context JSONB,
    output JSONB,
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'success')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'applied', 'dismissed')),
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP,
    created_date TIMESTAMP DEFAULT NOW(),
    updated_date TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE INDEX idx_ai_advisor_logs_school_id ON ai_advisor_logs(school_id);
CREATE INDEX idx_ai_advisor_logs_version ON ai_advisor_logs(schedule_version_id);
CREATE INDEX idx_ai_advisor_logs_agent_type ON ai_advisor_logs(agent_type);
CREATE INDEX idx_ai_advisor_logs_status ON ai_advisor_logs(status);
CREATE INDEX idx_ai_advisor_logs_created ON ai_advisor_logs(created_date DESC);

-- ============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    changes JSONB,
    metadata JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_date TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_school_id ON audit_logs(school_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_date DESC);

-- ============================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ============================================

CREATE MATERIALIZED VIEW teacher_workload_summary AS
SELECT 
    t.id AS teacher_id,
    t.school_id,
    t.full_name,
    COUNT(DISTINCT tg.id) AS group_count,
    SUM(tg.hours_per_week) AS total_hours,
    ARRAY_AGG(DISTINCT s.name) AS subjects_taught
FROM teachers t
LEFT JOIN teaching_groups tg ON t.id = tg.teacher_id AND tg.is_active = TRUE
LEFT JOIN subjects s ON tg.subject_id = s.id
WHERE t.is_active = TRUE
GROUP BY t.id, t.school_id, t.full_name;

CREATE UNIQUE INDEX idx_teacher_workload_teacher ON teacher_workload_summary(teacher_id);

-- ============================================

CREATE MATERIALIZED VIEW schedule_quality_metrics AS
SELECT 
    sv.id AS schedule_version_id,
    sv.school_id,
    sv.name,
    sv.score,
    COUNT(DISTINCT ss.id) AS total_slots,
    COUNT(DISTINCT ss.teaching_group_id) AS groups_scheduled,
    COUNT(DISTINCT cr.id) FILTER (WHERE cr.severity = 'critical') AS critical_conflicts,
    COUNT(DISTINCT cr.id) FILTER (WHERE cr.severity = 'high') AS high_conflicts,
    COUNT(DISTINCT ai.id) FILTER (WHERE ai.status = 'pending') AS pending_suggestions
FROM schedule_versions sv
LEFT JOIN schedule_slots ss ON sv.id::text = ss.schedule_version
LEFT JOIN conflict_reports cr ON sv.id = cr.schedule_version_id
LEFT JOIN ai_advisor_logs ai ON sv.id = ai.schedule_version_id
GROUP BY sv.id, sv.school_id, sv.name, sv.score;

CREATE UNIQUE INDEX idx_schedule_quality_version ON schedule_quality_metrics(schedule_version_id);

-- ============================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_date = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_schools_updated BEFORE UPDATE ON schools
    FOR EACH ROW EXECUTE FUNCTION update_updated_date();

CREATE TRIGGER trg_subjects_updated BEFORE UPDATE ON subjects
    FOR EACH ROW EXECUTE FUNCTION update_updated_date();

CREATE TRIGGER trg_teachers_updated BEFORE UPDATE ON teachers
    FOR EACH ROW EXECUTE FUNCTION update_updated_date();

CREATE TRIGGER trg_students_updated BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_date();

CREATE TRIGGER trg_rooms_updated BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_date();

-- ============================================
-- ROW LEVEL SECURITY (Multi-tenancy)
-- ============================================

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE teaching_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_advisor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- School isolation policy (applied to all tables)
CREATE POLICY school_isolation_policy ON schools
    USING (id = current_setting('app.current_school_id')::UUID);

-- Similar policies would be created for all other tables
-- Example for subjects:
CREATE POLICY subjects_school_isolation ON subjects
    USING (school_id = current_setting('app.current_school_id')::UUID);`;

export default function DatabaseSchema() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(SCHEMA_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Database Schema"
        description="Complete PostgreSQL schema with indexes, constraints, and multi-tenancy"
        actions={
          <Button onClick={handleCopy} variant="outline">
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy Schema
              </>
            )}
          </Button>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Database className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-semibold text-slate-900">14</p>
                <p className="text-sm text-slate-500">Core Tables</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Key className="w-8 h-8 text-emerald-600" />
              <div>
                <p className="text-2xl font-semibold text-slate-900">45+</p>
                <p className="text-sm text-slate-500">Indexes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-8 h-8 text-violet-600" />
              <div>
                <p className="text-2xl font-semibold text-slate-900">RLS</p>
                <p className="text-sm text-slate-500">Multi-tenant Security</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
          <TabsTrigger value="indexes">Indexes</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="sql">Full SQL</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Schema Overview</CardTitle>
              <CardDescription>Organized table groups and their purposes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <TableGroup 
                title="Core Tables"
                icon={Database}
                color="bg-blue-500"
                tables={[
                  { name: "schools", description: "Top-level tenant isolation" },
                  { name: "users", description: "Authentication and role management" },
                  { name: "subjects", description: "IB curriculum subjects" },
                  { name: "teachers", description: "Teaching staff with preferences" },
                  { name: "students", description: "IB DP students with choices" },
                  { name: "rooms", description: "Physical teaching spaces" }
                ]}
              />

              <TableGroup 
                title="Scheduling Tables"
                icon={GitBranch}
                color="bg-emerald-500"
                tables={[
                  { name: "teaching_groups", description: "HL/SL class sections" },
                  { name: "schedule_versions", description: "Draft/published schedules" },
                  { name: "schedule_slots", description: "Individual time allocations" }
                ]}
              />

              <TableGroup 
                title="Constraint & Optimization"
                icon={Zap}
                color="bg-amber-500"
                tables={[
                  { name: "constraints", description: "Hard and soft rules" },
                  { name: "conflict_reports", description: "Detected violations" },
                  { name: "optimization_runs", description: "Algorithm execution logs" }
                ]}
              />

              <TableGroup 
                title="AI & Audit"
                icon={Shield}
                color="bg-violet-500"
                tables={[
                  { name: "ai_advisor_logs", description: "Agent suggestions" },
                  { name: "audit_logs", description: "System activity tracking" }
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relationships">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Foreign Key Relationships</CardTitle>
              <CardDescription>Data integrity through referential constraints</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RelationshipCard 
                from="All Tables"
                to="schools"
                type="Many-to-One"
                cascade="CASCADE"
                description="Every entity belongs to exactly one school for multi-tenancy"
              />
              
              <RelationshipCard 
                from="users"
                to="teachers/students"
                type="One-to-One"
                cascade="SET NULL"
                description="Users can have optional profile links for role-based access"
              />

              <RelationshipCard 
                from="teaching_groups"
                to="subjects"
                type="Many-to-One"
                cascade="CASCADE"
                description="Each group teaches one subject at specific level"
              />

              <RelationshipCard 
                from="teaching_groups"
                to="teachers"
                type="Many-to-One"
                cascade="SET NULL"
                description="Groups assigned to teachers (nullable for flexibility)"
              />

              <RelationshipCard 
                from="schedule_slots"
                to="teaching_groups"
                type="Many-to-One"
                cascade="CASCADE"
                description="Slots allocate groups to specific day/period/room"
              />

              <RelationshipCard 
                from="schedule_slots"
                to="rooms"
                type="Many-to-One"
                cascade="SET NULL"
                description="Rooms assigned to slots (nullable for TBD allocations)"
              />

              <RelationshipCard 
                from="conflict_reports"
                to="schedule_versions"
                type="Many-to-One"
                cascade="CASCADE"
                description="Conflicts detected for specific schedule versions"
              />

              <RelationshipCard 
                from="ai_advisor_logs"
                to="schedule_versions"
                type="Many-to-One"
                cascade="CASCADE"
                description="AI suggestions linked to schedule versions"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="indexes">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Performance Indexes</CardTitle>
              <CardDescription>Optimized query patterns for fast lookups</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <IndexGroup 
                title="Multi-tenancy Indexes"
                description="Critical for school isolation and performance"
                indexes={[
                  "idx_*_school_id ON all tables",
                  "idx_schools_code (UNIQUE)",
                  "idx_users_email (UNIQUE)",
                  "Composite: (school_id, code) for subjects"
                ]}
              />

              <IndexGroup 
                title="Foreign Key Indexes"
                description="Speed up JOIN operations"
                indexes={[
                  "idx_teachers_user_id",
                  "idx_students_user_id",
                  "idx_teaching_groups_subject_id",
                  "idx_teaching_groups_teacher_id",
                  "idx_schedule_slots_teaching_group"
                ]}
              />

              <IndexGroup 
                title="Query Optimization Indexes"
                description="Common filter and sort patterns"
                indexes={[
                  "idx_*_is_active (boolean filters)",
                  "idx_students_year_group",
                  "idx_subjects_ib_group",
                  "idx_schedule_slots_day_period (composite)",
                  "idx_audit_logs_created (DESC for recent first)"
                ]}
              />

              <IndexGroup 
                title="GIN Indexes"
                description="Array and JSONB search"
                indexes={[
                  "idx_teachers_subjects (GIN) - array containment",
                  "Future: JSONB indexes for constraint rules",
                  "Future: Full-text search on descriptions"
                ]}
              />

              <IndexGroup 
                title="Materialized Views"
                description="Pre-computed aggregations"
                indexes={[
                  "teacher_workload_summary",
                  "schedule_quality_metrics",
                  "Refresh: CONCURRENTLY for zero-downtime"
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Row Level Security (RLS)</CardTitle>
              <CardDescription>Multi-tenant data isolation at database level</CardDescription>
            </CardHeader>
            <CardContent className="prose prose-slate max-w-none">
              <h3>Multi-Tenancy Strategy</h3>
              <p>
                Every table includes <code>school_id</code> for strict tenant isolation. 
                PostgreSQL Row Level Security ensures users can only access data from their own school.
              </p>

              <h3>Security Implementation</h3>
              <div className="not-prose space-y-3 my-4">
                <SecurityFeature 
                  title="Session Variables"
                  description="SET app.current_school_id = 'xxx' on connection"
                />
                <SecurityFeature 
                  title="RLS Policies"
                  description="Automatic filtering: WHERE school_id = current_setting('app.current_school_id')"
                />
                <SecurityFeature 
                  title="CASCADE Deletes"
                  description="Deleting school removes all dependent data automatically"
                />
                <SecurityFeature 
                  title="SET NULL References"
                  description="Soft deletions for teachers/rooms preserve historical data"
                />
              </div>

              <h3>Access Control</h3>
              <ul>
                <li><strong>School Admin:</strong> Full CRUD within their school_id</li>
                <li><strong>Teacher:</strong> Read schedules, update own preferences</li>
                <li><strong>Student:</strong> Read-only access to own schedule</li>
                <li><strong>System:</strong> Cross-school analytics (super admin only)</li>
              </ul>

              <h3>Unique Constraints</h3>
              <ul>
                <li><code>UNIQUE(school_id, code)</code> - Subject codes unique per school</li>
                <li><code>UNIQUE(school_id, schedule_version, day, period, room_id)</code> - No room double-booking</li>
                <li><code>schools.code UNIQUE</code> - Global school identification</li>
              </ul>

              <h3>Check Constraints</h3>
              <ul>
                <li><code>ib_group BETWEEN 1 AND 6</code></li>
                <li><code>year_group IN ('DP1', 'DP2')</code></li>
                <li><code>level IN ('HL', 'SL')</code></li>
                <li><code>period BETWEEN 1 AND 12</code></li>
                <li><code>weight BETWEEN 0 AND 1</code></li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sql">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Complete SQL Schema</CardTitle>
              <CardDescription>Production-ready PostgreSQL implementation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 text-xs overflow-x-auto max-h-[600px] overflow-y-auto">
                  <code>{SCHEMA_SQL}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TableGroup({ title, icon: Icon, color, tables }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="pl-10 space-y-2">
        {tables.map((table, i) => (
          <div key={i} className="flex items-start gap-2">
            <code className="text-sm font-mono bg-slate-100 px-2 py-1 rounded text-slate-900 min-w-[160px]">
              {table.name}
            </code>
            <p className="text-sm text-slate-600">{table.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RelationshipCard({ from, to, type, cascade, description }) {
  return (
    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
      <div className="flex items-center gap-3 mb-2">
        <code className="text-sm font-mono bg-white px-2 py-1 rounded border border-slate-200">
          {from}
        </code>
        <LinkIcon className="w-4 h-4 text-slate-400" />
        <code className="text-sm font-mono bg-white px-2 py-1 rounded border border-slate-200">
          {to}
        </code>
        <Badge variant="outline" className="ml-auto">{type}</Badge>
      </div>
      <p className="text-sm text-slate-600 mb-1">{description}</p>
      <p className="text-xs text-slate-500">ON DELETE {cascade}</p>
    </div>
  );
}

function IndexGroup({ title, description, indexes }) {
  return (
    <div className="p-4 rounded-lg border border-slate-200">
      <h4 className="font-semibold text-slate-900 mb-1">{title}</h4>
      <p className="text-sm text-slate-600 mb-3">{description}</p>
      <ul className="space-y-1">
        {indexes.map((idx, i) => (
          <li key={i} className="text-sm font-mono text-slate-700 flex items-center gap-2">
            <Zap className="w-3 h-3 text-amber-500" />
            {idx}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SecurityFeature({ title, description }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
      <Shield className="w-5 h-5 text-violet-600 mt-0.5" />
      <div>
        <h4 className="font-semibold text-violet-900 text-sm">{title}</h4>
        <p className="text-sm text-violet-700">{description}</p>
      </div>
    </div>
  );
}