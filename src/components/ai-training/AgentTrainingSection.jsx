import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Loader2, CheckCircle, XCircle, Edit, Save, Brain, TrendingUp, Pencil } from 'lucide-react';
import UploadProgressDialog from '../upload/UploadProgressDialog';
import TrainingChat from './TrainingChat';

export default function AgentTrainingSection({ agentName, agentTitle, agentDescription }) {
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadStage, setUploadStage] = useState('uploading');
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [fieldValue, setFieldValue] = useState('');
  const [fieldFeedback, setFieldFeedback] = useState({});
  const [fieldNotes, setFieldNotes] = useState({});
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [currentFileUrl, setCurrentFileUrl] = useState(null);
  const [currentFileName, setCurrentFileName] = useState(null);
  const [currentEntry, setCurrentEntry] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalEntries, setTotalEntries] = useState(0);
  const [allNames, setAllNames] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [useTextMode, setUseTextMode] = useState(false);
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

  const extractNextEntry = async () => {
    if (!currentFileUrl || !allNames[currentIndex]) {
      return;
    }

    setExtracting(true);
    try {
      const name = allNames[currentIndex];
      
      let extractionPrompt = '';
      let schema = {};
      
      if (agentName === 'student_importer') {
        extractionPrompt = `Extract ONLY the student named "${name}" from this document. 

For each field, provide:
1. The extracted value
2. A confidence score (0.0-1.0) indicating how certain you are
3. The exact text snippet from the document that supports this extraction

Provide: full_name, email, student_id, ib_programme (PYP/MYP/DP), year_group, and subjects (with levels for DP).`;
        schema = {
          type: "object",
          properties: {
            full_name: { type: "object", properties: { value: { type: "string" }, confidence: { type: "number" }, context: { type: "string" } } },
            email: { type: "object", properties: { value: { type: "string" }, confidence: { type: "number" }, context: { type: "string" } } },
            student_id: { type: "object", properties: { value: { type: "string" }, confidence: { type: "number" }, context: { type: "string" } } },
            ib_programme: { type: "object", properties: { value: { type: "string" }, confidence: { type: "number" }, context: { type: "string" } } },
            year_group: { type: "object", properties: { value: { type: "string" }, confidence: { type: "number" }, context: { type: "string" } } },
            subjects: { type: "object", properties: { value: { type: "array", items: { type: "string" } }, confidence: { type: "number" }, context: { type: "string" } } }
          }
        };
      } else if (agentName === 'teacher_importer') {
        extractionPrompt = `Extract ONLY the teacher named "${name}" from this document.

For each field, provide the value, confidence (0.0-1.0), and document context snippet.

Provide: full_name, email, employee_id, subjects they teach, and ib_levels they're qualified for.`;
        schema = {
          type: "object",
          properties: {
            full_name: { type: "object", properties: { value: { type: "string" }, confidence: { type: "number" }, context: { type: "string" } } },
            email: { type: "object", properties: { value: { type: "string" }, confidence: { type: "number" }, context: { type: "string" } } },
            employee_id: { type: "object", properties: { value: { type: "string" }, confidence: { type: "number" }, context: { type: "string" } } },
            subjects: { type: "object", properties: { value: { type: "array", items: { type: "string" } }, confidence: { type: "number" }, context: { type: "string" } } },
            ib_levels: { type: "object", properties: { value: { type: "array", items: { type: "string" } }, confidence: { type: "number" }, context: { type: "string" } } }
          }
        };
      } else if (agentName === 'room_importer') {
        extractionPrompt = `Extract ONLY the room named "${name}" from this document.

For each field, provide the value, confidence (0.0-1.0), and document context snippet.

Provide: name, building, capacity, room_type, and available equipment.`;
        schema = {
          type: "object",
          properties: {
            name: { type: "object", properties: { value: { type: "string" }, confidence: { type: "number" }, context: { type: "string" } } },
            building: { type: "object", properties: { value: { type: "string" }, confidence: { type: "number" }, context: { type: "string" } } },
            capacity: { type: "object", properties: { value: { type: "number" }, confidence: { type: "number" }, context: { type: "string" } } },
            room_type: { type: "object", properties: { value: { type: "string" }, confidence: { type: "number" }, context: { type: "string" } } },
            equipment: { type: "object", properties: { value: { type: "array", items: { type: "string" } }, confidence: { type: "number" }, context: { type: "string" } } }
          }
        };
      } else if (agentName === 'subject_importer') {
        extractionPrompt = `Extract ONLY the subject named "${name}" from this document.

For each field, provide the value, confidence (0.0-1.0), and document context snippet.

Provide: name, code, ib_level, ib_group, and available_levels (HL/SL if DP).`;
        schema = {
          type: "object",
          properties: {
            name: { type: "object", properties: { value: { type: "string" }, confidence: { type: "number" }, context: { type: "string" } } },
            code: { type: "object", properties: { value: { type: "string" }, confidence: { type: "number" }, context: { type: "string" } } },
            ib_level: { type: "object", properties: { value: { type: "string" }, confidence: { type: "number" }, context: { type: "string" } } },
            ib_group: { type: "object", properties: { value: { type: "string" }, confidence: { type: "number" }, context: { type: "string" } } },
            available_levels: { type: "object", properties: { value: { type: "array", items: { type: "string" } }, confidence: { type: "number" }, context: { type: "string" } } }
          }
        };
      }

      const extractedData = await base44.integrations.Core.InvokeLLM({
        prompt: extractionPrompt,
        file_urls: [currentFileUrl],
        response_json_schema: schema
      });

      setCurrentEntry(extractedData);
    } catch (error) {
      console.error('Extraction error:', error);
      toast.error('Failed to extract data');
    } finally {
      setExtracting(false);
    }
  };

  const handleApproveEntry = async () => {
    // Build corrected data from field feedback
    const correctedData = {};
    const trainingFeedback = {};
    
    Object.entries(currentEntry).forEach(([field, data]) => {
      const feedback = fieldFeedback[field];
      if (feedback === 'correct' || feedback === undefined) {
        // Use original value
        correctedData[field] = data.value;
        trainingFeedback[field] = {
          original: data.value,
          corrected: data.value,
          was_correct: true,
          confidence: data.confidence,
          context: data.context
        };
      } else if (feedback === 'incorrect') {
        // Use corrected value
        correctedData[field] = fieldValue;
        trainingFeedback[field] = {
          original: data.value,
          corrected: fieldValue,
          was_correct: false,
          confidence: data.confidence,
          context: data.context,
          notes: fieldNotes[field] || ''
        };
      }
    });
    
    // Save to training data
    try {
      await base44.functions.invoke('aiTrainingUpload', {
        action: 'upload',
        agent_name: agentName,
        file_url: currentFileUrl,
        file_name: `${currentFileName} - Entry ${currentIndex + 1}`,
        extracted_data: correctedData,
        training_feedback: trainingFeedback
      });

      toast.success('Training data saved');
      
      // Reset and move to next
      setFieldFeedback({});
      setFieldNotes({});
      
      if (currentIndex < totalEntries - 1) {
        setCurrentIndex(currentIndex + 1);
        setCurrentEntry(null);
      } else {
        // Done
        toast.success('All entries processed!');
        setInteractiveMode(false);
        setCurrentFileUrl(null);
        setCurrentFileName(null);
        setCurrentEntry(null);
        setCurrentIndex(0);
        setTotalEntries(0);
        setAllNames([]);
        queryClient.invalidateQueries({ queryKey: ['aiTraining', agentName] });
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save');
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async (input) => {
      let file_url = null;
      
      if (typeof input === 'string') {
        // Text input mode
        setUploadStage('uploading');
        setUploadProgress('Processing text...');
        
        // Create a text blob and upload it
        const blob = new Blob([input], { type: 'text/plain' });
        const textFile = new File([blob], 'text-input.txt', { type: 'text/plain' });
        const uploadResult = await base44.integrations.Core.UploadFile({ file: textFile });
        file_url = uploadResult.file_url;
      } else {
        // File upload mode
        setUploadStage('uploading');
        setUploadProgress('Uploading document...');
        const uploadResult = await base44.integrations.Core.UploadFile({ file: input });
        file_url = uploadResult.file_url;
      }
      
      setUploadStage('extracting');
      setUploadProgress('Finding all entries...');
      
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

      // Get list of all names/entries
      let listPrompt = '';
      let listSchema = {};
      
      if (agentName === 'student_importer') {
        listPrompt = 'List ALL student names in this document. Return only the names, nothing else.';
      } else if (agentName === 'teacher_importer') {
        listPrompt = 'List ALL teacher names in this document. Return only the names, nothing else.';
      } else if (agentName === 'room_importer') {
        listPrompt = 'List ALL room names/numbers in this document. Return only the names, nothing else.';
      } else if (agentName === 'subject_importer') {
        listPrompt = 'List ALL subject names in this document. Return only the names, nothing else.';
      }
      
      listSchema = {
        type: "object",
        properties: {
          names: { type: "array", items: { type: "string" } }
        }
      };

      const listResult = await base44.integrations.Core.InvokeLLM({
        prompt: listPrompt,
        file_urls: [file_url],
        response_json_schema: listSchema
      });

      const names = listResult?.names || [];
      
      if (names.length === 0) {
        throw new Error('No entries found in document');
      }
      
      setUploadStage('complete');
      setUploadProgress(`Found ${names.length} entries. Starting interactive review...`);
      
      // Start interactive mode
      setCurrentFileUrl(file_url);
      setCurrentFileName(typeof input === 'string' ? 'text-input.txt' : input.name);
      setAllNames(names);
      setTotalEntries(names.length);
      setCurrentIndex(0);
      setInteractiveMode(true);
      
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiTraining', agentName] });
      
      setTimeout(() => {
        setUploadingFile(false);
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
    setUseTextMode(false);
    uploadMutation.mutate(file);
  };

  const handleTextUpload = async () => {
    if (!textInput.trim()) {
      toast.error('Please enter some text');
      return;
    }
    
    setUploadingFile(true);
    setUseTextMode(false);
    uploadMutation.mutate(textInput);
    setTextInput('');
  };

  // Extract current entry when it changes
  React.useEffect(() => {
    if (interactiveMode && currentFileUrl && allNames.length > 0 && !currentEntry && !extracting) {
      extractNextEntry();
    }
  }, [currentIndex, interactiveMode, currentFileUrl, allNames, currentEntry, extracting]);

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
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => setUseTextMode(!useTextMode)}
                disabled={uploadingFile}
              >
                {useTextMode ? 'Upload Doc' : 'Paste Text'}
              </Button>
              {!useTextMode && (
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
                          Upload Doc
                        </>
                      )}
                    </span>
                  </Button>
                </label>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {useTextMode && (
            <div className="mb-4 space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Label htmlFor="textInput" className="text-sm font-medium">
                Paste training data text
              </Label>
              <Textarea
                id="textInput"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Paste student/teacher/room/subject data here..."
                rows={6}
                className="font-mono text-sm"
              />
              <Button 
                onClick={handleTextUpload}
                disabled={uploadingFile || !textInput.trim()}
                className="w-full bg-blue-900 hover:bg-blue-800"
              >
                {uploadingFile ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Process Text
                  </>
                )}
              </Button>
            </div>
          )}
          
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

      {interactiveMode && (
        <Card className="border-2 border-blue-500">
          <CardHeader className="bg-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Interactive Training Mode</CardTitle>
                <CardDescription>
                  Review and approve each entry - Entry {currentIndex + 1} of {totalEntries}
                </CardDescription>
              </div>
              <Badge className="bg-blue-600 text-white">
                {Math.round((currentIndex / totalEntries) * 100)}% Complete
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {extracting ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-3 text-slate-600">Extracting data...</span>
              </div>
            ) : currentEntry ? (
              <div className="space-y-4">
                {Object.entries(currentEntry).map(([field, data]) => {
                  const value = data.value;
                  const confidence = data.confidence || 0;
                  const context = data.context || '';
                  const feedback = fieldFeedback[field];
                  const isEditing = editingField === field;
                  
                  const confidenceColor = confidence > 0.8 ? 'text-green-600' : confidence > 0.5 ? 'text-amber-600' : 'text-red-600';
                  const confidenceBg = confidence > 0.8 ? 'bg-green-50' : confidence > 0.5 ? 'bg-amber-50' : 'bg-red-50';
                  
                  return (
                    <div key={field} className={`p-4 rounded-lg border-2 ${
                      feedback === 'correct' ? 'border-green-500 bg-green-50' : 
                      feedback === 'incorrect' ? 'border-red-500 bg-red-50' : 
                      'border-slate-200 bg-slate-50'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-semibold text-slate-700">
                          {field}
                        </Label>
                        <Badge className={`${confidenceBg} ${confidenceColor} border-0`}>
                          {Math.round(confidence * 100)}% confidence
                        </Badge>
                      </div>
                      
                      {context && (
                        <div className="mb-3 p-2 bg-white rounded text-xs text-slate-600 border border-slate-200">
                          <span className="font-semibold">Document: </span>
                          "{context}"
                        </div>
                      )}
                      
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            value={fieldValue}
                            onChange={(e) => setFieldValue(e.target.value)}
                            className="mb-2"
                            autoFocus
                          />
                          <Textarea
                            placeholder="Why was this incorrect? (optional note for AI learning)"
                            value={fieldNotes[field] || ''}
                            onChange={(e) => setFieldNotes({ ...fieldNotes, [field]: e.target.value })}
                            className="text-xs"
                            rows={2}
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              setFieldFeedback({ ...fieldFeedback, [field]: 'incorrect' });
                              setEditingField(null);
                            }}
                            className="w-full"
                          >
                            Save Correction
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="text-slate-900 mb-3">
                            {Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </p>
                          
                          {feedback === 'incorrect' && fieldNotes[field] && (
                            <div className="mb-2 p-2 bg-amber-50 rounded text-xs text-amber-800 border border-amber-200">
                              <span className="font-semibold">Note: </span>
                              {fieldNotes[field]}
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            {feedback !== 'correct' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 border-green-500 text-green-700 hover:bg-green-50"
                                onClick={() => setFieldFeedback({ ...fieldFeedback, [field]: 'correct' })}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Correct
                              </Button>
                            )}
                            {feedback !== 'incorrect' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 border-red-500 text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  setEditingField(field);
                                  setFieldValue(Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value));
                                }}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Incorrect
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={handleApproveEntry}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    disabled={Object.keys(fieldFeedback).length === 0}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Save & Next Entry
                  </Button>
                  <Button
                    onClick={() => {
                      setInteractiveMode(false);
                      setCurrentFileUrl(null);
                      setCurrentEntry(null);
                      setFieldFeedback({});
                      setFieldNotes({});
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                Loading next entry...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <TrainingChat agentName={agentName} agentTitle={agentTitle} />

      <UploadProgressDialog 
        open={uploadingFile}
        stage={uploadStage}
        progress={uploadProgress}
        entityType="Training Data"
      />
    </div>
  );
}