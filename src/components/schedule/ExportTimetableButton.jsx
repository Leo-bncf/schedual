import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export default function ExportTimetableButton({ type, entityId, scheduleVersionId, label = 'Export PDF' }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    if (!entityId || !scheduleVersionId) return;

    setIsLoading(true);
    try {
      const payload = {
        type,
        schedule_version_id: scheduleVersionId,
        ...(type === 'student' ? { student_id: entityId } : { teacher_id: entityId }),
      };
      const response = await base44.functions.invoke('exportTimetablePdf', payload);
      const data = response?.data || {};
      if (!data?.base64) {
        throw new Error(data?.error || 'PDF export failed');
      }
      const blob = base64ToBlob(data.base64, data.mimeType || 'application/pdf');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename || `${type}-timetable.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={isLoading || !entityId || !scheduleVersionId}>
      {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
      {isLoading ? 'Exporting...' : label}
    </Button>
  );
}