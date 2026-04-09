import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function ExportTimetableButton({ type, entityId, scheduleVersionId, label = 'Export PDF' }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    if (!entityId || !scheduleVersionId) return;

    setIsLoading(true);
    try {
      const targetId = type === 'student' ? 'student-viewer-timetable' : 'teacher-viewer-timetable';
      const element = document.getElementById(targetId);
      if (!element) {
        throw new Error('Timetable not found');
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        logging: false,
        useCORS: true,
        backgroundColor: '#ffffff',
        removeContainer: true,
        imageTimeout: 0,
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const maxWidth = pdfWidth - (margin * 2);
      const maxHeight = pdfHeight - (margin * 2);
      const scale = Math.min(maxWidth / (canvas.width * 0.264583), maxHeight / (canvas.height * 0.264583));
      const scaledWidth = (canvas.width * 0.264583) * scale;
      const scaledHeight = (canvas.height * 0.264583) * scale;
      const x = (pdfWidth - scaledWidth) / 2;
      const y = (pdfHeight - scaledHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight, undefined, 'FAST');
      pdf.save(`${type}-timetable.pdf`);
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