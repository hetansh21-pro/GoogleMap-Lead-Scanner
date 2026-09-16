import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Cpu, Eye, Globe, Search, Send, Target, Settings, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { BACKEND_URL } from '../config';

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

  const PRESET_GOALS = [50, 100, 250, 500, 1000];
  const currentGoal = parseInt(config.targetLeads) || parseInt(config.maxResults) || 100;
  const isPresetActive = PRESET_GOALS.includes(currentGoal);

  // Custom input state: empty when preset is selected so "Custom" placeholder shows, or shows custom number
  const [customInputValue, setCustomInputValue] = useState(
    isPresetActive ? '' : String(currentGoal)
  );

  // Sync when preset changes or config changes externally
  useEffect(() => {
    const val = parseInt(config.targetLeads) || parseInt(config.maxResults) || 100;
    if (PRESET_GOALS.includes(val)) {
      setCustomInputValue('');
    } else {
      setCustomInputValue(String(val));
    }
  }, [config.targetLeads, config.maxResults]);

  const handleSelectPreset = (num) => {
    setCustomInputValue('');
    onChangeConfig('targetLeads', num);
    onChangeConfig('maxResults', num);
  };

  const handleCustomChange = (e) => {
    const raw = e.target.value;
    // Allow empty string while actively typing so user can backspace freely
    if (raw === '') {
      setCustomInputValue('');
      return;
    }
    const digitsOnly = raw.replace(/\D/g, '');
    setCustomInputValue(digitsOnly);

    if (digitsOnly) {
      const num = parseInt(digitsOnly, 10);
      if (num > 0) {
        const clamped = Math.min(50000, num);
        onChangeConfig('targetLeads', clamped);
        onChangeConfig('maxResults', clamped);
      }
    }
  };

  const handleCustomBlur = () => {
    if (!customInputValue || parseInt(customInputValue, 10) < 1) {
      handleSelectPreset(100);
    } else {
      const num = Math.min(50000, Math.max(1, parseInt(customInputValue, 10)));
      setCustomInputValue(String(num));
      onChangeConfig('targetLeads', num);
      onChangeConfig('maxResults', num);
    }
  };

  const handleCustomKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  const handleTestWebhook = async () => {
    if (!config.n8nWebhookUrl) return;
    setIsTestingWebhook(true);
    setWebhookTestStatus(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/test-n8n`, {
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
      {/* Target Leads Count (Small & Compact Layout) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-gray-800 tracking-tight flex items-center gap-1.5">
            <Target className="w-4 h-4 text-[#1a73e8]" />
            <span>Target Goal (Leads Count)</span>
          </label>
          <span className="text-xs font-bold text-[#1a73e8]">
            {currentGoal} Leads
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {PRESET_GOALS.map((num) => {
            const isSelected = isPresetActive && currentGoal === num;
            return (
              <button
                key={num}
                type="button"
                disabled={isRunning}
                onClick={() => handleSelectPreset(num)}
                className={`py-1.5 px-2 rounded-full text-xs font-medium border transition-all cursor-pointer text-center ${
                  isSelected
                    ? 'bg-[#1a73e8] text-white border-[#1a73e8] font-bold shadow-sm'
                    : 'bg-[#faf8f3] border-[#e2ddd0] text-gray-700 hover:bg-white'
                }`}
              >
                {num}
              </button>
            );
          })}
          <div className="w-full">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={isRunning}
              value={customInputValue}
              onChange={handleCustomChange}
              onBlur={handleCustomBlur}
              onKeyDown={handleCustomKeyDown}
              placeholder="Custom"
              className={`w-full text-xs font-semibold rounded-full px-2 py-1.5 border outline-none text-center shadow-xs transition-all ${
                !isPresetActive && customInputValue
                  ? 'bg-white text-[#1a73e8] border-[#1a73e8] ring-2 ring-[#1a73e8]/20 font-bold'
                  : 'bg-[#faf8f3] text-gray-700 border-[#e2ddd0] placeholder-gray-400 focus:bg-white focus:border-[#1a73e8]'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Website Filter */}
      <div className="space-y-2 pt-2 border-t border-[#eee9dd]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <label className="text-xs font-bold text-gray-800 tracking-tight flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-[#1a73e8]" />
            <span>Website Target Filter</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            disabled={isRunning}
            onClick={() => {
              onChangeConfig('websiteFilter', 'all');
              onChangeConfig('onlyNoWebsite', false);
            }}
            className={`py-2 px-3 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              (config.websiteFilter === 'all' || (!config.websiteFilter && !config.onlyNoWebsite))
                ? 'bg-[#1a73e8] text-white border-[#1a73e8] font-bold shadow-sm'
                : 'bg-[#faf8f3] border-[#e2ddd0] text-gray-700 hover:bg-white'
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
            className={`py-2 px-3 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              (config.websiteFilter === 'no_website' || config.onlyNoWebsite)
                ? 'bg-[#ea4335] text-white border-[#ea4335] font-bold shadow-sm'
                : 'bg-[#faf8f3] border-[#e2ddd0] text-gray-700 hover:bg-white'
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
            className={`py-2 px-3 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              config.websiteFilter === 'has_website'
                ? 'bg-[#34a853] text-white border-[#34a853] font-bold shadow-sm'
                : 'bg-[#faf8f3] border-[#e2ddd0] text-gray-700 hover:bg-white'
            }`}
          >
            <span>🔗</span>
            Has Website Only
          </button>
        </div>
      </div>

      {/* Advanced Settings Accordion */}
      <div className="border-t border-[#eee9dd] pt-2.5">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between text-xs font-semibold text-gray-700 hover:text-[#1a73e8] transition py-1 cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-[#1a73e8]" />
            Advanced Engine Config ({config.workerCount} Tabs, Webhook)
          </span>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="mt-3 p-3.5 bg-[#f9f6f0] rounded-2xl border border-[#e2ddd0] space-y-4">
            {/* Parallel Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 font-medium flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-[#1a73e8]" />
                    Parallel Worker Tabs:
                  </span>
                  <span className="text-[#1a73e8] font-bold">{config.workerCount} Tabs</span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {[1, 2, 3, 4, 6, 8, 12].map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={isRunning}
                      onClick={() => onChangeConfig('workerCount', num)}
                      className={`py-1 px-2.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                        config.workerCount === num
                          ? 'bg-[#1a73e8] text-white border-[#1a73e8]'
                          : 'bg-white border-[#dcd6c8] text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {num}W
                    </button>
                  ))}
                </div>
              </div>

              {/* Show Live Chrome Window ON/OFF Toggle */}
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#e2ddd0] shadow-xs">
                <span className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-[#1a73e8]" />
                  Show Live Chrome Window:
                </span>

                <button
                  type="button"
                  onClick={() => onChangeConfig('liveChrome', !config.liveChrome)}
                  className="flex items-center gap-2 cursor-pointer group outline-none"
                  title="Turn ON to show Chrome browser window, turn OFF for background mode"
                >
                  <span className={`text-xs font-extrabold transition-colors ${config.liveChrome ? 'text-[#34a853]' : 'text-gray-500'}`}>
                    {config.liveChrome ? 'ON (Visible)' : 'OFF (Background)'}
                  </span>

                  {/* Sliding ON / OFF Switch */}
                  <div
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                      config.liveChrome ? 'bg-[#34a853]' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                        config.liveChrome ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </button>
              </div>
            </div>

            {/* n8n Webhook */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-[#1a73e8]" />
                n8n Webhook URL:
              </span>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={config.n8nWebhookUrl || ''}
                  onChange={(e) => onChangeConfig('n8nWebhookUrl', e.target.value)}
                  placeholder="https://your-n8n-instance.com/webhook/..."
                  className="flex-1 bg-white text-gray-900 text-xs rounded-full px-3.5 py-2 border border-[#dcd6c8] outline-none"
                />
                <button
                  type="button"
                  disabled={!config.n8nWebhookUrl || isTestingWebhook}
                  onClick={handleTestWebhook}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-full border border-gray-300 transition cursor-pointer"
                >
                  {isTestingWebhook ? '...' : 'Test'}
                </button>
              </div>
              {webhookTestStatus && (
                <p className={`text-[11px] font-mono ${webhookTestStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                  {webhookTestStatus.message}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ULTRA HIGH-VISIBILITY SEARCH LEADS CTA BUTTON */}
      <div className="pt-2">
        {!isRunning && !isPaused ? (
          <button
            type="button"
            onClick={onStart}
            className="w-full py-4 px-6 search-leads-cta-btn flex items-center justify-center gap-2.5 cursor-pointer shadow-lg"
          >
            <div className="w-6 h-6 rounded-full bg-[#fbbc05] text-gray-900 flex items-center justify-center font-bold shadow-sm shrink-0">
              <Search className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <span className="tracking-wide">SEARCH LEADS ({config.targetLeads || 100})</span>
          </button>
        ) : (
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onPause}
              className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-full border border-gray-300 transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Pause className="w-4 h-4 fill-current" />
              {isPaused ? 'Resume Search' : 'Pause Search'}
            </button>
            <button
              type="button"
              onClick={onStop}
              className="px-6 py-3.5 bg-[#ea4335] hover:bg-red-700 text-white font-bold text-xs rounded-full transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Square className="w-4 h-4 fill-current" />
              Stop Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
