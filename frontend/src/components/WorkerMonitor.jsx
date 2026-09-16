import React from 'react';
import { Chrome, Disc } from 'lucide-react';

export default function WorkerMonitor({ workerDetails = [], isRunning }) {
  if (!workerDetails || workerDetails.length === 0 || !isRunning) {
    return null;
  }

  return (
    <div className="google-card p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between border-b border-[#eee9dd] pb-2">
        <span className="text-xs font-extrabold text-gray-800 tracking-tight flex items-center gap-2">
          <Chrome className="w-4 h-4 text-[#1a73e8]" />
          <span>Worker Activity ({workerDetails.length} Parallel Chrome Tabs Running)</span>
        </span>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#34a853] bg-[#e6f4ea] px-2.5 py-0.5 rounded-full border border-[#ceead6]">
          <span className="w-2 h-2 rounded-full bg-[#34a853] animate-pulse"></span>
          <span>Live Scanning Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {workerDetails.map((worker) => (
          <div
            key={worker.id}
            className="p-3.5 bg-[#faf8f3] rounded-2xl border border-[#e2ddd0] space-y-1.5 shadow-xs"
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-gray-900 font-sans">
                Tab #{worker.id}
              </span>
              <span className="text-[10px] text-[#1a73e8] font-bold bg-[#e8f0fe] px-2 py-0.5 rounded-full border border-[#aecbfa] flex items-center gap-1">
                <Disc className="w-3 h-3 animate-spin text-[#1a73e8]" />
                {worker.qualified || 0} Leads
              </span>
            </div>

            <p className="text-[11px] text-gray-600 font-medium truncate">
              {worker.status || 'Scanning active...'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
