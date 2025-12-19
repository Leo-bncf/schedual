import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const severityConfig = {
  error: {
    icon: AlertCircle,
    className: 'border-rose-200 bg-rose-50 text-rose-800',
    iconClass: 'text-rose-600',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    iconClass: 'text-amber-600',
  },
  success: {
    icon: CheckCircle,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    iconClass: 'text-emerald-600',
  },
  info: {
    icon: Info,
    className: 'border-blue-200 bg-blue-50 text-blue-800',
    iconClass: 'text-blue-600',
  },
};

export default function ConflictAlert({ severity = 'info', title, description, actions }) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <Alert className={`${config.className} border`}>
      <Icon className={`h-4 w-4 ${config.iconClass}`} />
      <AlertTitle className="font-semibold">{title}</AlertTitle>
      <AlertDescription className="mt-1 opacity-90">
        {description}
      </AlertDescription>
      {actions && (
        <div className="mt-3 flex gap-2">
          {actions}
        </div>
      )}
    </Alert>
  );
}