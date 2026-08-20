import React, { useState } from 'react';
import { Play, Pause, Square, Cpu, Eye, Globe, Search, Send, Target, Settings, ChevronDown, ChevronUp } from 'lucide-react';

export default function ScraperControls({
  config,
  onChangeConfig,
  scanStatus,
  onStart,
  onPause,
  onStop
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [webhookTestStatus, setWebhookTestStatus] = useState(null);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  const isRunning = scanStatus === 'running';
  const isPaused = scanStatus === 'paused';

  const handleTestWebhook = async () => {
    if (!config.n8nWebhookUrl) return;
    setIsTestingWebhook(true);
    setWebhookTestStatus(null);
    try {
      const res = await fetch('/api/test-n8n', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: config.n8nWebhookUrl })
      });
      if (res.ok) {
        setWebhookTestStatus({ success: true, message: 'n8n Webhook Connected!' });
      } else {
        setWebhookTestStatus({ success: false, message: 'Webhook connection failed' });
      }
    } catch (err) {
      setWebhookTestStatus({ success: false, message: 'Connection error' });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Target Companies Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-300 tracking-tight flex items-center gap-1.5">
            <Target className="w-4 h-4 text-zinc-100" />
            Target Goal (Companies to Scrape)
          </label>
          <span className="text-xs font-mono font-medium text-zinc-400">
            {config.targetLeads || config.maxResults || 100} Target
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {[100, 250, 500, 1000, 2000].map((num) => (
            <button
              key={num}
              type="button"
              disabled={isRunning}
              onClick={() => {
                onChangeConfig('targetLeads', num);
                onChangeConfig('maxResults', num);
              }}
              className={`flex-1 min-w-[70px] py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                (config.targetLeads === num || config.maxResults === num)
                  ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-bold'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700'
              }`}
            >
              {num}
            </button>
          ))}
          <div className="w-20">
            <input
              type="number"
              min="10"
              max="10000"
              disabled={isRunning}
              value={config.targetLeads || config.maxResults || 100}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 100;
                onChangeConfig('targetLeads', val);
                onChangeConfig('maxResults', val);
              }}
              className="w-full bg-zinc-950 text-zinc-100 font-mono text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-zinc-800 focus:border-zinc-500 outline-none text-center"
              placeholder="Custom"
            />
          </div>
        </div>
      </div>

      {/* Website Target Selection Mode - PROMINENT TOP CONTROL */}
      <div className="space-y-2 pt-2 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-300 tracking-tight flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-zinc-100" />
            Website Target Filter
          </label>
          <span className="text-[11px] font-mono text-zinc-400">
            {(config.websiteFilter === 'no_website' || config.onlyNoWebsite)
              ? '🚫 Strict No Website Only'
              : config.websiteFilter === 'has_website'
              ? '🔗 Has Website Only'
              : '🌐 All Businesses'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={isRunning}
            onClick={() => {
              onChangeConfig('websiteFilter', 'all');
              onChangeConfig('onlyNoWebsite', false);
            }}
            className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
              (config.websiteFilter === 'all' || (!config.websiteFilter && !config.onlyNoWebsite))
                ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-bold shadow-sm'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            All Businesses
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={() => {
              onChangeConfig('websiteFilter', 'no_website');
              onChangeConfig('onlyNoWebsite', true);
            }}
            className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
              (config.websiteFilter === 'no_website' || config.onlyNoWebsite)
                ? 'bg-amber-400 text-zinc-950 border-amber-400 font-bold shadow-sm'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>🚫</span>
            No Website Only
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={() => {
              onChangeConfig('websiteFilter', 'has_website');
              onChangeConfig('onlyNoWebsite', false);
            }}
            className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
              config.websiteFilter === 'has_website'
                ? 'bg-blue-500 text-white border-blue-500 font-bold shadow-sm'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>🔗</span>
            Has Website Only
          </button>
        </div>

        {(config.websiteFilter === 'no_website' || config.onlyNoWebsite) && (
          <p className="text-[11px] text-amber-300 font-mono bg-amber-950/40 p-2 rounded-lg border border-amber-900/60 flex items-center gap-1.5">
            <span>🚫</span>
            <span><strong>Strict Mode:</strong> ONLY businesses WITHOUT a website will be fetched. Businesses with existing websites are strictly excluded (no combining).</span>
          </p>
        )}
      </div>

      {/* Advanced Options Accordion Toggle */}
      <div className="border-t border-zinc-800 pt-3">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between text-xs font-medium text-zinc-400 hover:text-zinc-200 transition py-1"
        >
          <span className="flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-zinc-400" />
            Advanced Options (Tabs: {config.workerCount}, Filters, Webhook)
          </span>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="mt-3 p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 space-y-3.5">
            {/* Workers & Live Chrome */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Workers */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                    Parallel Tabs:
                  </span>
                  <span className="text-zinc-200 font-mono text-xs">{config.workerCount} Tabs</span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {[1, 2, 3, 4, 5, 6, 8, 12, 16].map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={isRunning}
                      onClick={() => onChangeConfig('workerCount', num)}
                      className={`py-1 px-2 rounded-md text-xs font-mono font-semibold border transition ${
                        config.workerCount === num
                          ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-bold'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100'
                      }`}
                    >
                      {num}W
                    </button>
                  ))}
                  <div className="w-16">
                    <input
                      type="number"
                      min="1"
                      max="32"
                      disabled={isRunning}
                      value={config.workerCount}
                      onChange={(e) => onChangeConfig('workerCount', Math.min(Math.max(parseInt(e.target.value) || 1, 1), 32))}
                      className="w-full bg-zinc-950 text-zinc-100 font-mono text-xs font-semibold rounded-md px-1.5 py-1 border border-zinc-800 focus:border-zinc-500 outline-none text-center"
                      placeholder="Custom"
                    />
                  </div>
                </div>
              </div>

              {/* Live Chrome Toggle */}
              <div className="flex items-center justify-between p-2.5 bg-zinc-900/60 rounded-lg border border-zinc-800">
                <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-zinc-400" />
                  Visible Browser:
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.liveChrome}
                    disabled={isRunning}
                    onChange={(e) => onChangeConfig('liveChrome', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-200 after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-zinc-200 peer-checked:after:bg-zinc-950"></div>
                </label>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="p-2.5 bg-zinc-900/60 rounded-lg border border-zinc-800 flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-300">
                <input
                  type="checkbox"
                  checked={config.onlyNoWebsite}
                  disabled={isRunning}
                  onChange={(e) => onChangeConfig('onlyNoWebsite', e.target.checked)}
                  className="w-3.5 h-3.5 accent-zinc-100 rounded border-zinc-700"
                />
                <Globe className="w-3.5 h-3.5 text-zinc-400" />
                No Website Only
              </label>

              <label className="p-2.5 bg-zinc-900/60 rounded-lg border border-zinc-800 flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-300">
                <input
                  type="checkbox"
                  checked={config.deepExtraction}
                  disabled={isRunning}
                  onChange={(e) => onChangeConfig('deepExtraction', e.target.checked)}
                  className="w-3.5 h-3.5 accent-zinc-100 rounded border-zinc-700"
                />
                <Search className="w-3.5 h-3.5 text-zinc-400" />
                Deep Email/Phone Search
              </label>
            </div>

            {/* n8n Webhook */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-zinc-400" />
                n8n Webhook URL:
              </span>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={config.n8nWebhookUrl || ''}
                  onChange={(e) => onChangeConfig('n8nWebhookUrl', e.target.value)}
                  placeholder="https://..."
                  className="flex-1 bg-zinc-900 text-zinc-100 text-xs rounded-lg px-2.5 py-1.5 border border-zinc-800 outline-none font-mono"
                />
                <button
                  type="button"
                  disabled={!config.n8nWebhookUrl || isTestingWebhook}
                  onClick={handleTestWebhook}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg border border-zinc-700"
                >
                  {isTestingWebhook ? '...' : 'Test'}
                </button>
              </div>
              {webhookTestStatus && (
                <p className={`text-[11px] font-mono ${webhookTestStatus.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {webhookTestStatus.message}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Start / Stop Action Bar */}
      <div>
        {!isRunning && !isPaused ? (
          <button
            type="button"
            onClick={onStart}
            className="w-full py-3 px-5 bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <Play className="w-4 h-4 fill-current" />
            Start Lead Scanner ({config.targetLeads || 100} Companies)
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onPause}
              className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-xs rounded-xl border border-zinc-700 transition flex items-center justify-center gap-2"
            >
              <Pause className="w-4 h-4 fill-current" />
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              onClick={onStop}
              className="px-5 py-2.5 bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2"
            >
              <Square className="w-4 h-4 fill-current" />
              Stop
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

