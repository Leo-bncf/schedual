import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle } from 'lucide-react';

export default function DragDropUploadDialog({ open, onOpenChange, onUpload, title, description }) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handlePaste = (e) => {
    const items = Array.from(e.clipboardData.items);
    const file = items
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter(Boolean)[0];
    
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile);
      setSelectedFile(null);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title || 'Import Document'}</DialogTitle>
          <DialogDescription>
            {description || 'Upload a document or paste to extract data'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onPaste={handlePaste}
            tabIndex={0}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer
              ${isDragging 
                ? 'border-indigo-500 bg-indigo-50' 
                : selectedFile
                ? 'border-green-500 bg-green-50'
                : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/50'
              }
            `}
          >
            <input
              type="file"
              id="file-input"
              className="hidden"
              onChange={handleFileSelect}
              accept=".csv,.xlsx,.xls,.pdf,.txt,.doc,.docx"
            />
            <label htmlFor="file-input" className="cursor-pointer">
              <div className="flex flex-col items-center gap-3">
                <div className={`p-4 rounded-full transition-all ${
                  isDragging ? 'bg-indigo-500 scale-110' : selectedFile ? 'bg-green-500' : 'bg-indigo-100'
                }`}>
                  {selectedFile ? (
                    <CheckCircle className="w-8 h-8 text-white" />
                  ) : (
                    <Upload className={`w-8 h-8 ${isDragging ? 'text-white' : 'text-indigo-600'}`} />
                  )}
                </div>
                {selectedFile ? (
                  <>
                    <p className="text-sm font-medium text-green-700">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      Click to change or drop a different file
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-slate-700">
                      {isDragging ? 'Drop your file here' : 'Drag & drop, paste, or click to browse'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Supports: PDF, Excel, Word, CSV, Text
                    </p>
                  </>
                )}
              </div>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload}
            disabled={!selectedFile}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload & Extract
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}