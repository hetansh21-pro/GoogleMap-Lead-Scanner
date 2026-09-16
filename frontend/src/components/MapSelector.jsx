import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, Layers, Loader2, Sparkles, X, Building2, Compass } from 'lucide-react';
import { getSubLocationsForCity, fetchRadiusSubAreas, POPULAR_AREAS_PRESETS } from '../utils/subLocationsData';

const PRESET_CITIES = [
  { name: 'Unjha, Gujarat', lat: 23.8044, lng: 72.3924 },
  { name: 'Ahmedabad, India', lat: 23.0225, lng: 72.5714 },
  { name: 'Mumbai, India', lat: 19.0760, lng: 72.8777 },
  { name: 'New York, USA', lat: 40.7128, lng: -74.0060 },
  { name: 'London, UK', lat: 51.5074, lng: -0.1278 },
  { name: 'Dubai, UAE', lat: 25.2048, lng: 55.2708 }
];

const GOOGLE_TILE_LAYERS = {
  roadmap: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  satellite: 'https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',
  terrain: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'
};

export default function MapSelector({
  selectedLocation,
  onSelectLocation,
  selectedCoords,
  onSelectCoords,
  selectedSubLocations = [],
  onSelectSubLocations = () => {},
  isBulkMode = true,
  onToggleBulkMode = () => {}
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  const [mapType, setMapType] = useState('roadmap');
  const [searchQuery, setSearchQuery] = useState(selectedLocation || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingSubAreas, setIsFetchingSubAreas] = useState(false);

  // Sync searchQuery when external selectedLocation changes
  useEffect(() => {
    if (selectedLocation && !showSuggestions) {
      setSearchQuery(selectedLocation);
    }
  }, [selectedLocation]);

  // Click outside to close autocomplete dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = selectedCoords?.lat || 23.0225;
    const initialLng = selectedCoords?.lng || 72.5714;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 13,
      zoomControl: true
    });

    const tileLayer = L.tileLayer(GOOGLE_TILE_LAYERS[mapType], {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps'
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // 5 km Radius Circle
    const circle = L.circle([initialLat, initialLng], {
      color: '#1a73e8',
      fillColor: '#1a73e8',
      fillOpacity: 0.12,
      weight: 2,
      dashArray: '4, 4',
      radius: 5000
    }).addTo(map);
    circleRef.current = circle;

    const markerIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div class="radar-marker-ring-google"></div>
          <div style="width: 22px; height: 22px; background: #ea4335; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.4); z-index: 10;"></div>
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    const marker = L.marker([initialLat, initialLng], { icon: markerIcon }).addTo(map);
    markerRef.current = marker;
    mapInstanceRef.current = map;

    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      if (circleRef.current) circleRef.current.setLatLng([lat, lng]);
      onSelectCoords({ lat: lat.toFixed(5), lng: lng.toFixed(5) });

      try {
        let locName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

        // 1. Try backend reverse geocoding proxy
        let reverseData = null;
        try {
          const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
          if (res.ok) reverseData = await res.json();
        } catch (e) {}

        // 2. Direct Photon fallback
        if (!reverseData || !reverseData.name) {
          try {
            const photonRes = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`);
            if (photonRes.ok) {
              const photonJson = await photonRes.json();
              if (photonJson?.features?.[0]?.properties) {
                const p = photonJson.features[0].properties;
                const parts = [p.name, p.district || p.suburb || p.street, p.city, p.state, p.country].filter(Boolean);
                locName = Array.from(new Set(parts)).slice(0, 3).join(', ');
              }
            }
          } catch (e) {}
        } else if (reverseData.displayName) {
          locName = reverseData.displayName.split(',').slice(0, 3).join(', ');
        }

        setSearchQuery(locName);
        onSelectLocation(locName);
        updateSubLocationsForNewLocation(locName, { lat, lng });
      } catch (err) {
        const fallbackStr = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setSearchQuery(fallbackStr);
        onSelectLocation(fallbackStr);
        updateSubLocationsForNewLocation(fallbackStr, { lat, lng });
      }
    });

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 300);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleSwitchMapType = (typeKey) => {
    setMapType(typeKey);
    if (tileLayerRef.current && mapInstanceRef.current) {
      tileLayerRef.current.setUrl(GOOGLE_TILE_LAYERS[typeKey]);
    }
  };

  const updateSubLocationsForNewLocation = async (locName, coords) => {
    setIsFetchingSubAreas(true);

    // 1. INSTANTLY wipe old sub-areas and set the target location's exact sub-areas synchronously!
    const syncSubAreas = getSubLocationsForCity(locName);
    onSelectSubLocations(syncSubAreas);

    // 2. Asynchronously fetch additional radius sub-areas if available
    const targetLat = coords?.lat || selectedCoords?.lat || 23.0225;
    const targetLng = coords?.lng || selectedCoords?.lng || 72.5714;
    try {
      const fetchedAreas = await fetchRadiusSubAreas(targetLat, targetLng, locName);
      if (fetchedAreas && fetchedAreas.length > 0) {
        onSelectSubLocations(fetchedAreas);
      }
    } catch (e) {}

    setIsFetchingSubAreas(false);
  };

  // Instant local match helper
  const getLocalMatches = (query) => {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const matches = [];
    const seen = new Set();

    // Match preset cities
    for (const city of PRESET_CITIES) {
      if (city.name.toLowerCase().includes(q)) {
        seen.add(city.name.toLowerCase());
        matches.push({
          id: `city_${city.name}`,
          name: city.name.split(',')[0],
          displayName: city.name,
          city: city.name.split(',')[0],
          lat: city.lat,
          lng: city.lng,
          type: 'city',
          isPreset: true
        });
      }
    }

    // Match popular area presets
    for (const item of POPULAR_AREAS_PRESETS) {
      const key = `${item.name.toLowerCase()}_${item.city.toLowerCase()}`;
      if (
        (item.name.toLowerCase().includes(q) || item.city.toLowerCase().includes(q)) &&
        !seen.has(key)
      ) {
        seen.add(key);
        matches.push({
          id: `preset_${item.name}`,
          name: item.name,
          displayName: `${item.name}, ${item.city}, ${item.state}`,
          suburb: item.name,
          city: item.city,
          state: item.state,
          country: item.country,
          lat: item.lat,
          lng: item.lng,
          type: 'area',
          isPreset: true
        });
      }
    }

    return matches.slice(0, 5);
  };

  // Fetch online geocode search results with location proximity bias
  const fetchOnlineGeocodes = async (query) => {
    const curLat = selectedCoords?.lat || 23.0225;
    const curLng = selectedCoords?.lng || 72.5714;

    try {
      // 1. Try backend proxy
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(query)}&lat=${curLat}&lng=${curLng}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.results) && data.results.length > 0) {
          return data.results;
        }
      }
    } catch (e) {}

    // 2. Direct client fallback to Photon
    try {
      const photonRes = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${curLat}&lon=${curLng}&limit=8`
      );
      if (photonRes.ok) {
        const json = await photonRes.json();
        if (json && Array.isArray(json.features)) {
          return json.features.map(f => {
            const p = f.properties || {};
            const coords = f.geometry?.coordinates || [];
            const parts = [p.name, p.district || p.suburb || p.street, p.city, p.state, p.country].filter(Boolean);
            return {
              id: p.osm_id || `${coords[1]}_${coords[0]}`,
              name: p.name || query,
              displayName: Array.from(new Set(parts)).join(', '),
              suburb: p.suburb || p.district || '',
              city: p.city || p.town || '',
              state: p.state || '',
              country: p.country || '',
              lat: coords[1],
              lng: coords[0],
              type: p.type || p.osm_value || 'area'
            };
          });
        }
      }
    } catch (e) {}

    return [];
  };

  // Handle typing in the search bar
  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSelectedIndex(-1);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
      return;
    }

    // Instant local matches first
    const instantMatches = getLocalMatches(trimmed);
    if (instantMatches.length > 0) {
      setSuggestions(instantMatches);
      setShowSuggestions(true);
    }

    // Debounced online geocoding
    setIsSearching(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const onlineResults = await fetchOnlineGeocodes(trimmed);

        // Merge local presets and online results (avoiding duplicates)
        const combined = [...instantMatches];
        const seenKeys = new Set(
          instantMatches.map(m => `${parseFloat(m.lat).toFixed(3)},${parseFloat(m.lng).toFixed(3)}`)
        );

        for (const item of onlineResults) {
          const key = `${parseFloat(item.lat).toFixed(3)},${parseFloat(item.lng).toFixed(3)}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            combined.push(item);
          }
        }

        setSuggestions(combined.slice(0, 8));
        setShowSuggestions(combined.length > 0);
      } finally {
        setIsSearching(false);
      }
    }, 250);
  };

  // Keyboard navigation inside search suggestions
  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSearchSubmit(e);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else {
        handleSearchSubmit(e);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Action when a suggestion is clicked or chosen
  const handleSelectSuggestion = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lng);
    const locName = item.displayName || `${item.name}, ${item.city || item.state || ''}`.replace(/,\s*$/, '');

    setSearchQuery(locName);
    setShowSuggestions(false);
    setSelectedIndex(-1);

    onSelectLocation(locName);
    onSelectCoords({ lat: lat.toFixed(5), lng: lng.toFixed(5) });
    updateSubLocationsForNewLocation(locName, { lat, lng });

    // Determine smart zoom based on type
    let targetZoom = 15; // default for neighborhood / suburb / street / area
    const typeStr = (item.type || '').toLowerCase();
    if (typeStr === 'city' || typeStr === 'town') {
      targetZoom = 13;
    } else if (typeStr === 'country' || typeStr === 'state') {
      targetZoom = 7;
    } else if (typeStr === 'street' || typeStr === 'building' || typeStr === 'house') {
      targetZoom = 16;
    }

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], targetZoom, { duration: 1.2 });
      markerRef.current.setLatLng([lat, lng]);
      if (circleRef.current) circleRef.current.setLatLng([lat, lng]);
    }
  };

  // Clear search query
  const handleClearSearch = () => {
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    if (inputRef.current) inputRef.current.focus();
  };

  // Direct search button or Enter trigger
  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    // If dropdown is open and has items, pick the first or selected
    if (showSuggestions && suggestions.length > 0) {
      const chosen = selectedIndex >= 0 ? suggestions[selectedIndex] : suggestions[0];
      handleSelectSuggestion(chosen);
      return;
    }

    setIsSearching(true);
    setShowSuggestions(false);

    try {
      const results = await fetchOnlineGeocodes(searchQuery.trim());
      if (results && results.length > 0) {
        handleSelectSuggestion(results[0]);
      } else {
        onSelectLocation(searchQuery);
        updateSubLocationsForNewLocation(searchQuery, selectedCoords);
      }
    } catch (err) {
      onSelectLocation(searchQuery);
      updateSubLocationsForNewLocation(searchQuery, selectedCoords);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCityPreset = (city) => {
    setSearchQuery(city.name);
    setShowSuggestions(false);
    onSelectLocation(city.name);
    onSelectCoords({ lat: city.lat, lng: city.lng });
    updateSubLocationsForNewLocation(city.name, { lat: city.lat, lng: city.lng });

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.flyTo([city.lat, city.lng], 13, { duration: 1 });
      markerRef.current.setLatLng([city.lat, city.lng]);
      if (circleRef.current) circleRef.current.setLatLng([city.lat, city.lng]);
    }
  };

  return (
    <div className="space-y-3 flex flex-col h-full">
      {/* Map Header & Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#eee9dd] pb-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#ea4335]" />
          <span className="text-xs font-bold text-gray-800">Target Area Radar & Live Map</span>
        </div>

        {/* Google Map Layer Switcher */}
        <div className="flex items-center gap-1 bg-[#f6f3eb] p-0.5 rounded-full border border-[#e2ddd0]">
          <button
            type="button"
            onClick={() => handleSwitchMapType('roadmap')}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition cursor-pointer ${
              mapType === 'roadmap' ? 'bg-[#1a73e8] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🗺️ Map
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMapType('satellite')}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition cursor-pointer ${
              mapType === 'satellite' ? 'bg-[#1a73e8] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🛰️ Satellite
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMapType('terrain')}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition cursor-pointer ${
              mapType === 'terrain' ? 'bg-[#1a73e8] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🏔️ Terrain
          </button>
        </div>
      </div>

      {/* Location Search Bar with Autocomplete Dropdown */}
      <div ref={searchContainerRef} className="relative z-30">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="Search area, neighborhood, street, or city (e.g. Prahlad Nagar, Bopal, Unjha, Andheri)..."
              className="w-full bg-white text-gray-900 placeholder-gray-400 text-xs rounded-full pl-9 pr-24 py-2.5 border border-[#dcd6c8] focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20 outline-none transition font-medium shadow-xs"
            />
            {isSearching ? (
              <Loader2 className="w-4 h-4 text-[#1a73e8] animate-spin absolute left-3 top-3" />
            ) : (
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            )}

            {/* Clear Button */}
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-20 top-2.5 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100 transition"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="submit"
              disabled={isSearching}
              className="absolute right-1 top-1 bottom-1 px-4 google-btn-blue text-xs cursor-pointer flex items-center justify-center font-bold"
            >
              Search
            </button>
          </div>
        </form>

        {/* Live Autocomplete Suggestions Dropdown */}
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-2xl border border-[#dcd6c8] overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="px-3.5 py-1.5 bg-[#f8f5ee] border-b border-[#eee9dd] flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              <span>Matching Areas & Places ({suggestions.length})</span>
              <span className="text-[9px] text-gray-400 font-normal">Press Enter or click to select</span>
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
              {suggestions.map((item, index) => {
                const isSelected = selectedIndex === index;
                const isCity = item.type === 'city' || item.type === 'town';

                return (
                  <button
                    key={item.id || index}
                    type="button"
                    onClick={() => handleSelectSuggestion(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition cursor-pointer ${
                      isSelected ? 'bg-[#e8f0fe]' : 'hover:bg-[#faf8f3]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`mt-0.5 shrink-0 p-1.5 rounded-lg ${
                        item.isPreset ? 'bg-amber-50 text-[#f29900]' : isCity ? 'bg-blue-50 text-[#1a73e8]' : 'bg-red-50 text-[#ea4335]'
                      }`}>
                        {item.isPreset ? (
                          <Sparkles className="w-3.5 h-3.5" />
                        ) : isCity ? (
                          <Building2 className="w-3.5 h-3.5" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {item.displayName || [item.suburb, item.city, item.state, item.country].filter(Boolean).join(', ')}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {item.isPreset ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#fef7e0] text-[#b06000] border border-[#fce8b2]">
                          Verified Area
                        </span>
                      ) : isCity ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-[#1a73e8] border border-blue-100">
                          City
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                          Area
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Dropdown Footer */}
            <div className="px-3 py-1.5 bg-[#faf8f3] border-t border-[#eee9dd] text-[10px] text-gray-400 flex items-center justify-between">
              <span>Use ↑ ↓ to navigate</span>
              <span>ESC to dismiss</span>
            </div>
          </div>
        )}
      </div>

      {/* Preset Quick Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {PRESET_CITIES.map((city) => (
          <button
            key={city.name}
            type="button"
            onClick={() => handleCityPreset(city)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              selectedLocation.toLowerCase().includes(city.name.split(',')[0].toLowerCase())
                ? 'bg-[#1a73e8] text-white border-[#1a73e8] font-bold shadow-xs'
                : 'bg-white border-[#e2ddd0] text-gray-700 hover:bg-[#faf8f3]'
            }`}
          >
            {city.name.split(',')[0]}
          </button>
        ))}
      </div>

      {/* Map Display Container */}
      <div className="flex-1 w-full min-h-[240px] sm:min-h-[280px] rounded-2xl overflow-hidden border border-[#dcd6c8] bg-[#f4efe6] relative shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* HUD Info Box */}
        <div className="absolute top-2.5 right-2.5 z-20 px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-xl border border-[#e2ddd0] text-[10px] font-sans text-gray-700 shadow-md space-y-1 pointer-events-none">
          <div className="flex items-center gap-1.5 text-[#ea4335] font-bold">
            <span className="w-2 h-2 rounded-full bg-[#ea4335] animate-pulse"></span>
            <span>Target Area Radar Active</span>
          </div>
          <div className="text-gray-900 font-semibold truncate max-w-[190px]" title={selectedLocation}>
            📍 {selectedLocation ? selectedLocation.split(',')[0] : 'Selected Area'}
          </div>
          <div className="text-[#1a73e8] font-bold flex items-center gap-1 text-[9px]">
            {isFetchingSubAreas ? (
              <>
                <Loader2 className="w-2.5 h-2.5 animate-spin text-[#1a73e8]" />
                <span>Updating Sub-Areas...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-2.5 h-2.5 text-[#fbbc05]" />
                <span>Sub-Areas Active ({selectedSubLocations.length})</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
