import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { MapPin, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import MapSelector from './components/MapSelector';
import CategorySelector from './components/CategorySelector';
import ScraperControls from './components/ScraperControls';
import LiveStats from './components/LiveStats';
import WorkerMonitor from './components/WorkerMonitor';
import LeadsTable from './components/LeadsTable';
import { downloadExcel } from './utils/excelExporter';

const socket = io('/', { autoConnect: true });

export default function App() {
  const [selectedLocation, setSelectedLocation] = useState('Ahmedabad, India');
  const [selectedCoords, setSelectedCoords] = useState({ lat: 23.0225, lng: 72.5714 });
  const [selectedCategory, setSelectedCategory] = useState('Plumber & Plumbing Services');
  const [customCategory, setCustomCategory] = useState('');

  const [config, setConfig] = useState({
    workerCount: 3,
    websiteFilter: 'all', // 'all' | 'no_website' | 'has_website'
    onlyNoWebsite: false,
    deepExtraction: true,
    liveChrome: true,
    n8nWebhookUrl: '',
    targetLeads: 100,
    maxResults: 100
  });

  const [autoExcelDownload, setAutoExcelDownload] = useState(true);
  const autoExcelDownloadRef = useRef(autoExcelDownload);

  useEffect(() => {
    autoExcelDownloadRef.current = autoExcelDownload;
  }, [autoExcelDownload]);

  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({
    scannedCount: 0,
    qualifiedCount: 0,
    skippedCount: 0,
    status: 'idle',
    activeWorkers: 0,
    workerDetails: []
  });

  const [isConnected, setIsConnected] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('initial_leads', (initialLeads) => {
      setLeads(initialLeads || []);
    });

    socket.on('stats_update', (updatedStats) => {
      setStats(updatedStats);
    });

    socket.on('lead_found', (newLead) => {
      setLeads((prev) => [newLead, ...prev]);
      showNotification(`New Lead: ${newLead.name}`, 'success');
    });

    socket.on('scan_completed', ({ leads: finalLeads, stats: finalStats }) => {
      setStats(finalStats);
      showNotification(`Scan completed! Extracted ${finalLeads.length} leads.`, 'info');

      if (autoExcelDownloadRef.current && finalLeads && finalLeads.length > 0) {
        setTimeout(() => {
          downloadExcel(finalLeads);
          showNotification('Auto-downloaded Excel spreadsheet', 'success');
        }, 500);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('initial_leads');
      socket.off('stats_update');
      socket.off('lead_found');
      socket.off('scan_completed');
    };
  }, []);

  const showNotification = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleConfigChange = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleStartScan = async () => {
    const payload = {
      category: customCategory || selectedCategory,
      location: selectedLocation,
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
      ...config
    };

    try {
      const res = await fetch('/api/start-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        setLeads([]);
        showNotification(`Searching "${payload.category}" in ${payload.location}...`, 'success');
      } else {
        showNotification(`${data.error || 'Failed to start scan'}`, 'error');
      }
    } catch (err) {
      showNotification('Server connection failed', 'error');
    }
  };

  const handlePauseScan = async () => {
    try {
      await fetch('/api/pause-scan', { method: 'POST' });
    } catch (err) {}
  };

  const handleStopScan = async () => {
    try {
      await fetch('/api/stop-scan', { method: 'POST' });
      showNotification('Scan job stopped', 'info');
    } catch (err) {}
  };

  const handleExportExcel = () => {
    if (leads.length === 0) {
      showNotification('No leads to export yet', 'error');
      return;
    }
    downloadExcel(leads);
    showNotification('Downloaded Excel spreadsheet (.xlsx)', 'success');
  };

  const handleExportCSV = () => {
    window.open('/api/export/csv', '_blank');
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(leads, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "google_maps_leads.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleSendSingleN8n = async (lead) => {
    if (!config.n8nWebhookUrl) {
      showNotification('Please enter an n8n Webhook URL first', 'error');
      return;
    }

    try {
      const res = await fetch('/api/test-n8n', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: config.n8nWebhookUrl, lead })
      });
      if (res.ok) {
        showNotification(`Pushed "${lead.name}" to n8n Webhook!`, 'success');
      } else {
        showNotification('Failed to push lead to n8n Webhook', 'error');
      }
    } catch (e) {
      showNotification('n8n Webhook connection error', 'error');
    }
  };

  const isRunning = stats.status === 'running';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-16 font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 animate-fadeIn">
          <div className="px-3.5 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 text-xs font-medium shadow-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-zinc-300" />
            {notification.msg}
          </div>
        </div>
      )}

      {/* Modern Minimal Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/90 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center font-extrabold shadow-sm">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-zinc-100 text-sm tracking-tight flex items-center gap-2">
                LeadMap Pro
                <span className="text-[10px] font-mono bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded border border-zinc-800 font-normal">
                  v3.0 Minimal
                </span>
              </h1>
              <p className="text-[11px] text-zinc-400">Google Maps Lead Finder & Auto Exporter</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <div className="flex items-center gap-2 text-xs px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 font-mono text-zinc-400">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>

            {/* Header Export Excel Button */}
            <button
              onClick={handleExportExcel}
              disabled={leads.length === 0}
              className="px-3.5 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export Excel ({leads.length})
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-5">
        {/* UNIFIED TOP SECTION: Left Big Square Map & Right Controls Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Big Square Map Component */}
          <div className="lg:col-span-5 minimal-card p-4 flex flex-col justify-between shadow-sm">
            <MapSelector
              selectedLocation={selectedLocation}
              onSelectLocation={setSelectedLocation}
              selectedCoords={selectedCoords}
              onSelectCoords={setSelectedCoords}
            />
          </div>

          {/* Right Column: Search Category & Scraper Settings */}
          <div className="lg:col-span-7 minimal-card p-5 space-y-5 flex flex-col justify-between shadow-sm">
            <div className="space-y-5">
              <CategorySelector
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                customCategory={customCategory}
                onCustomCategoryChange={setCustomCategory}
              />
              <ScraperControls
                config={config}
                onChangeConfig={handleConfigChange}
                scanStatus={stats.status}
                onStart={handleStartScan}
                onPause={handlePauseScan}
                onStop={handleStopScan}
              />
            </div>
          </div>
        </div>

        {/* LIVE STATS BAR */}
        <LiveStats stats={stats} />

        {/* WORKER MONITOR */}
        <WorkerMonitor workerDetails={stats.workerDetails} isRunning={isRunning} />

        {/* LEADS TABLE */}
        <LeadsTable
          leads={leads}
          onExportExcel={handleExportExcel}
          onExportCSV={handleExportCSV}
          onExportJSON={handleExportJSON}
          onSendSingleN8n={handleSendSingleN8n}
        />
      </main>
    </div>
  );
}

