import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Pencil, Trash2, Plus, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = Array.from({ length: 8 }, (_, i) => i + 1);

export default function ManualSlotEditor({ scheduleVersionId, isOpen, onClose }) {
  const [slots, setSlots] = useState([]);
  const [editingSlot, setEditingSlot] = useState(null);
  const [formData, setFormData] = useState({});
  const [groups, setGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [conflicts, setConflicts] = useState([]);

  React.useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [slotData, groupData, teacherData, roomData] = await Promise.all([
        base44.entities.ScheduleSlot.filter({ schedule_version: scheduleVersionId }),
        base44.entities.TeachingGroup.list(),
        base44.entities.Teacher.list(),
        base44.entities.Room.list()
      ]);
      setSlots(slotData);
      setGroups(groupData);
      setTeachers(teacherData);
      setRooms(roomData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleEditSlot = (slot) => {
    setEditingSlot(slot.id);
    setFormData({ ...slot });
  };

  const handleDeleteSlot = async (slotId) => {
    if (!confirm('Delete this slot?')) return;
    try {
      await base44.entities.ScheduleSlot.delete(slotId);
      setSlots(slots.filter(s => s.id !== slotId));
    } catch (error) {
      alert('Delete failed: ' + error.message);
    }
  };

  const handleSaveSlot = async () => {
    setIsSaving(true);
    try {
      if (editingSlot) {
        await base44.entities.ScheduleSlot.update(editingSlot, formData);
      } else {
        await base44.entities.ScheduleSlot.create({
          ...formData,
          schedule_version: scheduleVersionId
        });
      }
      setEditingSlot(null);
      setFormData({});
      await loadData();
      await checkConflicts();
    } catch (error) {
      alert('Save failed: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const checkConflicts = async () => {
    try {
      const result = await base44.functions.invoke('checkScheduleConflicts', {
        schedule_version_id: scheduleVersionId
      });
      setConflicts(result.data.conflicts || []);
    } catch (error) {
      console.error('Conflict check error:', error);
    }
  };

  const slotsByDay = useMemo(() => {
    const grouped = {};
    DAYS.forEach(day => {
      grouped[day] = slots.filter(s => s.day === day);
    });
    return grouped;
  }, [slots]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Manual Schedule Editor
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Conflicts Alert */}
          {conflicts.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                {conflicts.length} conflict(s) detected in current schedule
              </AlertDescription>
            </Alert>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-slate-600">Total Slots</p>
                <p className="text-2xl font-bold">{slots.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-slate-600">Conflicts</p>
                <p className={`text-2xl font-bold ${conflicts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {conflicts.length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-slate-600">Groups Scheduled</p>
                <p className="text-2xl font-bold">{new Set(slots.map(s => s.teaching_group_id)).size}</p>
              </CardContent>
            </Card>
          </div>

          {/* Day-by-Day View */}
          <div className="space-y-3">
            <h3 className="font-semibold">Schedule by Day</h3>
            {DAYS.map(day => (
              <div key={day} className="border rounded-lg p-3">
                <h4 className="font-medium mb-2">{day}</h4>
                {slotsByDay[day].length === 0 ? (
                  <p className="text-sm text-slate-500">No slots scheduled</p>
                ) : (
                  <div className="space-y-2">
                    {slotsByDay[day].map(slot => {
                      const group = groups.find(g => g.id === slot.teaching_group_id);
                      const teacher = teachers.find(t => t.id === slot.teacher_id);
                      return (
                        <div key={slot.id} className="flex items-center justify-between bg-slate-50 p-2 rounded text-sm">
                          <div className="flex-1">
                            <p className="font-medium">{group?.name}</p>
                            <p className="text-xs text-slate-600">
                              Period {slot.period} • {teacher?.full_name}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditSlot(slot)}
                              className="h-8 w-8"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteSlot(slot.id)}
                              className="h-8 w-8 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Edit Form */}
          {editingSlot && (
            <Card className="border-blue-300 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-base">Edit Slot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Group</Label>
                  <Select 
                    value={formData.teaching_group_id || ''} 
                    onValueChange={(v) => setFormData({...formData, teaching_group_id: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Day</Label>
                    <Select 
                      value={formData.day || ''} 
                      onValueChange={(v) => setFormData({...formData, day: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Period</Label>
                    <Select 
                      value={String(formData.period) || ''} 
                      onValueChange={(v) => setFormData({...formData, period: parseInt(v)})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERIODS.map(p => (
                          <SelectItem key={p} value={String(p)}>Period {p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Room</Label>
                  <Select 
                    value={formData.room_id || ''} 
                    onValueChange={(v) => setFormData({...formData, room_id: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name} (Cap: {r.capacity})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleSaveSlot} 
                    disabled={isSaving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Save
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setEditingSlot(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Close
          </Button>
          <Button className="flex-1 bg-slate-900 hover:bg-slate-800">
            Save & Validate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}