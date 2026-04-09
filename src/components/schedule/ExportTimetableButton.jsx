import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import PdfExportSettingsModal from '@/components/schedule/PdfExportSettingsModal';
import { exportGridPdf, exportListPdf, exportSummaryPdf } from '@/components/schedule/pdfExportUtils';

export default function ExportTimetableButton({ type, entityId, scheduleVersionId, label = 'Export PDF', lessons = [], summaryCards = [] }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [format, setFormat] = useState('grid');

  const targetId = type === 'student' ? 'student-viewer-timetable' : 'teacher-viewer-timetable';
  const title = type === 'student' ? 'Student Timetable' : 'Teacher Timetable';

  const normalizedLessons = useMemo(() => lessons.map((lesson) => ({
    day: lesson.day,
    time: lesson.time || [lesson.startTime, lesson.endTime].filter(Boolean).join(' - '),
    subject: lesson.subject,
    meta: [lesson.teacher, lesson.room].filter(Boolean).join(' • '),
  })), [lessons]);

  const handleExport = async () => {
    if (!entityId || !scheduleVersionId) return;

    setIsLoading(true);
    try {
      if (format === 'portrait') {
        await exportGridPdf({ elementId: targetId, type, scheduleVersionId, orientation: 'portrait' });
      } else if (format === 'list') {
        exportListPdf({ type, scheduleVersionId, title: `${title} • Detailed List`, lessons: normalizedLessons });
      } else if (format === 'summary') {
        exportSummaryPdf({ type, scheduleVersionId, title: `${title} • Compact Summary`, summaryCards, lessons: normalizedLessons });
      } else {
        await exportGridPdf({ elementId: targetId, type, scheduleVersionId, orientation: 'landscape' });
      }
      setIsModalOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(true)} disabled={isLoading || !entityId || !scheduleVersionId}>
        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
        {isLoading ? 'Exporting...' : label}
      </Button>
      <PdfExportSettingsModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        selectedFormat={format}
        onSelectFormat={setFormat}
        onExport={handleExport}
        isLoading={isLoading}
      />
    </>
  );
}