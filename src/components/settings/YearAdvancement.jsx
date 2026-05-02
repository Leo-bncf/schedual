import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { GraduationCap, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function YearAdvancement() {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });
  const schoolId = user?.school_id;

  const { data: students = [] } = useQuery({
    queryKey: ['students', schoolId],
    queryFn: () => base44.entities.Student.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const advanceYearMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('advanceStudentsYear');
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classGroups'] });
      queryClient.invalidateQueries({ queryKey: ['teachingGroups'] });
      toast.success(`✅ ${data.message}`);
      setConfirmDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to advance students');
    }
  });

  const yearCounts = {
    DP1: students.filter(s => s.year_group === 'DP1').length,
    DP2: students.filter(s => s.year_group === 'DP2').length,
    MYP1: students.filter(s => s.year_group === 'MYP1').length,
    MYP2: students.filter(s => s.year_group === 'MYP2').length,
    MYP3: students.filter(s => s.year_group === 'MYP3').length,
    MYP4: students.filter(s => s.year_group === 'MYP4').length,
    MYP5: students.filter(s => s.year_group === 'MYP5').length,
    'PYP-A': students.filter(s => s.year_group === 'PYP-A').length,
    'PYP-B': students.filter(s => s.year_group === 'PYP-B').length,
    'PYP-C': students.filter(s => s.year_group === 'PYP-C').length,
    'PYP-D': students.filter(s => s.year_group === 'PYP-D').length,
    'PYP-E': students.filter(s => s.year_group === 'PYP-E').length,
    'PYP-F': students.filter(s => s.year_group === 'PYP-F').length,
  };

  return (
    <>
      <Card className="border-0 shadow-sm rounded-3xl">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Year Advancement</CardTitle>
              <CardDescription>Move all students to the next academic year</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(yearCounts).filter(([_, count]) => count > 0).map(([year, count]) => (
              <div key={year} className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-2xl font-bold text-slate-900">{count}</div>
                <div className="text-xs text-slate-500">{year}</div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">⚠️ Important</p>
                <ul className="space-y-1 list-disc list-inside text-xs">
                  <li>All students move to next year (DP1→DP2, MYP1→MYP2, etc.)</li>
                  <li>DP2 students will be marked as graduated (inactive)</li>
                  <li>MYP5 students move to DP1 (programme changes)</li>
                  <li>PYP-F students move to MYP1 (programme changes)</li>
                  <li>Subject choices reset when changing programmes</li>
                  <li><strong>This cannot be undone!</strong></li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            onClick={() => setConfirmDialogOpen(true)}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-medium"
            disabled={students.length === 0}
          >
            <GraduationCap className="w-5 h-5 mr-2" />
            Advance All Students to Next Year
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Year Advancement</DialogTitle>
            <DialogDescription>
              This will move all {students.length} students to the next academic year. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <p className="text-sm font-semibold text-blue-900 mb-2">What will happen:</p>
              <div className="space-y-1 text-xs text-blue-800">
                {yearCounts.DP1 > 0 && <p>• {yearCounts.DP1} DP1 → DP2</p>}
                {yearCounts.DP2 > 0 && <p>• {yearCounts.DP2} DP2 → Graduated</p>}
                {yearCounts.MYP5 > 0 && <p>• {yearCounts.MYP5} MYP5 → DP1</p>}
                {Object.entries(yearCounts)
                  .filter(([year, count]) => count > 0 && !['DP1', 'DP2', 'MYP5'].includes(year))
                  .map(([year, count]) => (
                    <p key={year}>• {count} {year} → {year.includes('MYP') ? `MYP${parseInt(year.slice(-1)) + 1}` : year.includes('PYP') ? `PYP-${String.fromCharCode(year.charCodeAt(4) + 1)}` : ''}</p>
                  ))
                }
              </div>
            </div>

            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-rose-800">
                  <strong>Warning:</strong> After advancing years, you'll need to regenerate schedules and reassign teaching groups.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setConfirmDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => advanceYearMutation.mutate()}
              disabled={advanceYearMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 rounded-xl"
            >
              {advanceYearMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Advancing...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Confirm Advancement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}