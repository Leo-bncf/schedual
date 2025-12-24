import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Trophy } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import PageHeader from '../components/ui-custom/PageHeader';

export default function DataImport() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUploadAndProcess = async () => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Step 1: Upload file
      const uploadResponse = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadResponse.file_url;

      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setTimeout(() => {
        setUploading(false);
        setProcessing(true);
      }, 500);

      // Step 2: Create conversation with agent
      const conv = await base44.agents.createConversation({
        agent_name: "data_importer",
        metadata: {
          name: `Import from ${file.name}`,
          description: "Automated data import"
        }
      });

      setConversation(conv);

      // Subscribe to updates
      base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages(data.messages);
      });

      // Step 3: Send message to agent with file
      await base44.agents.addMessage(conv, {
        role: "user",
        content: `Please process this uploaded school data file and create all necessary entities (subjects, rooms, teachers, students, and teaching groups). The file contains information about courses, classrooms, and their assignments. Extract all data and create the appropriate records in the system.`,
        file_urls: [fileUrl]
      });

    } catch (err) {
      console.error('Upload/process error:', err);
      setError(err.message || 'Failed to process file');
      setUploading(false);
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setConversation(null);
    setMessages([]);
    setError(null);
    setProcessing(false);
    setUploadProgress(0);
  };

  const assistantMessages = messages.filter(m => m.role === 'assistant');
  const isComplete = assistantMessages.length > 0 && 
    messages[messages.length - 1]?.role === 'assistant' &&
    !messages[messages.length - 1]?.tool_calls?.some(tc => tc.status === 'running' || tc.status === 'pending');

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Import School Data"
        description="Upload a file with course, classroom, and student information to automatically create all entities"
      />

      {/* Instructions */}
      <Card className="border-0 shadow-sm bg-blue-50">
        <CardContent className="p-6">
          <div className="flex gap-3">
            <FileText className="w-5 h-5 text-blue-900 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">File Format Guidelines</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Supported formats: CSV, Excel, PDF</li>
                <li>• Include: Subject names, teacher names, student names, room numbers</li>
                <li>• Optional: IB levels (HL/SL), subject groups, student IDs</li>
                <li>• The AI will automatically structure and create all entities</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Upload Data File</CardTitle>
          <CardDescription>Select a file containing your school's course and classroom data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!conversation ? (
            <>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-900 transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept=".csv,.xlsx,.xls,.pdf"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  {file ? (
                    <div>
                      <p className="text-sm font-medium text-slate-900 mb-1">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-slate-900 mb-1">Click to upload file</p>
                      <p className="text-xs text-slate-500">CSV, Excel, or PDF</p>
                    </div>
                  )}
                </label>
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Uploading file...</span>
                    <span className="font-medium text-blue-900">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleUploadAndProcess}
                disabled={!file || uploading || processing}
                className="w-full bg-blue-900 hover:bg-blue-800"
                size="lg"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload & Process File
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              {/* Processing Status */}
              <div className="space-y-4">
                {assistantMessages.map((msg, idx) => (
                  <Card key={idx} className="bg-slate-50">
                    <CardContent className="p-4">
                      <div className="prose prose-sm max-w-none">
                        <p className="text-slate-700 whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      
                      {msg.tool_calls && msg.tool_calls.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {msg.tool_calls.map((tc, tcIdx) => (
                            <div key={tcIdx} className="flex items-center gap-2 text-sm">
                              {tc.status === 'completed' ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                              )}
                              <span className="text-slate-600">
                                {tc.name.split('.').pop().replace(/_/g, ' ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {isComplete && (
                  <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <CardContent className="p-6 text-center">
                      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                        <Trophy className="w-8 h-8 text-green-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-green-900 mb-2">Import Complete!</h3>
                      <p className="text-green-700">
                        All entities have been successfully created from your file.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {isComplete && (
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="w-full"
                >
                  Import Another File
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}