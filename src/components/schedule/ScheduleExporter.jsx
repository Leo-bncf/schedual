import React from 'react';
import { Button } from "@/components/ui/button";
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function ScheduleExporter({ 
  elementId, 
  filename, 
  label = "Export PDF",
  headerData = {} // { schoolName, studentName, lastUpdated }
}) {
  const [isExporting, setIsExporting] = React.useState(false);

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        console.error('Element not found');
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 2.5,
        logging: false,
        useCORS: true,
        backgroundColor: '#ffffff',
        removeContainer: true,
        imageTimeout: 0,
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // Always landscape for schedules
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Add header if data provided
      let contentYStart = 10;
      if (headerData.schoolName || headerData.studentName || headerData.lastUpdated) {
        // School name (top left)
        if (headerData.schoolName) {
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          pdf.text(headerData.schoolName, 10, 10);
        }
        
        // Student/Teacher name (top center)
        if (headerData.studentName) {
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          const nameWidth = pdf.getTextWidth(headerData.studentName);
          pdf.text(headerData.studentName, (pdfWidth - nameWidth) / 2, 10);
        }
        
        // Last updated (top right)
        if (headerData.lastUpdated) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          const dateText = `Updated: ${headerData.lastUpdated}`;
          const dateWidth = pdf.getTextWidth(dateText);
          pdf.text(dateText, pdfWidth - dateWidth - 10, 10);
        }
        
        contentYStart = 20; // Leave space for header
      }
      
      // Calculate scaling with margins
      const margin = 10;
      const maxWidth = pdfWidth - (margin * 2);
      const maxHeight = pdfHeight - contentYStart - margin;
      
      const scale = Math.min(maxWidth / (canvas.width * 0.264583), maxHeight / (canvas.height * 0.264583));
      const scaledWidth = (canvas.width * 0.264583) * scale;
      const scaledHeight = (canvas.height * 0.264583) * scale;
      
      const x = (pdfWidth - scaledWidth) / 2;
      const y = contentYStart + ((maxHeight - scaledHeight) / 2);

      pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight, undefined, 'FAST');
      pdf.save(`${filename}.pdf`);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={exportToPDF}
      disabled={isExporting}
    >
      <Download className="w-4 h-4 mr-2" />
      {isExporting ? 'Exporting...' : label}
    </Button>
  );
}