import React from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export default function TeachersToolbar({ searchQuery, setSearchQuery }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Search teachers..." className="pl-10 h-11 bg-white border-slate-200 shadow-sm rounded-xl" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>
    </div>
  );
}