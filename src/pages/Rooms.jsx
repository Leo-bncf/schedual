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
    progress: '',
    roomsCreated: 0,
    error: null
  });
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



  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    // Get fresh schoolId at the moment of upload
    const currentSchoolId = user?.school_id;
    
    if (!currentSchoolId) {
      alert('No school assigned. Please set up your school in Settings first.');
      return;
    }

    console.log('Starting upload with school_id:', currentSchoolId);

    setUploadState({
      isUploading: true,
      progress: 'Uploading file...',
      roomsCreated: 0,
      error: null
    });

    try {
      // Upload file
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      console.log('File uploaded:', uploadResult);
      
      if (!uploadResult?.file_url) {
        throw new Error('File upload failed - no URL returned');
      }

      setUploadState(prev => ({ ...prev, progress: 'Extracting room data...' }));

      // Extract room data using LLM
      const extractionResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract all rooms from this document. For each room, provide: name, capacity (as number), room_type (one of: classroom, lab, art_studio, music_room, computer_lab, gymnasium, library, auditorium, other), building (if available), floor (if available).`,
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

      setUploadState(prev => ({ ...prev, progress: `Creating ${roomsData.length} rooms...` }));

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
        isUploading: false,
        progress: `Successfully created ${created} rooms!`
      }));

      setTimeout(() => {
        setUploadState({
          isUploading: false,
          progress: '',
          roomsCreated: 0,
          error: null
        });
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadState({
        isUploading: false,
        progress: '',
        roomsCreated: 0,
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
            <label htmlFor="room-upload">
              <input
                type="file"
                id="room-upload"
                className="hidden"
                onChange={handleFileUpload}
                accept=".csv,.xlsx,.xls,.pdf,.txt,.doc,.docx"
              />
              <Button 
                type="button"
                variant="outline"
                onClick={() => document.getElementById('room-upload').click()}
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
            </label>
            <Button onClick={() => setIsDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Room
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Total Rooms</p>
            <p className="text-2xl font-semibold text-slate-900">{rooms.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Total Capacity</p>
            <p className="text-2xl font-semibold text-slate-900">{totalCapacity}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Laboratories</p>
            <p className="text-2xl font-semibold text-slate-900">{labCount}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Avg. Capacity</p>
            <p className="text-2xl font-semibold text-slate-900">
              {rooms.length > 0 ? Math.round(totalCapacity / rooms.length) : 0}
            </p>
          </CardContent>
        </Card>
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
          {filteredRooms.map(room => {
            const typeInfo = getRoomTypeInfo(room.room_type);
            const Icon = typeInfo.icon;
            
            return (
              <Card key={room.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${typeInfo.color} flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{room.name}</p>
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
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">Capacity: {room.capacity}</span>
                    </div>
                    <Badge className={`border-0 ${typeInfo.color} bg-opacity-20 text-slate-700`}>
                      {typeInfo.label}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
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


    </div>
  );
}