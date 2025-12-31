import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Building2, Users, MoreHorizontal, Pencil, Trash2, FlaskConical, Palette, Monitor, Music, BookOpen, Dumbbell, Upload, Loader2, CheckCircle, X, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PageHeader from '../components/ui-custom/PageHeader';
import EmptyState from '../components/ui-custom/EmptyState';
import UploadProgressDialog from '../components/upload/UploadProgressDialog';
import DragDropUploadDialog from '../components/upload/DragDropUploadDialog';

const ROOM_TYPES = [
  { value: 'classroom', label: 'Classroom', icon: BookOpen, color: 'bg-blue-500' },
  { value: 'lab', label: 'Laboratory', icon: FlaskConical, color: 'bg-violet-500' },
  { value: 'art_studio', label: 'Art Studio', icon: Palette, color: 'bg-pink-500' },
  { value: 'music_room', label: 'Music Room', icon: Music, color: 'bg-amber-500' },
  { value: 'computer_lab', label: 'Computer Lab', icon: Monitor, color: 'bg-cyan-500' },
  { value: 'gymnasium', label: 'Gymnasium', icon: Dumbbell, color: 'bg-emerald-500' },
  { value: 'library', label: 'Library', icon: BookOpen, color: 'bg-rose-500' },
  { value: 'auditorium', label: 'Auditorium', icon: Users, color: 'bg-indigo-500' },
  { value: 'other', label: 'Other', icon: Building2, color: 'bg-slate-500' },
];

export default function Rooms() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [uploadState, setUploadState] = useState({
    isUploading: false,
    stage: 'uploading',
    progress: '',
    roomsCreated: 0,
    totalRooms: 0,
    error: null
  });
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    building: '',
    floor: '',
    capacity: 30,
    room_type: 'classroom',
    equipment: [],
    is_active: true
  });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const schoolId = user?.school_id;

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['rooms', schoolId],
    queryFn: () => base44.entities.Room.list(),
    enabled: !!schoolId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      if (!schoolId) throw new Error('No school assigned');
      return base44.entities.Room.create({ ...data, school_id: schoolId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Room.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Room.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      building: '',
      floor: '',
      capacity: 30,
      room_type: 'classroom',
      equipment: [],
      is_active: true
    });
    setEditingRoom(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (room) => {
    setEditingRoom(room);
    setFormData({
      name: room.name || '',
      building: room.building || '',
      floor: room.floor || '',
      capacity: room.capacity || 30,
      room_type: room.room_type || 'classroom',
      equipment: room.equipment || [],
      is_active: room.is_active !== false
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingRoom) {
      updateMutation.mutate({ id: editingRoom.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredRooms = rooms.filter(r => {
    const matchesSearch = r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.building?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || r.room_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getRoomTypeInfo = (type) => {
    return ROOM_TYPES.find(t => t.value === type) || ROOM_TYPES[ROOM_TYPES.length - 1];
  };

  const totalCapacity = rooms.reduce((sum, r) => sum + (r.capacity || 0), 0);
  const labCount = rooms.filter(r => r.room_type === 'lab').length;



  const handleFileUpload = async (file) => {
    if (!file) return;

    // Get fresh schoolId at the moment of upload
    const currentSchoolId = user?.school_id;
    
    if (!currentSchoolId) {
      alert('No school assigned. Please set up your school in Settings first.');
      return;
    }

    console.log('Starting upload with school_id:', currentSchoolId);

    setUploadState({
      isUploading: true,
      stage: 'uploading',
      progress: 'Uploading file...',
      roomsCreated: 0,
      totalRooms: 0,
      error: null
    });

    try {
      // Upload file
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      console.log('File uploaded:', uploadResult);
      
      if (!uploadResult?.file_url) {
        throw new Error('File upload failed - no URL returned');
      }

      setUploadState(prev => ({ ...prev, stage: 'extracting', progress: 'Extracting room data...' }));

      // Fetch training data to improve extraction
      const trainingData = await base44.entities.AITrainingData.filter({
        agent_name: 'room_importer',
        overall_status: 'approved'
      }).catch(() => []);

      const trainingFeedback = trainingData.slice(0, 3).map(t => {
        const corrections = Object.entries(t.field_feedback || {})
          .filter(([_, f]) => !f.correct && f.notes)
          .map(([field, f]) => `- ${field}: ${f.notes}`)
          .join('\n');
        return corrections;
      }).filter(Boolean).join('\n\n');

      // Extract room data using LLM
      const extractionResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract all rooms from this document. For each room, provide: name, capacity (as number), room_type (one of: classroom, lab, art_studio, music_room, computer_lab, gymnasium, library, auditorium, other), building (if available), floor (if available).

${trainingFeedback ? `LESSONS FROM ADMIN FEEDBACK:\n${trainingFeedback}\n\n` : ''}`,
        file_urls: [uploadResult.file_url],
        response_json_schema: {
          type: "object",
          properties: {
            rooms: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  capacity: { type: "number" },
                  room_type: { type: "string" },
                  building: { type: "string" },
                  floor: { type: "string" }
                },
                required: ["name", "capacity", "room_type"]
              }
            }
          }
        }
      });

      console.log('Extraction result:', extractionResult);

      const roomsData = extractionResult?.rooms || [];

      if (roomsData.length === 0) {
        throw new Error('No rooms found in the document');
      }

      setUploadState(prev => ({ ...prev, stage: 'creating', totalRooms: roomsData.length, progress: `Creating ${roomsData.length} rooms...` }));

      // Create rooms one by one
      let created = 0;
      for (const room of roomsData) {
        console.log('Creating room:', { ...room, school_id: currentSchoolId });
        
        await base44.entities.Room.create({
          school_id: currentSchoolId,
          name: room.name,
          capacity: room.capacity,
          room_type: room.room_type,
          building: room.building || '',
          floor: room.floor || '',
          equipment: [],
          is_active: true
        });
        
        created++;
        setUploadState(prev => ({ 
          ...prev, 
          roomsCreated: created,
          progress: `Created ${created} of ${roomsData.length} rooms...`
        }));
      }

      console.log(`Successfully created ${created} rooms`);

      setUploadState(prev => ({ 
        ...prev, 
        stage: 'complete',
        progress: `Successfully created ${created} rooms!`
      }));

      setTimeout(() => {
        setUploadState({
          isUploading: false,
          stage: 'uploading',
          progress: '',
          roomsCreated: 0,
          totalRooms: 0,
          error: null
        });
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadState({
        isUploading: false,
        stage: 'uploading',
        progress: '',
        roomsCreated: 0,
        totalRooms: 0,
        error: error?.message || 'An unknown error occurred'
      });
      alert('Failed to process file: ' + (error?.message || 'Unknown error'));
    }
  };



  return (
    <div className="space-y-6">
      <PageHeader 
        title="Rooms"
        description="Manage classrooms, labs, and other teaching spaces"
        actions={
          <div className="flex gap-2">
            <Button 
              type="button"
              variant="outline"
              onClick={() => setShowUploadDialog(true)}
              disabled={uploadState.isUploading || !schoolId}
            >
              {uploadState.isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {uploadState.progress || 'Processing...'}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Document
                </>
              )}
            </Button>
            <Button onClick={() => setIsDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Room
            </Button>
          </div>
        }
      />

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-amber-800">
          ⚠️ <strong>AI Import Notice:</strong> The AI document reader is a tool to speed up data entry but isn't perfect. Always verify all imported information for accuracy before using it in scheduling.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Rooms', value: rooms.length, color: 'from-blue-500 to-cyan-500' },
          { label: 'Total Capacity', value: totalCapacity, color: 'from-violet-500 to-purple-500' },
          { label: 'Laboratories', value: labCount, color: 'from-rose-500 to-pink-500' },
          { label: 'Avg. Capacity', value: rooms.length > 0 ? Math.round(totalCapacity / rooms.length) : 0, color: 'from-emerald-500 to-teal-500' }
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.05, y: -5 }}
          >
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white overflow-hidden">
              <CardContent className="p-4 relative">
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-5`} />
                <p className="text-sm font-medium text-slate-600">{stat.label}</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search rooms..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Room type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {ROOM_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredRooms.length === 0 && !isLoading ? (
        <EmptyState 
          icon={Building2}
          title="No rooms yet"
          description="Add rooms and their capacities for schedule generation."
          action={() => setIsDialogOpen(true)}
          actionLabel="Add Room"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRooms.map((room, index) => {
            const typeInfo = getRoomTypeInfo(room.room_type);
            const Icon = typeInfo.icon;
            
            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.03, y: -5 }}
              >
                <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group">
                  <div className={`h-1 bg-gradient-to-r ${typeInfo.color}`} />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 flex-1">
                        <motion.div 
                          className={`w-12 h-12 rounded-xl ${typeInfo.color} flex items-center justify-center shadow-md`}
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.6 }}
                        >
                          <Icon className="w-6 h-6 text-white" />
                        </motion.div>
                        <div>
                          <p className="font-bold text-slate-900 text-lg">{room.name}</p>
                          <p className="text-sm text-slate-500">
                            {room.building && `${room.building}`}
                            {room.floor && `, Floor ${room.floor}`}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(room)}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-rose-600" onClick={() => deleteMutation.mutate(room.id)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">Capacity: {room.capacity}</span>
                      </div>
                      <Badge className={`border-0 ${typeInfo.color} text-white shadow-sm`}>
                        {typeInfo.label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRoom ? 'Edit Room' : 'Add New Room'}</DialogTitle>
            <DialogDescription>
              {editingRoom ? 'Update room details.' : 'Enter the details for the new room.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Room Name *</Label>
                <Input 
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Room 101"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity *</Label>
                <Input 
                  id="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="building">Building</Label>
                <Input 
                  id="building"
                  value={formData.building}
                  onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                  placeholder="e.g., Main Building"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="floor">Floor</Label>
                <Input 
                  id="floor"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  placeholder="e.g., 1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="room_type">Room Type</Label>
              <Select 
                value={formData.room_type} 
                onValueChange={(value) => setFormData({ ...formData, room_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingRoom ? 'Save Changes' : 'Add Room'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <UploadProgressDialog 
        open={uploadState.isUploading}
        stage={uploadState.stage}
        progress={uploadState.progress}
        current={uploadState.roomsCreated}
        total={uploadState.totalRooms}
        entityType="Rooms"
      />

      <DragDropUploadDialog 
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUpload={(file) => {
          setShowUploadDialog(false);
          handleFileUpload(file);
        }}
        title="Import Rooms"
        description="Upload a document or paste to extract room data"
      />
    </div>
  );
}