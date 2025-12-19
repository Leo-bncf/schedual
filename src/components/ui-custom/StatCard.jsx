import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendUp, className = "" }) {
  return (
    <Card className={`relative overflow-hidden border-0 bg-white shadow-sm hover:shadow-md transition-all duration-300 ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500 tracking-wide uppercase">{title}</p>
            <p className="text-3xl font-semibold text-slate-900 tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-sm text-slate-500">{subtitle}</p>
            )}
            {trend && (
              <div className={`flex items-center gap-1 text-sm font-medium ${trendUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                <span>{trendUp ? '↑' : '↓'}</span>
                <span>{trend}</span>
              </div>
            )}
          </div>
          {Icon && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100">
              <Icon className="w-6 h-6 text-indigo-600" />
            </div>
          )}
        </div>
      </CardContent>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Card>
  );
}