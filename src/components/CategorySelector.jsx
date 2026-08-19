import React, { useState } from 'react';
import { Briefcase, Plus, X } from 'lucide-react';

const DEFAULT_PRESETS = [
  { id: 'plumber', label: 'Plumbers', query: 'Plumber & Plumbing Services' },
  { id: 'dentist', label: 'Dentists', query: 'Dental Clinic' },
  { id: 'restaurant', label: 'Restaurants', query: 'Restaurant & Cafe' },
  { id: 'realestate', label: 'Real Estate', query: 'Real Estate Agency' },
  { id: 'webdev', label: 'Web Dev', query: 'Web Design & Software Agency' },
  { id: 'gyms', label: 'Gyms & Fitness', query: 'Gym & Fitness Center' }
];

export default function CategorySelector({ selectedCategory, onSelectCategory, customCategory, onCustomCategoryChange }) {
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [inputText, setInputText] = useState(customCategory || '');

  const handleAddCategory = (e) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    // Check if category already exists
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
    <div className="space-y-2.5">
      <label className="text-xs font-semibold text-zinc-300 tracking-tight flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Briefcase className="w-4 h-4 text-zinc-100" />
          Business Category / Niche
        </span>
        <span className="text-[11px] text-zinc-500 font-mono">
          Selected: <span className="text-zinc-200 font-bold">{selectedCategory || 'None'}</span>
        </span>
      </label>

      {/* Input Form with Add Button */}
      <form onSubmit={handleAddCategory} className="relative flex items-center">
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder="Type custom category & press Enter or + Add..."
          className="w-full bg-zinc-950 text-zinc-100 placeholder-zinc-500 text-xs rounded-lg pl-3 pr-20 py-2 border border-zinc-800 focus:border-zinc-500 outline-none transition font-medium"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="absolute right-1 px-2.5 py-1 bg-zinc-100 hover:bg-white disabled:opacity-40 text-zinc-950 font-bold text-xs rounded transition flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </form>

      {/* Preset Chips */}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
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
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-bold'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700'
              }`}
            >
              <span>{cat.label}</span>
              {cat.isCustom && (
                <span
                  onClick={(e) => handleRemoveCustomPreset(e, cat.id)}
                  className="hover:text-rose-500 text-zinc-500 p-0.5 rounded transition"
                  title="Remove category"
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


