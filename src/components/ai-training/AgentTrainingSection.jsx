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
import UploadProgressDialog from '../upload/UploadProgressDialog';

export default function AgentTrainingSection({ agentName, agentTitle, agentDescription }) {
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadStage, setUploadStage] = useState('uploading');
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [fieldValue, setFieldValue] = useState('');
  const queryClient = useQueryClient();

  const { data: trainingData = [] } = useQuery({
    queryKey: ['aiTraining', agentName],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('aiTrainingUpload', { 
        action: 'list', 
        agent_name: agentName 
      });
      return data?.data || [];
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      setUploadStage('uploading');
      setUploadProgress('Uploading document...');
      
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      setUploadStage('extracting');
      setUploadProgress('Extracting data with AI...');
      
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

      setUploadStage('storing');
      setUploadProgress('Saving training data...');

      // Store in training data via backend function
      const { data } = await base44.functions.invoke('aiTrainingUpload', {
        action: 'upload',
        agent_name: agentName,
        file_url,
        file_name: file.name,
        extracted_data: extractedData
      });
      
      setUploadStage('complete');
      setUploadProgress('Complete!');
      
      return data?.training;
    },
    onSuccess: (newTraining) => {
      queryClient.invalidateQueries({ queryKey: ['aiTraining', agentName] });
      toast.success('Document uploaded and processed');
      
      // Auto-open the newly uploaded training for review
      setTimeout(() => {
        setUploadingFile(false);
        setSelectedTraining(newTraining);
      }, 1500);
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to process document');
      setUploadStage('uploading');
      setUploadProgress('');
      setUploadingFile(false);
    }
  });

  const updateFieldMutation = useMutation({
    mutationFn: async ({ trainingId, fieldPath, isCorrect, correctedValue, notes }) => {
      return base44.functions.invoke('aiTrainingUpload', {
        action: 'updateField',
        training_id: trainingId,
        field_path: fieldPath,
        is_correct: isCorrect,
        corrected_value: correctedValue,
        notes: notes || ''
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
      return base44.functions.invoke('aiTrainingUpload', {
        action: 'approve',
        training_id: trainingId,
        status,
        notes
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
                  {selectedTraining?.id === training.id ? (
                    <div className="space-y-4">
                      {entities.map((entity, entityIdx) => (
                        <Card key={entityIdx} className="border-slate-200">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">
                              Entry #{entityIdx + 1}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {Object.entries(entity).map(([field, value]) => {
                              const fieldPath = `${entityIdx}.${field}`;
                              const feedback = training.field_feedback?.[fieldPath];
                              const isEditing = editingField === fieldPath;
                              
                              return (
                                <div key={field} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="text-xs font-medium text-slate-700">{field}</p>
                                      {feedback && (
                                        <Badge variant="outline" className={feedback.correct ? 'border-green-500 text-green-700' : 'border-red-500 text-red-700'}>
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
                                      />
                                    ) : (
                                      <p className="text-sm text-slate-900">{renderFieldValue(feedback?.corrected_value || value)}</p>
                                    )}
                                    {feedback?.notes && (
                                      <p className="text-xs text-slate-500 mt-1">{feedback.notes}</p>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    {isEditing ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          updateFieldMutation.mutate({
                                            trainingId: training.id,
                                            fieldPath,
                                            isCorrect: false,
                                            correctedValue: fieldValue,
                                            notes: 'Corrected by admin'
                                          });
                                        }}
                                      >
                                        <Save className="w-3 h-3" />
                                      </Button>
                                    ) : (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="text-green-600 hover:text-green-700"
                                          onClick={() => {
                                            updateFieldMutation.mutate({
                                              trainingId: training.id,
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
                                          variant="ghost"
                                          className="text-red-600 hover:text-red-700"
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
                              );
                            })}
                          </CardContent>
                        </Card>
                      ))}
                      
                      <div className="flex gap-2 pt-4 border-t">
                        <Button
                          onClick={() => approveMutation.mutate({ trainingId: training.id, status: 'approved', notes: 'All fields verified' })}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve All
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => approveMutation.mutate({ trainingId: training.id, status: 'partially_approved', notes: 'Some corrections made' })}
                        >
                          Save as Partially Approved
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setSelectedTraining(null)}
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setSelectedTraining(training)}
                      className="w-full"
                    >
                      Review Extraction ({entities.length} entries)
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <UploadProgressDialog 
        open={uploadingFile}
        stage={uploadStage}
        progress={uploadProgress}
        entityType="Training Data"
      />
    </div>
  );
}