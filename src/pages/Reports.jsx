import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Users, Building2, BookOpen, AlertTriangle } from 'lucide-react';
import TeacherWorkloadReport from '../components/reports/TeacherWorkloadReport';
import RoomUtilizationReport from '../components/reports/RoomUtilizationReport';
import SubjectCoverageReport from '../components/reports/SubjectCoverageReport';
import BottleneckAnalysis from '../components/reports/BottleneckAnalysis';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('workload');
  const [selectedVersion, setSelectedVersion] = useState('');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: scheduleVersions = [] } = useQuery({
    queryKey: ['scheduleVersions', user?.school_id],
    queryFn: () => base44.entities.ScheduleVersion.filter({ 
      school_id: user?.school_id,
      status: { $in: ['published', 'draft'] }
    }),
    enabled: !!user?.school_id
  });

  const publishedVersion = scheduleVersions.find(v => v.status === 'published');
  const currentVersion = selectedVersion || publishedVersion?.id || scheduleVersions[0]?.id || '';

  const exportAllReports = async () => {
    // Export all reports as PDF
    alert('Export all reports (PDF generation coming soon)');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Schedule Reports</h1>
          <p className="text-gray-500 mt-1">Analyze schedule performance and identify optimization opportunities</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={currentVersion} onValueChange={setSelectedVersion}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select schedule version" />
            </SelectTrigger>
            <SelectContent>
              {scheduleVersions.map(v => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name} {v.status === 'published' && '(Published)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={exportAllReports} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export All
          </Button>
        </div>
      </div>

      {!currentVersion ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No schedule versions found. Generate a schedule first.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="workload" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Teacher Workload
            </TabsTrigger>
            <TabsTrigger value="rooms" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Room Utilization
            </TabsTrigger>
            <TabsTrigger value="subjects" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Subject Coverage
            </TabsTrigger>
            <TabsTrigger value="bottlenecks" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Bottlenecks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workload" className="mt-6">
            <TeacherWorkloadReport scheduleVersionId={currentVersion} schoolId={user?.school_id} />
          </TabsContent>

          <TabsContent value="rooms" className="mt-6">
            <RoomUtilizationReport scheduleVersionId={currentVersion} schoolId={user?.school_id} />
          </TabsContent>

          <TabsContent value="subjects" className="mt-6">
            <SubjectCoverageReport scheduleVersionId={currentVersion} schoolId={user?.school_id} />
          </TabsContent>

          <TabsContent value="bottlenecks" className="mt-6">
            <BottleneckAnalysis scheduleVersionId={currentVersion} schoolId={user?.school_id} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}