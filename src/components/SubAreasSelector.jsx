import React, { useState } from 'react';
import { Layers, Plus, RotateCcw, MapPin, Trash2, X, Download } from 'lucide-react';
import { getSubLocationsForCity } from '../utils/subLocationsData';

export default function SubAreasSelector({
  selectedLocation,
  selectedSubLocations = [],
  onSelectSubLocations = () => {},
  isBulkMode = true,
  onToggleBulkMode = () => {}
}) {
  const [showCustomAreaInput, setShowCustomAreaInput] = useState(false);
  const [customAreaText, setCustomAreaText] = useState('');
  const [showPresetPicker, setShowPresetPicker] = useState(false);

  const cityName = selectedLocation ? selectedLocation.split(',')[0].trim() : 'Ahmedabad';
  const defaultCityAreas = getSubLocationsForCity(selectedLocation);

  const handleRemoveSingleArea = (areaToRemove) => {
    onSelectSubLocations(selectedSubLocations.filter(a => a !== areaToRemove));
  };

  const handleClearAll = () => {
    onSelectSubLocations([]);
  };

  const handleLoadCityPresets = () => {
    onSelectSubLocations(defaultCityAreas);
  };

  const handleAddCustomBulkAreas = () => {
    if (!customAreaText.trim()) return;
    const newAreas = customAreaText
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const merged = Array.from(new Set([...selectedSubLocations, ...newAreas]));
    onSelectSubLocations(merged);
    setCustomAreaText('');
    setShowCustomAreaInput(false);
  };

  const handleTogglePresetItem = (areaStr) => {
    if (selectedSubLocations.includes(areaStr)) {
      onSelectSubLocations(selectedSubLocations.filter(a => a !== areaStr));
    } else {
      onSelectSubLocations([...selectedSubLocations, areaStr]);
    }
  };

  const isEmpty = selectedSubLocations.length === 0;

  return (
    <div className="minimal-card p-5 space-y-4 shadow-sm border border-zinc-800 bg-zinc-950">
      {/* Header & Main Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shadow-sm">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2 tracking-tight">
              Small & Big Sub-Areas
              <span className="text-emerald-400 font-mono text-xs">({cityName})</span>
            </h2>
            <p className="text-[11px] text-zinc-400">
              Bulk scanning iterates across all active sub-locations in parallel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Load Preset City Areas Button */}
          <button
            type="button"
            onClick={handleLoadCityPresets}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold border border-zinc-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            Load {cityName} Areas ({defaultCityAreas.length})
          </button>

          {/* Add Custom Area Button */}
          <button
            type="button"
            onClick={() => setShowCustomAreaInput(true)}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            + Add Custom Area(s)
          </button>

          {/* Clear All Button */}
          {!isEmpty && (
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-xs font-medium border border-rose-800 transition flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All ({selectedSubLocations.length})
            </button>
          )}
        </div>
      </div>

      {/* Add Custom Area Input Drawer */}
      {showCustomAreaInput && (
        <div className="p-3 bg-zinc-900/90 rounded-xl border border-zinc-800 space-y-2.5 animate-fadeIn">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
            <span>Enter / Paste Custom Sub-Locations (comma or line separated):</span>
            <button
              type="button"
              onClick={() => setShowCustomAreaInput(false)}
              className="text-zinc-400 hover:text-zinc-200 text-xs"
            >
              ✕ Close
            </button>
          </div>
          <textarea
            rows={3}
            value={customAreaText}
            onChange={(e) => setCustomAreaText(e.target.value)}
            placeholder="Type or paste custom areas (e.g. Navrangpura, Satellite, SG Highway, Prahlad Nagar, Vastrapur)..."
            className="w-full bg-zinc-950 text-zinc-100 text-xs rounded-lg p-2.5 border border-zinc-800 focus:border-zinc-500 outline-none font-mono"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCustomAreaInput(false)}
              className="px-3 py-1.5 text-xs text-zinc-400 bg-zinc-950 rounded-lg border border-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddCustomBulkAreas}
              className="px-4 py-1.5 text-xs font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow transition cursor-pointer"
            >
              Add to Active List
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE SUB-AREAS CHIPS GRID (Shows ONLY selected/added areas!) */}
      {!isEmpty ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Active Bulk Scan Sub-Areas ({selectedSubLocations.length} active):</span>
            <button
              type="button"
              onClick={() => setShowPresetPicker(!showPresetPicker)}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-mono"
            >
              {showPresetPicker ? 'Hide City Presets List' : '+ Pick from City Presets'}
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto pr-1 flex flex-wrap gap-1.5 custom-scrollbar py-1">
            {selectedSubLocations.map((area) => (
              <span
                key={area}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 shadow-sm flex items-center gap-1.5 group"
              >
                <span>{area}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSingleArea(area)}
                  className="w-4 h-4 rounded-full bg-emerald-900/60 hover:bg-rose-900 text-emerald-300 hover:text-rose-200 flex items-center justify-center transition cursor-pointer"
                  title="Remove area"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : (
        /* CLEAN EMPTY STATE - NOT SHOWING ANYTHING BLANK OR UNCHECKED! */
        <div className="p-8 text-center bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800 space-y-3">
          <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 flex items-center justify-center mx-auto">
            <Layers className="w-5 h-5 text-zinc-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-300">No Sub-Areas Active</h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              The scanner will search city-wide for <strong>"{cityName}"</strong>. Add custom areas or load preset city areas below.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleLoadCityPresets}
              className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-semibold text-xs rounded-lg border border-zinc-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Load {cityName} Presets ({defaultCityAreas.length})
            </button>
            <button
              type="button"
              onClick={() => setShowCustomAreaInput(true)}
              className="px-3.5 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-bold text-xs rounded-lg shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add Custom Area
            </button>
          </div>
        </div>
      )}

      {/* Preset Picker Drawer (if user clicks "+ Pick from City Presets") */}
      {showPresetPicker && (
        <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-2 pt-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
            <span>City Presets ({cityName}):</span>
            <button
              type="button"
              onClick={() => setShowPresetPicker(false)}
              className="text-zinc-400 hover:text-zinc-200 text-xs"
            >
              ✕ Close
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto pr-1 flex flex-wrap gap-1 custom-scrollbar">
            {defaultCityAreas.map((area) => {
              const isSelected = selectedSubLocations.includes(area);
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => handleTogglePresetItem(area)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium border transition cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700 font-semibold'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {isSelected ? `✓ ${area}` : `+ ${area}`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        <div className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-zinc-400" />
          <span>Active sub-areas: {selectedSubLocations.length}</span>
        </div>
        <span>Parallel worker tabs distribute queries across all active sub-areas</span>
      </div>
    </div>
  );
}
