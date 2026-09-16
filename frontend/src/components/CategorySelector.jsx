import React, { useState } from 'react';
import { Briefcase, Plus, X } from 'lucide-react';

const DEFAULT_PRESETS = [
  { id: 'plumber', label: 'Plumbers', query: 'Plumber & Plumbing Services' },
  { id: 'dentist', label: 'Dentists', query: 'Dental Clinic' },
  { id: 'restaurant', label: 'Restaurants', query: 'Restaurant & Cafe' },
  { id: 'realestate', label: 'Real Estate', query: 'Real Estate Agency' },
  { id: 'webdev', label: 'Web Dev', query: 'Web Design & Software Agency' },
  { id: 'gyms', label: 'Gyms & Fitness', query: 'Gym & Fitness Center' },
  { id: 'electrician', label: 'Electricians', query: 'Electrical Contractor' },
  { id: 'hvac', label: 'HVAC Services', query: 'AC Repair & HVAC Services' },
  { id: 'auto', label: 'Car Repair', query: 'Auto Repair & Garage' },
  { id: 'lawyer', label: 'Lawyers', query: 'Law Firm & Advocate' }
];

export default function CategorySelector({ selectedCategory, onSelectCategory, customCategory, onCustomCategoryChange }) {
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [inputText, setInputText] = useState(customCategory || '');

  const handleAddCategory = (e) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    const existing = presets.find(
      (p) => p.label.toLowerCase() === trimmed.toLowerCase() || p.query.toLowerCase() === trimmed.toLowerCase()
    );

    if (existing) {
      onSelectCategory(existing.query);
    } else {
      const newPreset = {
        id: `custom_${Date.now()}`,
        label: trimmed,
        query: trimmed,
        isCustom: true
      };
      setPresets((prev) => [...prev, newPreset]);
      onSelectCategory(trimmed);
    }

    setInputText('');
    onCustomCategoryChange('');
  };

  const handleRemoveCustomPreset = (e, id) => {
    e.stopPropagation();
    setPresets((prev) => prev.filter((p) => p.id !== id));
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);
    onCustomCategoryChange(val);
    if (val.trim()) {
      onSelectCategory(val.trim());
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <label className="text-xs font-bold text-gray-800 tracking-tight flex items-center gap-1.5">
          <Briefcase className="w-4 h-4 text-[#1a73e8]" />
          <span>Business Category / Niche</span>
        </label>
        <span className="text-[11px] text-gray-500 font-sans">
          Selected: <strong className="text-[#1a73e8]">{selectedCategory || 'None'}</strong>
        </span>
      </div>

      <form onSubmit={handleAddCategory} className="relative flex items-center">
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder="Search or type custom niche (e.g. Roofers, Bakeries, Photographers)..."
          className="w-full bg-white text-gray-900 placeholder-gray-400 text-xs rounded-full pl-4 pr-20 py-2.5 border border-gray-300 focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20 outline-none transition font-medium shadow-sm"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="absolute right-1 px-3 py-1.5 google-btn text-xs rounded-full cursor-pointer flex items-center gap-1 shadow-sm disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5 pt-0.5 max-h-36 overflow-y-auto no-scrollbar">
        {presets.map((cat) => {
          const isSelected = selectedCategory === cat.query && !inputText.trim();
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setInputText('');
                onCustomCategoryChange('');
                onSelectCategory(cat.query);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-[#1a73e8] text-white border-[#1a73e8] font-bold shadow-sm'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{cat.label}</span>
              {cat.isCustom && (
                <span
                  onClick={(e) => handleRemoveCustomPreset(e, cat.id)}
                  className="hover:text-red-500 text-gray-400 p-0.5 rounded transition"
                  title="Remove"
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
