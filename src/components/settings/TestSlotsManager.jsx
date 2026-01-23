import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardCheck, Plus, Trash2, User, Clock, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function TestSlotsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [formData, setFormData] = useState({
    test_level: 'DP1',
    tests_per_week: 1,
    test_duration_minutes: 90,
    supervisor_teacher_id: ''
  });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: testSubjects = [], isLoading } = useQuery({
    queryKey: ['testSubjects', user?.school_id],
    queryFn: async () => {
      const subjects = await base44.entities.Subject.filter({ 
        school_id: user.school_id,
        is_test_slot: true
      });
      return subjects;
    },
    enabled: !!user?.school_id,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', user?.school_id],
    queryFn: () => base44.entities.Teacher.filter({ 
      school_id: user.school_id,
      is_active: true
    }),
    enabled: !!user?.school_id,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Subject.create({
      ...data,
      school_id: user.school_id,
      name: `Test Assessment - ${data.test_level}`,
      code: `TEST_${data.test_level}`,
      ib_level: data.test_level.includes('DP') ? 'DP' : data.test_level,
      is_test_slot: true,
      is_active: true
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testSubjects'] });
      setIsDialogOpen(false);
      setEditingTest(null);
      toast.success('Test slot created successfully');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Subject.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testSubjects'] });
      setIsDialogOpen(false);
      setEditingTest(null);
      toast.success('Test slot updated successfully');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Subject.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testSubjects'] });
      toast.success('Test slot deleted successfully');
    },
  });

  const handleSubmit = () => {
    if (editingTest) {
      updateMutation.mutate({ id: editingTest.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (test) => {
    setEditingTest(test);
    setFormData({
      test_level: test.test_level,
      tests_per_week: test.tests_per_week,
      test_duration_minutes: test.test_duration_minutes,
      supervisor_teacher_id: test.supervisor_teacher_id || ''
    });
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingTest(null);
    setFormData({
      test_level: 'DP1',
      tests_per_week: 1,
      test_duration_minutes: 90,
      supervisor_teacher_id: ''
    });
    setIsDialogOpen(true);
  };

  return (
    <>
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <ClipboardCheck className="w-5 h-5 text-purple-700" />
              </div>
              <div>
                <CardTitle className="text-lg">Test Assessment Slots</CardTitle>
                <CardDescription>Schedule dedicated test periods for each level</CardDescription>
              </div>
            </div>
            <Button onClick={handleAdd} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Test Slot
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-slate-500">Loading test slots...</p>
            </div>
          ) : testSubjects.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardCheck className="w-16 h-16 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium mb-2">No test slots configured</p>
              <p className="text-sm text-slate-400 mb-4">Add test assessment periods for your students</p>
              <Button onClick={handleAdd} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Create First Test Slot
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {testSubjects.map((test) => {
                const supervisor = teachers.find(t => t.id === test.supervisor_teacher_id);
                return (
                  <Card key={test.id} className="border-2 border-purple-200 hover:border-purple-400 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-slate-900">{test.name}</h4>
                          <Badge className="bg-purple-100 text-purple-700 mt-1">
                            {test.test_level}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => {
                            if (confirm('Delete this test slot?')) {
                              deleteMutation.mutate(test.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="w-4 h-4" />
                          <span>{test.tests_per_week} test{test.tests_per_week > 1 ? 's' : ''} per week</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Clock className="w-4 h-4" />
                          <span>{test.test_duration_minutes} minutes each</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <User className="w-4 h-4" />
                          <span>{supervisor ? supervisor.full_name : 'No supervisor assigned'}</span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-3"
                        onClick={() => handleEdit(test)}
                      >
                        Edit Configuration
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTest ? 'Edit Test Slot' : 'Add Test Slot'}</DialogTitle>
            <DialogDescription>
              Configure test assessment periods for a specific level
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Level</Label>
              <Select 
                value={formData.test_level} 
                onValueChange={(value) => setFormData({ ...formData, test_level: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PYP">PYP</SelectItem>
                  <SelectItem value="MYP">MYP</SelectItem>
                  <SelectItem value="DP1">DP1</SelectItem>
                  <SelectItem value="DP2">DP2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tests per Week</Label>
              <Input 
                type="number"
                min="0"
                max="5"
                value={formData.tests_per_week}
                onChange={(e) => setFormData({ ...formData, tests_per_week: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label>Test Duration (minutes)</Label>
              <Input 
                type="number"
                min="0"
                step="15"
                value={formData.test_duration_minutes}
                onChange={(e) => setFormData({ ...formData, test_duration_minutes: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label>Supervisor Teacher (Optional)</Label>
              <Select 
                value={formData.supervisor_teacher_id} 
                onValueChange={(value) => setFormData({ ...formData, supervisor_teacher_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a teacher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>No supervisor</SelectItem>
                  {teachers.map(teacher => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingTest ? 'Update' : 'Create'} Test Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}