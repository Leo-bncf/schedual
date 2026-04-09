import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, LayoutGrid, MonitorSmartphone } from 'lucide-react';

const options = [
  {
    value: 'grid',
    title: 'Default Grid',
    description: 'Current timetable layout with branding.',
    icon: LayoutGrid,
  },
  {
    value: 'portrait',
    title: 'Portrait',
    description: 'Same timetable exported in portrait format.',
    icon: MonitorSmartphone,
  },
  {
    value: 'list',
    title: 'Detailed List',
    description: 'A clean lesson-by-lesson printable list.',
    icon: FileText,
  },
  {
    value: 'summary',
    title: 'Compact Summary',
    description: 'Quick overview with key stats and lesson highlights.',
    icon: FileText,
  },
];

export default function PdfExportSettingsModal({ open, onOpenChange, selectedFormat, onSelectFormat, onExport, isLoading }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>PDF export settings</DialogTitle>
          <DialogDescription>Choose the format you want before generating the PDF.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((option) => {
            const Icon = option.icon;
            const isActive = selectedFormat === option.value;
            return (
              <button key={option.value} type="button" onClick={() => onSelectFormat(option.value)} className="text-left">
                <Card className={isActive ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}>
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className={isActive ? 'rounded-lg bg-blue-100 p-2 text-blue-700' : 'rounded-lg bg-slate-100 p-2 text-slate-500'}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{option.title}</div>
                      <div className="text-sm text-slate-500">{option.description}</div>
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onExport} disabled={isLoading}>Generate PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}