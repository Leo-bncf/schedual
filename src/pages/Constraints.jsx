import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Search, Shield, Star, Filter } from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import ConstraintCard from '../components/constraints/ConstraintCard';
import ConstraintBuilder from '../components/constraints/ConstraintBuilder';
import EmptyState from '../components/ui-custom/EmptyState';

export default function Constraints() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const queryClient = useQueryClient();

  const { data: constraints = [], isLoading } = useQuery({
    queryKey: ['constraints'],
    queryFn: () => base44.entities.Constraint.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Constraint.create({ ...data, source: 'admin' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['constraints'] });
      setIsDialogOpen(false);
      setEditingConstraint(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Constraint.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['constraints'] });
      setIsDialogOpen(false);
      setEditingConstraint(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Constraint.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['constraints'] }),
  });

  const handleEdit = (constraint) => {
    setEditingConstraint(constraint);
    setIsDialogOpen(true);
  };

  const handleToggle = async (constraint) => {
    await updateMutation.mutateAsync({
      id: constraint.id,
      data: { is_active: !constraint.is_active }
    });
  };

  const handleWeightChange = async (constraint, weight) => {
    await updateMutation.mutateAsync({
      id: constraint.id,
      data: { weight }
    });
  };

  const handleSubmit = (data) => {
    if (editingConstraint) {
      updateMutation.mutate({ id: editingConstraint.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredConstraints = constraints.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter;
    return matchesSearch && matchesType && matchesCategory;
  });

  const hardConstraints = filteredConstraints.filter(c => c.type === 'hard');
  const softConstraints = filteredConstraints.filter(c => c.type === 'soft');

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Constraints"
        description="Manage scheduling rules and preferences"
        actions={
          <Button onClick={() => setIsDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Constraint
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search constraints..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs value={typeFilter} onValueChange={setTypeFilter}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="all">
            All ({constraints.length})
          </TabsTrigger>
          <TabsTrigger value="hard" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Hard ({hardConstraints.length})
          </TabsTrigger>
          <TabsTrigger value="soft" className="flex items-center gap-2">
            <Star className="w-4 h-4" />
            Soft ({softConstraints.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6 mt-6">
          {hardConstraints.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Hard Constraints ({hardConstraints.length})
              </h3>
              <div className="grid gap-4">
                {hardConstraints.map(constraint => (
                  <ConstraintCard 
                    key={constraint.id}
                    constraint={constraint}
                    onEdit={handleEdit}
                    onDelete={(c) => deleteMutation.mutate(c.id)}
                    onToggle={handleToggle}
                    onWeightChange={handleWeightChange}
                  />
                ))}
              </div>
            </div>
          )}

          {softConstraints.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Star className="w-4 h-4" />
                Soft Constraints ({softConstraints.length})
              </h3>
              <div className="grid gap-4">
                {softConstraints.map(constraint => (
                  <ConstraintCard 
                    key={constraint.id}
                    constraint={constraint}
                    onEdit={handleEdit}
                    onDelete={(c) => deleteMutation.mutate(c.id)}
                    onToggle={handleToggle}
                    onWeightChange={handleWeightChange}
                  />
                ))}
              </div>
            </div>
          )}

          {filteredConstraints.length === 0 && !isLoading && (
            <EmptyState 
              icon={Filter}
              title="No constraints found"
              description="Create constraints to control schedule generation."
              action={() => setIsDialogOpen(true)}
              actionLabel="Add Constraint"
            />
          )}
        </TabsContent>

        <TabsContent value="hard" className="mt-6">
          <div className="grid gap-4">
            {hardConstraints.map(constraint => (
              <ConstraintCard 
                key={constraint.id}
                constraint={constraint}
                onEdit={handleEdit}
                onDelete={(c) => deleteMutation.mutate(c.id)}
                onToggle={handleToggle}
                onWeightChange={handleWeightChange}
              />
            ))}
          </div>
          {hardConstraints.length === 0 && !isLoading && (
            <EmptyState 
              icon={Shield}
              title="No hard constraints"
              description="Hard constraints are strictly enforced during scheduling."
            />
          )}
        </TabsContent>

        <TabsContent value="soft" className="mt-6">
          <div className="grid gap-4">
            {softConstraints.map(constraint => (
              <ConstraintCard 
                key={constraint.id}
                constraint={constraint}
                onEdit={handleEdit}
                onDelete={(c) => deleteMutation.mutate(c.id)}
                onToggle={handleToggle}
                onWeightChange={handleWeightChange}
              />
            ))}
          </div>
          {softConstraints.length === 0 && !isLoading && (
            <EmptyState 
              icon={Star}
              title="No soft constraints"
              description="Soft constraints are preferences that the optimizer tries to satisfy."
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsDialogOpen(false);
          setEditingConstraint(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConstraint ? 'Edit Constraint' : 'Create New Constraint'}
            </DialogTitle>
            <DialogDescription>
              {editingConstraint 
                ? 'Modify the constraint details and settings.' 
                : 'Define a scheduling rule or preference using templates or custom settings.'
              }
            </DialogDescription>
          </DialogHeader>
          <ConstraintBuilder 
            onSubmit={handleSubmit}
            initialData={editingConstraint}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}