import React from 'react';
import { Button } from "@/components/ui/button";

export default function EmptyState({ icon: Icon, title, description, action, actionLabel, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center mb-6">
          <Icon className="w-8 h-8 text-slate-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      {description && (
        <p className="text-slate-500 max-w-sm mb-6">{description}</p>
      )}
      {action && actionLabel && (
        <Button onClick={action} className="bg-indigo-600 hover:bg-indigo-700">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}