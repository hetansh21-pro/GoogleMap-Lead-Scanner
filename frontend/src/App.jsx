import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { MapPin, FileSpreadsheet, CheckCircle2, Search } from 'lucide-react';
import MapSelector from './components/MapSelector';
import CategorySelector from './components/CategorySelector';
import ScraperControls from './components/ScraperControls';
import SubAreasSelector from './components/SubAreasSelector';
import LiveStats from './components/LiveStats';
import WorkerMonitor from './components/WorkerMonitor';
import LeadsTable from './components/LeadsTable';
import { downloadExcel } from './utils/excelExporter';
import { getSubLocationsForCity, DEFAULT_AHMEDABAD_AREAS } from './utils/subLocationsData';
import { BACKEND_URL } from './config';

const socket = io(BACKEND_URL, { autoConnect: true });

export default function App() {
  const [selectedLocation, setSelectedLocation] = useState('Ahmedabad, India');
  const [selectedCoords, setSelectedCoords] = useState({ lat: 23.0225, lng: 72.5714 });

  // Direct dynamic sub-locations - NO localStorage caching
  const [selectedSubLocations, setSelectedSubLocations] = useState(() => {
    try {
      localStorage.removeItem('leadmap_manual_bulk_areas');
    } catch (e) {}
    return getSubLocationsForCity('Ahmedabad, India');
  });

  const [isBulkMode, setIsBulkMode] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Plumber & Plumbing Services');
  const [customCategory, setCustomCategory] = useState('');

  const [config, setConfig] = useState({
    workerCount: 3,
    websiteFilter: 'all', // 'all' | 'no_website' | 'has_website'
    onlyNoWebsite: false,
    deepExtraction: true,
    liveChrome: false, // Headless Cloud Ready
    n8nWebhookUrl: '',
    targetLeads: 100,
    maxResults: 100
  });

  const [autoExcelDownload, setAutoExcelDownload] = useState(true);
  const autoExcelDownloadRef = useRef(autoExcelDownload);
  const activeScanParamsRef = useRef({
    category: 'Plumber & Plumbing Services',
    location: 'Ahmedabad, India'
  });

  useEffect(() => {
    try {
      localStorage.removeItem('leadmap_manual_bulk_areas');
    } catch (e) {}
    autoExcelDownloadRef.current = autoExcelDownload;
  }, [autoExcelDownload]);

  const [leads, setLeads] = useState([]);
  const leadBufferRef = useRef([]);
  const flushTimerRef = useRef(null);
  const notificationTimerRef = useRef(null);
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
      leadBufferRef.current = [];
      setLeads(initialLeads || []);
    });

    socket.on('stats_update', (updatedStats) => {
      setStats(updatedStats);
    });

    // Batched updates: Buffers incoming leads and flushes smoothly every 300ms
    // Prevents UI freezes and high CPU churn on low-spec laptops
    socket.on('lead_found', (newLead) => {
      leadBufferRef.current.push(newLead);
      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(() => {
          if (leadBufferRef.current.length > 0) {
            const batch = [...leadBufferRef.current];
            leadBufferRef.current = [];
            setLeads((prev) => [...batch.reverse(), ...prev]);
          }
          flushTimerRef.current = null;
        }, 300);
      }
    });

    socket.on('scan_completed', ({ leads: finalLeads, stats: finalStats, category: completedCat, location: completedLoc }) => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      leadBufferRef.current = [];
      if (finalLeads) {
        setLeads(finalLeads);
      }
      setStats(finalStats);
      showNotification(`Completed! Found ${finalLeads ? finalLeads.length : 0} leads.`, 'info');

      if (autoExcelDownloadRef.current && finalLeads && finalLeads.length > 0) {
        const cat = completedCat || activeScanParamsRef.current.category;
        const loc = completedLoc || activeScanParamsRef.current.location;
        setTimeout(() => {
          downloadExcel(finalLeads, { category: cat, location: loc });
          showNotification(`Downloaded Excel for ${cat} (${loc})`, 'success');
        }, 500);
      }
    });

    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
      socket.off('connect');
      socket.off('disconnect');
      socket.off('initial_leads');
      socket.off('stats_update');
      socket.off('lead_found');
      socket.off('scan_completed');
    };
  }, []);

  const showNotification = (msg, type = 'info') => {
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    setNotification({ msg, type });
    notificationTimerRef.current = setTimeout(() => {
      setNotification(null);
      notificationTimerRef.current = null;
    }, 4000);
  };

  const handleConfigChange = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  // Direct dynamic sub-area fetch on location selection
  const handleLocationSelect = (newLoc) => {
    setSelectedLocation(newLoc);
    setSelectedSubLocations(getSubLocationsForCity(newLoc));
  };

  const handleUpdateManualBulkAreas = (newAreasList) => {
    setSelectedSubLocations(newAreasList);
    showNotification(`Updated ${newAreasList.length} sub-areas!`, 'success');
  };

  const handleStartScan = async () => {
    const activeSubAreas = isBulkMode ? selectedSubLocations : [];
    const activeCategory = customCategory || selectedCategory;
    activeScanParamsRef.current = {
      category: activeCategory,
      location: selectedLocation
    };

    const payload = {
      category: activeCategory,
      location: selectedLocation,
      subLocations: activeSubAreas,
      isBulkMode: isBulkMode,
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
      ...config
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/start-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        setLeads([]);
        const bulkMsg = isBulkMode && activeSubAreas.length > 0
          ? ` across ${activeSubAreas.length} sub-areas in `
          : ' in ';
        showNotification(`Searching "${payload.category}"${bulkMsg}${payload.location}...`, 'success');
      } else {
        showNotification(`${data.error || 'Failed to start search'}`, 'error');
      }
    } catch (err) {
      showNotification('Server connection failed', 'error');
    }
  };

  const handlePauseScan = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/pause-scan`, { method: 'POST' });
    } catch (err) {}
  };

  const handleStopScan = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/stop-scan`, { method: 'POST' });
      showNotification('Search stopped', 'info');
    } catch (err) {}
  };

  const handleExportExcel = async () => {
    if (leads.length === 0) {
      showNotification('No leads to export yet', 'error');
      return;
    }
    const cat = customCategory || selectedCategory || activeScanParamsRef.current.category || leads[0]?.category;
    const loc = selectedLocation || activeScanParamsRef.current.location || leads[0]?.address;

    try {
      await downloadExcel(leads, { category: cat, location: loc });
      showNotification('Downloaded Excel spreadsheet (.xlsx)', 'success');
    } catch (err) {
      console.error('Frontend Excel download error, using fallback:', err);
      window.open(`${BACKEND_URL}/api/export/excel`, '_blank');
      showNotification('Downloaded Excel spreadsheet (.xlsx)', 'success');
    }
  };

  const handleExportCSV = () => {
    window.open(`${BACKEND_URL}/api/export/csv`, '_blank');
  };

  const handleExportJSON = () => {
    const cat = (customCategory || selectedCategory || activeScanParamsRef.current.category || leads[0]?.category || 'Leads')
      .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
    const loc = (selectedLocation || activeScanParamsRef.current.location || 'Area')
      .split(',').slice(0, 2).join(' ').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
    const timestamp = new Date().toISOString().slice(0, 10);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(leads, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${cat}_${loc}_${timestamp}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleSendSingleN8n = async (lead) => {
    if (!config.n8nWebhookUrl) {
      showNotification('Please enter an n8n Webhook URL first in Advanced Config', 'error');
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/test-n8n`, {
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
    <div className="min-h-screen pb-16 font-sans bg-[#f6f3eb] text-gray-900 transition-colors">
      {/* Top 4-Color Google Accent Line */}
      <div className="google-color-bar" />

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-3 sm:top-6 right-3 sm:right-6 left-3 sm:left-auto flex justify-center sm:justify-end z-50 animate-fadeIn pointer-events-none">
          <div className="px-4 py-2.5 rounded-full border border-[#ceead6] bg-white text-gray-800 text-xs font-semibold shadow-xl flex items-center gap-2 pointer-events-auto">
            <CheckCircle2 className="w-4 h-4 text-[#34a853] shrink-0" />
            <span>{notification.msg}</span>
          </div>
        </div>
      )}

      {/* Warm Header */}
      <header className="bg-white border-b border-[#e6e0d4] sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-3">
          {/* Logo with Google Colors */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#4285f4] to-[#1a73e8] text-white flex items-center justify-center font-bold shadow-sm shrink-0">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-xs sm:text-sm md:text-base tracking-tight text-gray-900 flex items-center whitespace-nowrap">
                  <span className="text-[#4285f4]">G</span>
                  <span className="text-[#ea4335]">o</span>
                  <span className="text-[#fbbc05]">o</span>
                  <span className="text-[#4285f4]">g</span>
                  <span className="text-[#34a853]">l</span>
                  <span className="text-[#ea4335]">e</span>
                  <span className="text-gray-800 ml-1">
                    Maps <span className="hidden sm:inline">Lead </span>Scanner
                  </span>
                </h1>
                {/* Google 4 Dots Badge */}
                <div className="hidden md:flex items-center gap-1 bg-[#f6f3eb] px-2 py-0.5 rounded-full border border-[#e2ddd0] shrink-0">
                  <span className="w-2 h-2 rounded-full bg-[#4285f4]"></span>
                  <span className="w-2 h-2 rounded-full bg-[#ea4335]"></span>
                  <span className="w-2 h-2 rounded-full bg-[#fbbc05]"></span>
                  <span className="w-2 h-2 rounded-full bg-[#34a853]"></span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Header Export & Connection */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <div
              title={isConnected ? 'Server Connected' : 'Server Disconnected'}
              className={`flex items-center gap-1.5 text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border font-semibold shrink-0 transition-colors ${
                isConnected
                  ? 'bg-[#e6f4ea] border-[#ceead6] text-[#137333]'
                  : 'bg-[#fce8e6] border-[#fad2cf] text-[#c5221f]'
              }`}
            >
              <span className="relative flex h-2 w-2 shrink-0">
                {isConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34a853] opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-[#34a853]' : 'bg-[#ea4335]'}`} />
              </span>
              <span className="whitespace-nowrap font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <button
              onClick={handleExportExcel}
              disabled={leads.length === 0}
              title={`Export ${leads.length} Leads to Excel`}
              className="px-2 sm:px-3.5 py-1 sm:py-1.5 google-btn-green text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5 disabled:opacity-40 cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span>
                <span className="hidden sm:inline">Export </span>
                Excel ({leads.length})
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Single Page Workspace */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-5 space-y-5">
        {/* MAIN SEARCH WORKSPACE GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Google Map */}
          <div className="lg:col-span-5 google-card p-4 flex flex-col justify-between">
            <MapSelector
              selectedLocation={selectedLocation}
              onSelectLocation={handleLocationSelect}
              selectedCoords={selectedCoords}
              onSelectCoords={setSelectedCoords}
              selectedSubLocations={selectedSubLocations}
              onSelectSubLocations={setSelectedSubLocations}
              isBulkMode={isBulkMode}
              onToggleBulkMode={setIsBulkMode}
            />
          </div>

          {/* Right: Category & Controls */}
          <div className="lg:col-span-7 google-card p-5 space-y-5 flex flex-col justify-between">
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
                manualBulkAreas={selectedSubLocations}
                onUpdateManualBulkAreas={handleUpdateManualBulkAreas}
                autoBulkScanEnabled={isBulkMode}
                onToggleAutoBulkScan={setIsBulkMode}
              />
            </div>
          </div>
        </div>

        {/* MANUAL SUB-AREAS SECTION */}
        <SubAreasSelector
          selectedLocation={selectedLocation}
          selectedSubLocations={selectedSubLocations}
          onSelectSubLocations={setSelectedSubLocations}
          isBulkMode={isBulkMode}
          onToggleBulkMode={setIsBulkMode}
        />

        {/* LIVE METRICS HUD (GOOGLE 4 COLORS) - MOVED AFTER SUB-AREAS */}
        <LiveStats stats={stats} />

        {/* WORKER MONITOR / SCAN TABS - MOVED AFTER SUB-AREAS */}
        <WorkerMonitor workerDetails={stats.workerDetails} isRunning={isRunning} />

        {/* CAPTURED LEADS TABLE */}
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
