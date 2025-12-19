import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, Shield, Star, Pencil, Trash2, Lock } from 'lucide-react';

const categoryIcons = {
  teacher: '👨‍🏫',
  student: '🎓',
  room: '🏫',
  subject: '📚',
  time: '⏰',
  ib_requirement: '🎯',
  custom: '⚙️'
};

const categoryColors = {
  teacher: 'bg-blue-100 text-blue-700',
  student: 'bg-emerald-100 text-emerald-700',
  room: 'bg-violet-100 text-violet-700',
  subject: 'bg-amber-100 text-amber-700',
  time: 'bg-rose-100 text-rose-700',
  ib_requirement: 'bg-indigo-100 text-indigo-700',
  custom: 'bg-slate-100 text-slate-700'
};

export default function ConstraintCard({ constraint, onEdit, onDelete, onToggle, onWeightChange }) {
  const isSystemConstraint = constraint.source === 'system';
  const isHard = constraint.type === 'hard';

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="text-2xl">{categoryIcons[constraint.category] || '⚙️'}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-900">{constraint.name}</h3>
                {isSystemConstraint && (
                  <Lock className="w-3 h-3 text-slate-400" />
                )}
              </div>
              <p className="text-sm text-slate-500 line-clamp-2">{constraint.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={isHard ? 'bg-rose-100 text-rose-700 border-0' : 'bg-amber-100 text-amber-700 border-0'}>
              {isHard ? (
                <>
                  <Shield className="w-3 h-3 mr-1" />
                  Hard
                </>
              ) : (
                <>
                  <Star className="w-3 h-3 mr-1" />
                  Soft
                </>
              )}
            </Badge>
            <Badge className={`${categoryColors[constraint.category]} border-0`}>
              {constraint.category}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isSystemConstraint && (
              <div className="flex items-center gap-2">
                <Switch 
                  checked={constraint.is_active !== false}
                  onCheckedChange={() => onToggle && onToggle(constraint)}
                  disabled={isSystemConstraint}
                />
                <span className="text-sm text-slate-600">
                  {constraint.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
            )}
            
            {!isHard && !isSystemConstraint && (
              <div className="flex items-center gap-3 flex-1 max-w-xs">
                <span className="text-sm text-slate-600 whitespace-nowrap">Weight:</span>
                <div className="flex-1">
                  <Slider
                    value={[constraint.weight || 0.5]}
                    onValueChange={(value) => onWeightChange && onWeightChange(constraint, value[0])}
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                <span className="text-sm font-medium text-slate-900 w-8">
                  {((constraint.weight || 0.5) * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
          
          {!isSystemConstraint && (
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => onEdit && onEdit(constraint)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                onClick={() => onDelete && onDelete(constraint)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {constraint.source === 'ai_suggested' && (
          <div className="mt-3 p-2 rounded-lg bg-violet-50 border border-violet-200">
            <p className="text-xs text-violet-700 flex items-center gap-2">
              <AlertCircle className="w-3 h-3" />
              AI-suggested constraint from schedule analysis
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}