import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download, FileText, BarChart3, Loader2, AlertCircle } from 'lucide-react';

export default function ScheduleExporter({ scheduleVersionId, isOpen, onClose }) {
  const [exportType, setExportType] = useState('pdf');
  const [includeOptions, setIncludeOptions] = useState({
    conflicts: true,
    analytics: true,
    load_analysis: true,
    recommendations: true
  });
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);
  const contentRef = useRef(null);

  const handleOptionChange = (key) => {
    setIncludeOptions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const exportToPDF = async () => {
    try {
      setIsExporting(true);
      setError(null);

      // Fetch analytics and schedule data
      const [analyticsRes, metricsRes] = await Promise.all([
        base44.functions.invoke('generateScheduleAnalytics', {
          schedule_version_id: scheduleVersionId
        }),
        base44.functions.invoke('getVersionMetrics', {
          schedule_version_id: scheduleVersionId
        })
      ]);

      const analytics = analyticsRes.data;
      const metrics = metricsRes.data;

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPosition = 15;

      // Title
      pdf.setFontSize(18);
      pdf.setTextColor(30, 30, 30);
      pdf.text('Schedule Report', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 12;

      // Date
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Summary Section
      if (includeOptions.analytics) {
        pdf.setFontSize(14);
        pdf.setTextColor(30, 30, 30);
        pdf.text('Schedule Summary', 15, yPosition);
        yPosition += 8;

        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);
        const summaryItems = [
          `Total Slots: ${analytics.summary.total_slots}`,
          `Total Hours: ${analytics.summary.total_hours}h`,
          `Room Utilization: ${analytics.utilization.avg_room_utilization}%`,
          `Quality Score: ${analytics.quality_score}%`
        ];

        summaryItems.forEach(item => {
          pdf.text(item, 15, yPosition);
          yPosition += 7;
        });
        yPosition += 5;
      }

      // Conflicts Section
      if (includeOptions.conflicts && metrics.conflict_stats.total_conflicts > 0) {
        pdf.setFontSize(14);
        pdf.setTextColor(30, 30, 30);
        pdf.text('Conflicts Summary', 15, yPosition);
        yPosition += 8;

        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);
        const conflictItems = [
          `Total Conflicts: ${metrics.conflict_stats.total_conflicts}`,
          `Unresolved: ${metrics.conflict_stats.unresolved}`,
          `Resolved: ${metrics.conflict_stats.resolved}`
        ];

        conflictItems.forEach(item => {
          pdf.text(item, 15, yPosition);
          yPosition += 7;
        });
        yPosition += 5;
      }

      // Load Analysis Section
      if (includeOptions.load_analysis) {
        pdf.setFontSize(14);
        pdf.setTextColor(30, 30, 30);
        pdf.text('Workload Analysis', 15, yPosition);
        yPosition += 8;

        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);
        const loadItems = [
          `Average Hours per Teacher: ${analytics.load_analysis.avg_hours_per_teacher}h`,
          `Max Load: ${analytics.load_analysis.max_hours}h`,
          `Workload Imbalance: ${(analytics.load_analysis.imbalance_score * 100).toFixed(0)}%`
        ];

        loadItems.forEach(item => {
          pdf.text(item, 15, yPosition);
          yPosition += 7;
        });
        yPosition += 5;
      }

      // Recommendations Section
      if (includeOptions.recommendations && analytics.recommendations) {
        pdf.setFontSize(14);
        pdf.setTextColor(30, 30, 30);
        pdf.text('Recommendations', 15, yPosition);
        yPosition += 8;

        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);
        analytics.recommendations.forEach(rec => {
          const lines = pdf.splitTextToSize(`• ${rec}`, pageWidth - 30);
          pdf.text(lines, 15, yPosition);
          yPosition += lines.length * 5 + 2;
        });
      }

      // Save PDF
      pdf.save(`schedule-report-${new Date().toISOString().split('T')[0]}.pdf`);

      setIsExporting(false);
      onClose();
    } catch (err) {
      setError(err.message);
      setIsExporting(false);
    }
  };

  const exportToCSV = async () => {
    try {
      setIsExporting(true);
      setError(null);

      const analyticsRes = await base44.functions.invoke('generateScheduleAnalytics', {
        schedule_version_id: scheduleVersionId
      });

      const analytics = analyticsRes.data;

      // Build CSV content
      let csv = 'Schedule Analytics Report\n\n';
      csv += `Generated,${new Date().toISOString()}\n\n`;

      // Summary
      csv += 'SUMMARY\n';
      csv += `Total Slots,${analytics.summary.total_slots}\n`;
      csv += `Total Hours,${analytics.summary.total_hours}\n`;
      csv += `Quality Score,${analytics.quality_score}%\n\n`;

      // Utilization
      csv += 'UTILIZATION BY DAY\n';
      csv += 'Day,Utilization %,Slots\n';
      analytics.utilization.by_day.forEach(d => {
        csv += `${d.day},${d.utilization},${d.slots}\n`;
      });
      csv += '\n';

      // Workload
      csv += 'TOP 10 TEACHERS BY HOURS\n';
      csv += 'Name,Hours\n';
      analytics.load_analysis.teacher_hours.forEach(t => {
        csv += `${t.name},${t.hours}\n`;
      });

      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schedule-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setIsExporting(false);
      onClose();
    } catch (err) {
      setError(err.message);
      setIsExporting(false);
    }
  };

  const handleExport = () => {
    if (exportType === 'pdf') {
      exportToPDF();
    } else if (exportType === 'csv') {
      exportToCSV();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Schedule Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Export Type */}
          <div>
            <label className="text-sm font-medium mb-2 block">Export Format</label>
            <Select value={exportType} onValueChange={setExportType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF Report</SelectItem>
                <SelectItem value="csv">CSV Data</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {exportType === 'pdf' && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
              <p className="text-sm font-medium">Include in Report</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={includeOptions.analytics}
                    onCheckedChange={() => handleOptionChange('analytics')}
                    id="analytics"
                  />
                  <label htmlFor="analytics" className="text-sm cursor-pointer">
                    Analytics Summary
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={includeOptions.conflicts}
                    onCheckedChange={() => handleOptionChange('conflicts')}
                    id="conflicts"
                  />
                  <label htmlFor="conflicts" className="text-sm cursor-pointer">
                    Conflict Report
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={includeOptions.load_analysis}
                    onCheckedChange={() => handleOptionChange('load_analysis')}
                    id="load"
                  />
                  <label htmlFor="load" className="text-sm cursor-pointer">
                    Workload Analysis
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={includeOptions.recommendations}
                    onCheckedChange={() => handleOptionChange('recommendations')}
                    id="recommendations"
                  />
                  <label htmlFor="recommendations" className="text-sm cursor-pointer">
                    Recommendations
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleExport} 
              disabled={isExporting}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}