import React from 'react';
import { Target, CheckCircle2, Cpu, Percent } from 'lucide-react';

export default function LiveStats({ stats }) {
  const { scannedCount = 0, qualifiedCount = 0, activeWorkers = 0, status = 'idle' } = stats;

  const successRate = scannedCount > 0 ? Math.round((qualifiedCount / scannedCount) * 100) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
      {/* 🟢 CARD 1: GOOGLE GREEN - Extracted Leads */}
      <div className="p-4 google-card bg-white border-l-4 border-l-[#34a853] flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[11px] font-bold tracking-wider text-gray-500 uppercase block">Extracted Leads</span>
          <div className="text-2xl font-black text-[#137333] mt-0.5">{qualifiedCount}</div>
        </div>
        <div className="p-2.5 rounded-2xl bg-[#e6f4ea] text-[#34a853] border border-[#ceead6]">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </div>

      {/* 🔵 CARD 2: GOOGLE BLUE - Scanned Listings */}
      <div className="p-4 google-card bg-white border-l-4 border-l-[#4285f4] flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[11px] font-bold tracking-wider text-gray-500 uppercase block">Scanned Listings</span>
          <div className="text-2xl font-black text-[#1a73e8] mt-0.5">{scannedCount}</div>
        </div>
        <div className="p-2.5 rounded-2xl bg-[#e8f0fe] text-[#4285f4] border border-[#d2e3fc]">
          <Target className="w-5 h-5" />
        </div>
      </div>

      {/* 🟡 CARD 3: GOOGLE YELLOW - Conversion Rate */}
      <div className="p-4 google-card bg-white border-l-4 border-l-[#fbbc05] flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[11px] font-bold tracking-wider text-gray-500 uppercase block">Conversion Rate</span>
          <div className="text-2xl font-black text-[#b06000] mt-0.5">{successRate}%</div>
        </div>
        <div className="p-2.5 rounded-2xl bg-[#fef7e0] text-[#f59e0b] border border-[#feefc3]">
          <Percent className="w-5 h-5" />
        </div>
      </div>

      {/* 🔴 CARD 4: GOOGLE RED - Active Chrome Tabs */}
      <div className="p-4 google-card bg-white border-l-4 border-l-[#ea4335] flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[11px] font-bold tracking-wider text-gray-500 uppercase block">Active Chrome Tabs</span>
          <div className="text-2xl font-black text-[#c5221f] mt-0.5 flex items-center gap-2">
            {activeWorkers}
            {status === 'running' && <span className="w-2.5 h-2.5 rounded-full bg-[#ea4335] animate-pulse" />}
          </div>
        </div>
        <div className="p-2.5 rounded-2xl bg-[#fce8e6] text-[#ea4335] border border-[#fad2cf]">
          <Cpu className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
