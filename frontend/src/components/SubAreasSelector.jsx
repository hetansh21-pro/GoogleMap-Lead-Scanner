import React, { useState } from 'react';
import { Layers, Plus, MapPin, Trash2, X, Download, Tag } from 'lucide-react';
import { getSubLocationsForCity } from '../utils/subLocationsData';

export default function SubAreasSelector({
  selectedLocation,
  selectedSubLocations = [],
  onSelectSubLocations = () => {}
}) {
  const [inputText, setInputText] = useState('');
  const [showPresetPicker, setShowPresetPicker] = useState(false);

  const cityName = selectedLocation ? selectedLocation.split(',')[0].trim() : 'Selected Zone';
  const defaultCityAreas = getSubLocationsForCity(selectedLocation);

  const handleAddArea = () => {
    if (!inputText.trim()) return;
    const newAreas = inputText
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const merged = Array.from(new Set([...selectedSubLocations, ...newAreas]));
    onSelectSubLocations(merged);
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddArea();
    }
  };

  const handleRemoveSingleArea = (areaToRemove) => {
    onSelectSubLocations(selectedSubLocations.filter(a => a !== areaToRemove));
  };

  const handleClearAll = () => {
    onSelectSubLocations([]);
  };

  const handleLoadCityPresets = () => {
    onSelectSubLocations(defaultCityAreas);
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
    <div className="google-card p-5 space-y-4 shadow-xs">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#eee9dd] pb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center font-bold">
            <Tag className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-extrabold text-gray-900 flex items-center gap-2 tracking-tight">
              <span>Manual Sub-Areas Selector</span>
              <span className="text-[#1a73e8] font-bold">({cityName})</span>
            </h2>
            <p className="text-[11px] text-gray-500">
              Type custom sub-areas or load suggested presets for target location scanning
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleLoadCityPresets}
            className="px-3 py-1.5 rounded-full bg-[#faf8f3] hover:bg-white text-gray-700 text-xs font-semibold border border-[#dcd6c8] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#1a73e8]" />
            Load {cityName} Presets ({defaultCityAreas.length})
          </button>

          {!isEmpty && (
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 rounded-full bg-red-50 hover:bg-red-100 text-[#ea4335] text-xs font-semibold border border-red-200 transition flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All ({selectedSubLocations.length})
            </button>
          )}
        </div>
      </div>

      {/* Manual Input Bar */}
      <div className="flex items-center gap-2 bg-[#f8f5ee] p-2 rounded-2xl border border-[#e2ddd0]">
        <div className="pl-2 text-gray-400">
          <MapPin className="w-4 h-4 text-[#1a73e8]" />
        </div>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Add manual area for ${cityName} (e.g. Navrangpura, Market Yard) & press Enter...`}
          className="w-full bg-white text-gray-900 text-xs rounded-xl px-3 py-2 border border-[#dcd6c8] focus:border-[#1a73e8] outline-none font-sans shadow-xs"
        />
        <button
          type="button"
          onClick={handleAddArea}
          className="px-4 py-2 google-btn-blue text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Area
        </button>
      </div>

      {/* Active Tag Chips List */}
      {!isEmpty ? (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="font-semibold text-gray-700">Selected Sub-Areas ({selectedSubLocations.length} active):</span>
            <button
              type="button"
              onClick={() => setShowPresetPicker(!showPresetPicker)}
              className="text-[11px] text-[#1a73e8] hover:underline font-semibold"
            >
              {showPresetPicker ? 'Hide Presets Picker' : '+ Pick from City Presets List'}
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto pr-1 flex flex-wrap gap-1.5 no-scrollbar py-1">
            {selectedSubLocations.map((area) => (
              <span
                key={area}
                className="px-3 py-1 rounded-full text-xs font-semibold bg-[#e8f0fe] text-[#1a73e8] border border-[#aecbfa] flex items-center gap-1.5 shadow-xs"
              >
                <span>{area}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSingleArea(area)}
                  className="w-4 h-4 rounded-full bg-white hover:bg-red-100 text-[#1a73e8] hover:text-red-600 flex items-center justify-center transition cursor-pointer"
                  title="Remove area"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-5 text-center bg-[#faf8f3] rounded-2xl border border-dashed border-[#e2ddd0] space-y-2">
          <h3 className="text-xs font-bold text-gray-800">No Sub-Areas Added Yet</h3>
          <p className="text-[11px] text-gray-500">
            Type custom area names above or click the button below to load preset areas for {cityName}.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={handleLoadCityPresets}
              className="px-4 py-1.5 google-btn-blue text-xs shadow cursor-pointer inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Load {cityName} Presets ({defaultCityAreas.length})
            </button>
          </div>
        </div>
      )}

      {/* Preset Picker Dropdown / Drawer */}
      {showPresetPicker && (
        <div className="p-3 bg-[#f9f6f0] rounded-2xl border border-[#e2ddd0] space-y-2 pt-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
            <span>City Presets ({cityName}):</span>
            <button
              type="button"
              onClick={() => setShowPresetPicker(false)}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕ Close
            </button>
          </div>
          <div className="max-h-36 overflow-y-auto pr-1 flex flex-wrap gap-1 no-scrollbar">
            {defaultCityAreas.map((area) => {
              const isSelected = selectedSubLocations.includes(area);
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => handleTogglePresetItem(area)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#1a73e8] text-white border-[#1a73e8] font-bold'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {isSelected ? `✓ ${area}` : `+ ${area}`}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
