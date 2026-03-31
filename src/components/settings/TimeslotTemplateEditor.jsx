import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Plus, Trash2 } from 'lucide-react';

const createBlock = () => ({ label: '', start: '', end: '' });

export default function TimeslotTemplateEditor({ value = [], onChange }) {
  const blocks = value.length ? value : [];

  const updateBlock = (index, key, nextValue) => {
    const next = blocks.map((block, currentIndex) => currentIndex === index ? { ...block, [key]: nextValue } : block);
    onChange(next);
  };

  const addBlock = () => onChange([...blocks, createBlock()]);
  const removeBlock = (index) => onChange(blocks.filter((_, currentIndex) => currentIndex !== index));

  return (
    <Card className="border-0 shadow-sm bg-white rounded-xl">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100">
            <Clock className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <CardTitle className="text-lg">Custom Time Blocks</CardTitle>
            <CardDescription>The school admin decides the exact duration of each block.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Define each daily block manually, for example 08:00–08:45, 08:45–09:30, 09:45–10:15.
        </div>

        <div className="space-y-4">
          {blocks.map((block, index) => (
            <div key={index} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1.2fr_1fr_1fr_auto]">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={block.label || ''}
                  onChange={(e) => updateBlock(index, 'label', e.target.value)}
                  placeholder={`Block ${index + 1}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Start</Label>
                <Input
                  type="time"
                  value={block.start || ''}
                  onChange={(e) => updateBlock(index, 'start', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input
                  type="time"
                  value={block.end || ''}
                  onChange={(e) => updateBlock(index, 'end', e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" size="icon" onClick={() => removeBlock(index)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" onClick={addBlock} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add block
        </Button>
      </CardContent>
    </Card>
  );
}