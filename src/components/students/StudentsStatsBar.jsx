import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export default function StudentsStatsBar({ searchQuery, setSearchQuery, yearFilter, setYearFilter, students, allowedProgrammes, dp1Count, dp2Count, mypCounts, pypCounts }) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Search students..." className="pl-10 h-11 bg-white border-slate-200 shadow-sm rounded-xl" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>
      <Tabs value={yearFilter} onValueChange={setYearFilter}>
        <TabsList className="bg-white border border-slate-200 shadow-sm p-1 rounded-xl overflow-x-auto">
          <TabsTrigger value="all" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-violet-500 data-[state=active]:text-white transition-all">All ({students.length})</TabsTrigger>
          {allowedProgrammes.includes('DP') && <>
            <TabsTrigger value="DP1" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white transition-all">DP1 ({dp1Count})</TabsTrigger>
            <TabsTrigger value="DP2" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white transition-all">DP2 ({dp2Count})</TabsTrigger>
          </>}
          {allowedProgrammes.includes('MYP') && Object.entries(mypCounts).map(([key, value]) => (
            <TabsTrigger key={key} value={key} className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-fuchsia-500 data-[state=active]:text-white transition-all">{key} ({value})</TabsTrigger>
          ))}
          {allowedProgrammes.includes('PYP') && Object.entries(pypCounts).map(([key, value]) => (
            <TabsTrigger key={key} value={key} className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white transition-all">{key.replace('PYP-', 'PYP ')} ({value})</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}