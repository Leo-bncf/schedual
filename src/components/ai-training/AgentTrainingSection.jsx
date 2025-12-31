import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Loader2, CheckCircle, XCircle, Edit, Save, Brain, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function AgentTrainingSection({ agentName, agentTitle, agentDescription }) {
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [fieldValue, setFieldValue] = useState('');
  const queryClient = useQueryClient();

  const { data: trainingData = [] } = useQuery({
    queryKey: ['aiTraining', agentName],
    queryFn: async () => {
      const data = await base44.entities.AITrainingData.filter({ agent_name: agentName }, '-created_date', 50);
      return data;
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Extract data based on agent type
      let extractionPrompt = '';
      let schema = {};
      
      if (agentName === 'student_importer') {
        extractionPrompt = `Extract all students from this document. For each student provide: full_name, email, student_id, ib_programme (PYP/MYP/DP), year_group, and subjects (with levels for DP).`;
        schema = {
          type: "object",
          properties: {
            students: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  full_name: { type: "string" },
                  email: { type: "string" },
                  student_id: { type: "string" },
                  ib_programme: { type: "string" },
                  year_group: { type: "string" },
                  subjects: { type: "array" }
                }
              }
            }
          }
        };
      } else if (agentName === 'teacher_importer') {
        extractionPrompt = `Extract all teachers from this document. For each teacher provide: full_name, email, employee_id, subjects they teach, and ib_levels they're qualified for.`;
        schema = {
          type: "object",
          properties: {
            teachers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  full_name: { type: "string" },
                  email: { type: "string" },
                  employee_id: { type: "string" },
                  subjects: { type: "array", items: { type: "string" } },
                  ib_levels: { type: "array", items: { type: "string" } }
                }
              }
            }
          }
        };
      } else if (agentName === 'room_importer') {
        extractionPrompt = `Extract all rooms from this document. For each room provide: name, building, capacity, room_type, and available equipment.`;
        schema = {
          type: "object",
          properties: {
            rooms: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  building: { type: "string" },
                  capacity: { type: "number" },
                  room_type: { type: "string" },
                  equipment: { type: "array", items: { type: "string" } }
                }
              }
            }
          }
        };
      } else if (agentName === 'subject_importer') {
        extractionPrompt = `Extract all subjects from this document. For each subject provide: name, code, ib_level, ib_group, and available_levels (HL/SL if DP).`;
        schema = {
          type: "object",
          properties: {
            subjects: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  code: { type: "string" },
                  ib_level: { type: "string" },
                  ib_group: { type: "string" },
                  available_levels: { type: "array", items: { type: "string" } }
                }
              }
            }
          }
        };
      }

      const extractedData = await base44.integrations.Core.InvokeLLM({
        prompt: extractionPrompt,
        file_urls: [file_url],
        response_json_schema: schema
      });

      // Store in training data
      return base44.entities.AITrainingData.create({
        agent_name: agentName,
        file_url,
        file_name: file.name,
        extracted_data: extractedData,
        field_feedback: {},
        overall_status: 'pending_review'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiTraining', agentName] });
      toast.success('Document uploaded and processed');
      setUploadingFile(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to process document');
      setUploadingFile(false);
    }
  });

  const updateFieldMutation = useMutation({
    mutationFn: async ({ trainingId, fieldPath, isCorrect, correctedValue, notes }) => {
      const training = trainingData.find(t => t.id === trainingId);
      const updatedFeedback = {
        ...training.field_feedback,
        [fieldPath]: {
          correct: isCorrect,
          corrected_value: correctedValue,
          notes: notes || ''
        }
      };

      return base44.entities.AITrainingData.update(trainingId, {
        field_feedback: updatedFeedback
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiTraining', agentName] });
      toast.success('Feedback saved');
      setEditingField(null);
    }
  });

  const approveMutation = useMutation({
    mutationFn: async ({ trainingId, status, notes }) => {
      const user = await base44.auth.me();
      return base44.entities.AITrainingData.update(trainingId, {
        overall_status: status,
        training_notes: notes,
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiTraining', agentName] });
      toast.success('Review completed');
      setSelectedTraining(null);
    }
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingFile(true);
    uploadMutation.mutate(file);
  };

  const renderFieldValue = (value) => {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const getEntityData = (training) => {
    if (!training?.extracted_data) return [];
    
    const data = training.extracted_data;
    if (agentName === 'student_importer') return data.students || [];
    if (agentName === 'teacher_importer') return data.teachers || [];
    if (agentName === 'room_importer') return data.rooms || [];
    if (agentName === 'subject_importer') return data.subjects || [];
    return [];
  };

  const stats = {
    total: trainingData.length,
    approved: trainingData.filter(t => t.overall_status === 'approved').length,
    pending: trainingData.filter(t => t.overall_status === 'pending_review').length
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle>{agentTitle}</CardTitle>
                <CardDescription>{agentDescription}</CardDescription>
              </div>
            </div>
            <label>
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploadingFile}
                accept=".pdf,.png,.jpg,.jpeg,.txt,.csv"
              />
              <Button disabled={uploadingFile} className="bg-blue-900 hover:bg-blue-800" asChild>
                <span>
                  {uploadingFile ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Training Doc
                    </>
                  )}
                </span>
              </Button>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">Total Training Data</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600 mb-1">Approved</p>
              <p className="text-2xl font-bold text-green-900">{stats.approved}</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              <p className="text-sm text-amber-600 mb-1">Pending Review</p>
              <p className="text-2xl font-bold text-amber-900">{stats.pending}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {trainingData.length === 0 ? (
        <Alert>
          <TrendingUp className="h-4 w-4" />
          <AlertDescription>
            No training data yet. Upload documents to start training this AI agent.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          {trainingData.map((training) => {
            const entities = getEntityData(training);
            const feedbackCount = Object.keys(training.field_feedback || {}).length;
            
            return (
              <Card key={training.id} className="overflow-hidden">
                <CardHeader className="bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{training.file_name}</CardTitle>
                      <CardDescription>
                        {entities.length} entries extracted • {feedbackCount} fields reviewed
                      </CardDescription>
                    </div>
                    <Badge className={
                      training.overall_status === 'approved' ? 'bg-green-100 text-green-700' :
                      training.overall_status === 'rejected' ? 'bg-red-100 text-red-700' :
                      training.overall_status === 'partially_approved' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }>
                      {training.overall_status.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedTraining(training)}
                    className="w-full"
                  >
                    Review Extraction ({entities.length} entries)
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Floating Islands Review Modal */}
      {selectedTraining && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-6xl my-8">
            <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6 sticky top-4 z-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {selectedTraining.file_name}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {getEntityData(selectedTraining).length} entries • Review each field
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => approveMutation.mutate({ trainingId: selectedTraining.id, status: 'approved', notes: 'All fields verified' })}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve All
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedTraining(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {getEntityData(selectedTraining).map((entity, entityIdx) => {
                const allFields = Object.entries(entity);
                const correctFields = allFields.filter(([field]) => {
                  const fieldPath = `${entityIdx}.${field}`;
                  const feedback = selectedTraining.field_feedback?.[fieldPath];
                  return feedback?.correct === true;
                }).length;
                
                return (
                  <Card key={entityIdx} className="bg-gradient-to-br from-white to-slate-50 border-2 border-slate-200 hover:border-blue-300 transition-all duration-200 shadow-lg hover:shadow-xl">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold text-slate-900">
                          Entry #{entityIdx + 1}
                        </CardTitle>
                        <Badge variant="outline" className="bg-white">
                          {correctFields}/{allFields.length} verified
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                      {allFields.map(([field, value]) => {
                        const fieldPath = `${entityIdx}.${field}`;
                        const feedback = selectedTraining.field_feedback?.[fieldPath];
                        const isEditing = editingField === fieldPath;
                        
                        return (
                          <div key={field} className="group relative">
                            <div className={`p-3 rounded-lg border-2 transition-all ${
                              feedback?.correct === true 
                                ? 'bg-green-50 border-green-200' 
                                : feedback?.correct === false 
                                ? 'bg-red-50 border-red-200' 
                                : 'bg-slate-50 border-slate-200 hover:border-blue-300'
                            }`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                                      {field.replace(/_/g, ' ')}
                                    </p>
                                    {feedback && (
                                      <Badge variant="outline" className={feedback.correct ? 'border-green-500 text-green-700 text-xs' : 'border-red-500 text-red-700 text-xs'}>
                                        {feedback.correct ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                                        {feedback.correct ? 'Correct' : 'Incorrect'}
                                      </Badge>
                                    )}
                                  </div>
                                  {isEditing ? (
                                    <Input
                                      value={fieldValue}
                                      onChange={(e) => setFieldValue(e.target.value)}
                                      className="mb-2"
                                      autoFocus
                                    />
                                  ) : (
                                    <p className="text-sm text-slate-900 font-medium break-words">
                                      {renderFieldValue(feedback?.corrected_value || value)}
                                    </p>
                                  )}
                                  {feedback?.notes && (
                                    <p className="text-xs text-slate-500 mt-1 italic">{feedback.notes}</p>
                                  )}
                                </div>
                                <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                  {isEditing ? (
                                    <Button
                                      size="sm"
                                      className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700"
                                      onClick={() => {
                                        updateFieldMutation.mutate({
                                          trainingId: selectedTraining.id,
                                          fieldPath,
                                          isCorrect: false,
                                          correctedValue: fieldValue,
                                          notes: 'Corrected by admin'
                                        });
                                      }}
                                    >
                                      <Save className="w-4 h-4" />
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700"
                                        onClick={() => {
                                          updateFieldMutation.mutate({
                                            trainingId: selectedTraining.id,
                                            fieldPath,
                                            isCorrect: true,
                                            correctedValue: value
                                          });
                                        }}
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        className="h-8 w-8 p-0 bg-red-600 hover:bg-red-700"
                                        onClick={() => {
                                          setEditingField(fieldPath);
                                          setFieldValue(renderFieldValue(value));
                                        }}
                                      >
                                        <XCircle className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}