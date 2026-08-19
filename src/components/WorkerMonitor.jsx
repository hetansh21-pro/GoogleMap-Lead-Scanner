import React from 'react';
import { Chrome, Disc } from 'lucide-react';

export default function WorkerMonitor({ workerDetails = [], isRunning }) {
  if (!workerDetails || workerDetails.length === 0 || !isRunning) {
    return null;
  }

  return (
    <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-300 tracking-tight flex items-center gap-2">
          <Chrome className="w-4 h-4 text-zinc-100" />
          Worker Activity ({workerDetails.length} Tabs Running)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {workerDetails.map((worker) => (
          <div
            key={worker.id}
            className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-1"
          >
            <div className="flex items-center justify-between text-xs font-bold text-zinc-100">
              <span className="flex items-center gap-1.5 text-zinc-200 font-mono">
                Tab #{worker.id}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                <Disc className="w-3 h-3 animate-spin text-zinc-300" />
                {worker.qualified || 0} Leads
              </span>
            </div>

            <p className="text-[11px] text-zinc-400 font-medium truncate">
              {worker.status || 'Scanning...'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

