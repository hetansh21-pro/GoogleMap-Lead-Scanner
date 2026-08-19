import React from 'react';
import { Target, CheckCircle2, Cpu, Percent } from 'lucide-react';

export default function LiveStats({ stats }) {
  const { scannedCount = 0, qualifiedCount = 0, activeWorkers = 0, status = 'idle' } = stats;

  const successRate = scannedCount > 0 ? Math.round((qualifiedCount / scannedCount) * 100) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Extracted Companies */}
      <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-medium text-zinc-400 block">Extracted Leads</span>
          <div className="text-xl font-bold font-mono text-zinc-100">{qualifiedCount}</div>
        </div>
        <div className="p-2 rounded-lg bg-zinc-800 text-zinc-200">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      </div>

      {/* Scanned Listings */}
      <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-medium text-zinc-400 block">Scanned Listings</span>
          <div className="text-xl font-bold font-mono text-zinc-100">{scannedCount}</div>
        </div>
        <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300">
          <Target className="w-4 h-4" />
        </div>
      </div>

      {/* Accuracy Rate */}
      <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-medium text-zinc-400 block">Conversion Rate</span>
          <div className="text-xl font-bold font-mono text-zinc-100">{successRate}%</div>
        </div>
        <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300">
          <Percent className="w-4 h-4" />
        </div>
      </div>

      {/* Active Worker Tabs */}
      <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-medium text-zinc-400 block">Active Browser Tabs</span>
          <div className="text-xl font-bold font-mono text-zinc-100 flex items-center gap-1.5">
            {activeWorkers}
            {status === 'running' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
          </div>
        </div>
        <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300">
          <Cpu className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

