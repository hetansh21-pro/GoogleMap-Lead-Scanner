import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, Layers } from 'lucide-react';
import { getSubLocationsForCity } from '../utils/subLocationsData';

const PRESET_CITIES = [
  { name: 'Ahmedabad, India', lat: 23.0225, lng: 72.5714 },
  { name: 'Mumbai, India', lat: 19.0760, lng: 72.8777 },
  { name: 'New York, USA', lat: 40.7128, lng: -74.0060 },
  { name: 'London, UK', lat: 51.5074, lng: -0.1278 },
  { name: 'Dubai, UAE', lat: 25.2048, lng: 55.2708 },
  { name: 'Toronto, Canada', lat: 43.6532, lng: -79.3832 }
];

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
  const markerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState(selectedLocation || '');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = selectedCoords?.lat || 23.0225;
    const initialLng = selectedCoords?.lng || 72.5714;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 12,
      zoomControl: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    const markerIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `<div style="width: 18px; height: 18px; background: #ffffff; border-radius: 50%; border: 3.5px solid #09090b; box-shadow: 0 2px 8px rgba(0,0,0,0.6);"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    const marker = L.marker([initialLat, initialLng], { icon: markerIcon }).addTo(map);
    markerRef.current = marker;
    mapInstanceRef.current = map;

    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      onSelectCoords({ lat: lat.toFixed(5), lng: lng.toFixed(5) });

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        const address = data.display_name ? data.display_name.split(',').slice(0, 3).join(', ') : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setSearchQuery(address);
        onSelectLocation(address);
        updateSubLocationsForNewLocation(address);
      } catch (err) {
        const fallbackStr = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setSearchQuery(fallbackStr);
        onSelectLocation(fallbackStr);
      }
    });

    setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 300);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const updateSubLocationsForNewLocation = (locName) => {
    const defaultSubAreas = getSubLocationsForCity(locName);
    onSelectSubLocations(defaultSubAreas);
  };

  const handleCityPreset = (city) => {
    setSearchQuery(city.name);
    onSelectLocation(city.name);
    onSelectCoords({ lat: city.lat, lng: city.lng });
    updateSubLocationsForNewLocation(city.name);

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.flyTo([city.lat, city.lng], 13);
      markerRef.current.setLatLng([city.lat, city.lng]);
    }
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const first = data[0];
        const lat = parseFloat(first.lat);
        const lng = parseFloat(first.lon);
        const locName = first.display_name.split(',').slice(0, 3).join(', ');
        onSelectLocation(locName);
        onSelectCoords({ lat, lng });
        updateSubLocationsForNewLocation(locName);

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 13);
          markerRef.current.setLatLng([lat, lng]);
        }
      } else {
        onSelectLocation(searchQuery);
        updateSubLocationsForNewLocation(searchQuery);
      }
    } catch (err) {
      onSelectLocation(searchQuery);
      updateSubLocationsForNewLocation(searchQuery);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-3 flex flex-col h-full">
      {/* Header & Mode Status */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-zinc-300 tracking-tight flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-zinc-100" />
          City Location & Map Pin
        </label>

        <button
          type="button"
          onClick={() => onToggleBulkMode(!isBulkMode)}
          className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition flex items-center gap-1.5 cursor-pointer ${
            isBulkMode
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          {isBulkMode ? '⚡ Sub-Areas Bulk Mode ON' : 'Single Location Mode'}
        </button>
      </div>

      {/* Main Location Search Input */}
      <form onSubmit={handleSearchSubmit} className="relative flex items-center">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Enter city (e.g. Ahmedabad, Mumbai, New York)..."
          className="w-full bg-zinc-950 text-zinc-100 placeholder-zinc-500 text-xs rounded-lg pl-3 pr-16 py-2 border border-zinc-800 focus:border-zinc-500 focus:ring-0 outline-none font-medium transition"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="absolute right-1 px-3 py-1 bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs rounded transition cursor-pointer"
        >
          {isSearching ? '...' : 'Search'}
        </button>
      </form>

      {/* City Presets */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_CITIES.map((city) => (
          <button
            key={city.name}
            type="button"
            onClick={() => handleCityPreset(city)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer ${
              selectedLocation === city.name
                ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-bold'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700'
            }`}
          >
            {city.name.split(',')[0]}
          </button>
        ))}
      </div>

      {/* Map Display */}
      <div className="flex-1 w-full min-h-[220px] rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 relative shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
