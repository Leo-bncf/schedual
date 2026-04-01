import React from 'react';

export default function ComparisonSection() {
  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-transparent z-20">
      <div className="max-w-7xl mx-auto relative z-20">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl shadow-lg group hover:bg-gradient-to-br hover:from-blue-900 hover:to-blue-950 transition-all duration-500 cursor-pointer">
            <h3 className="text-2xl font-semibold text-slate-900 mb-4 group-hover:text-white transition-colors">Without a clear school tier system</h3>
            <ul className="space-y-3 text-slate-700 group-hover:text-blue-100 transition-colors">
              <li className="flex items-start gap-2"><span className="text-rose-600 mt-1 group-hover:text-red-300">•</span><span>No clear student cap per school</span></li>
              <li className="flex items-start gap-2"><span className="text-rose-600 mt-1 group-hover:text-red-300">•</span><span>Too many admin accounts can be created without structure</span></li>
              <li className="flex items-start gap-2"><span className="text-rose-600 mt-1 group-hover:text-red-300">•</span><span>Saved schedule version rules become inconsistent</span></li>
              <li className="flex items-start gap-2"><span className="text-rose-600 mt-1 group-hover:text-red-300">•</span><span>Pricing and product limits do not match the real platform rules</span></li>
            </ul>
          </div>

          <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl shadow-lg group hover:bg-gradient-to-br hover:from-blue-900 hover:to-blue-950 transition-all duration-500 cursor-pointer">
            <h3 className="text-2xl font-semibold text-slate-900 mb-4 group-hover:text-white transition-colors">With Schedual school tiers</h3>
            <ul className="space-y-3 text-slate-700 group-hover:text-blue-100 transition-colors">
              <li className="flex items-start gap-2"><span className="text-emerald-600 mt-1 group-hover:text-emerald-300">✓</span><span>Each school follows Starter, Standard, or Pro rules</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-600 mt-1 group-hover:text-emerald-300">✓</span><span>Student capacity is limited by the selected tier</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-600 mt-1 group-hover:text-emerald-300">✓</span><span>Saved schedule versions and admin accounts are controlled automatically</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-600 mt-1 group-hover:text-emerald-300">✓</span><span>The public offer and the in-app rules now match</span></li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}