import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CONSTRAINT_TEMPLATES = {
  teacher_qualification: {
    name: "Teacher Qualification Match",
    description: "Teachers must be qualified for the subject and IB level they teach",
    category: "teacher",
    type: "hard",
    rule: { type: "qualification_check" }
  },
  teacher_free_day: {
    name: "Teacher Free Day",
    description: "Ensure teacher has a specified day free from teaching",
    category: "teacher",
    type: "soft",
    rule: { type: "free_day", day: "Wednesday" }
  },
  no_consecutive_doubles: {
    name: "No Consecutive Double Periods",
    description: "Prevent scheduling consecutive double periods for same teacher",
    category: "teacher",
    type: "soft",
    rule: { type: "consecutive_limit", period_type: "double", max: 2 }
  },
  morning_preference: {
    name: "Morning Teaching Preference",
    description: "Prioritize scheduling teacher in morning periods",
    category: "teacher",
    type: "soft",
    rule: { type: "time_preference", period_range: [1, 4] }
  },
  room_subject_match: {
    name: "Subject-Specific Room",
    description: "Ensure subject is taught in appropriate room type",
    category: "room",
    type: "hard",
    rule: { type: "room_type_match" }
  },
  student_gap_minimize: {
    name: "Minimize Student Gaps",
    description: "Reduce free periods between classes for students",
    category: "student",
    type: "soft",
    rule: { type: "gap_minimize", max_gaps: 2 }
  },
  hl_sufficient_hours: {
    name: "HL Sufficient Hours",
    description: "Ensure HL subjects meet minimum weekly hours",
    category: "ib_requirement",
    type: "hard",
    rule: { type: "minimum_hours", level: "HL", min: 6 }
  }
};

export default function ConstraintBuilder({ onSubmit, initialData }) {
  const [mode, setMode] = useState('template');
  const [formData, setFormData] = useState(initialData || {
    name: '',
    description: '',
    type: 'soft',
    category: 'teacher',
    rule: {},
    weight: 0.7,
    is_active: true
  });

  const handleTemplateSelect = (templateKey) => {
    const template = CONSTRAINT_TEMPLATES[templateKey];
    setFormData({
      ...formData,
      ...template,
      name: template.name,
      description: template.description
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs value={mode} onValueChange={setMode}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="template">From Template</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(CONSTRAINT_TEMPLATES).map(([key, template]) => (
              <Card 
                key={key}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  formData.name === template.name ? 'ring-2 ring-indigo-500' : ''
                }`}
                onClick={() => handleTemplateSelect(key)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{template.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      {template.category}
                    </Badge>
                    <Badge 
                      className={template.type === 'hard' 
                        ? 'bg-rose-100 text-rose-700 border-0 text-xs' 
                        : 'bg-amber-100 text-amber-700 border-0 text-xs'
                      }
                    >
                      {template.type}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Constraint Name *</Label>
            <Input 
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., No Friday afternoon classes"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this constraint does..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hard">Hard (Must satisfy)</SelectItem>
                  <SelectItem value="soft">Soft (Preferred)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="room">Room</SelectItem>
                  <SelectItem value="subject">Subject</SelectItem>
                  <SelectItem value="time">Time</SelectItem>
                  <SelectItem value="ib_requirement">IB Requirement</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.type === 'soft' && (
            <div className="space-y-2">
              <Label>Weight ({((formData.weight || 0.7) * 100).toFixed(0)}%)</Label>
              <Slider
                value={[formData.weight || 0.7]}
                onValueChange={(value) => setFormData({ ...formData, weight: value[0] })}
                min={0}
                max={1}
                step={0.1}
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                Higher weight = more important to satisfy
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {formData.name && (
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
          <h4 className="font-medium text-slate-900 mb-2">Preview</h4>
          <div className="space-y-1 text-sm">
            <p><span className="text-slate-500">Name:</span> {formData.name}</p>
            <p><span className="text-slate-500">Type:</span> {formData.type}</p>
            <p><span className="text-slate-500">Category:</span> {formData.category}</p>
            {formData.type === 'soft' && (
              <p><span className="text-slate-500">Weight:</span> {((formData.weight || 0.7) * 100).toFixed(0)}%</p>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
          {initialData ? 'Update Constraint' : 'Create Constraint'}
        </Button>
      </div>
    </form>
  );
}