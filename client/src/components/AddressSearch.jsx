// client/src/components/AddressSearch.jsx
// Reusable OpenStreetMap / Nominatim geocoding address search component with usage compliance

import { useState, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search,
  Loader2,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from 'lucide-react';

export default function AddressSearch({
  onSelect,
  onClear,
  selectedLabel,
  selectedCoordinates,
  placeholder = 'e.g. Cubbon Park, Bengaluru',
  label = 'Search Address or Landmark',
  privacyNotice,
  clearButtonText = 'Remove location',
  showCoordinates = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const searchRequestIdRef = useRef(0);

  const handleSearchAddress = async () => {
    const query = searchQuery.trim();
    if (query.length < 3) return;

    setSearching(true);
    setSearchError(null);
    setSearchResults(null);
    const requestId = ++searchRequestIdRef.current;

    try {
      const data = await apiFetch(`/api/geocode?q=${encodeURIComponent(query)}`);

      // Ignore response if superseded by a newer search
      if (requestId !== searchRequestIdRef.current) return;

      const rawResults = data?.results || [];
      const normalizedResults = rawResults.map((r) => {
        const lat = parseFloat(r.latitude ?? r.lat);
        const lng = parseFloat(r.longitude ?? r.lon);
        return {
          label: r.label || r.displayName || r.display_name || 'Selected Location',
          latitude: !Number.isNaN(lat) ? parseFloat(lat.toFixed(6)) : 0,
          longitude: !Number.isNaN(lng) ? parseFloat(lng.toFixed(6)) : 0,
        };
      });

      setSearchResults(normalizedResults);
    } catch (err) {
      if (requestId === searchRequestIdRef.current) {
        setSearchError(
          err.message ||
            'Address search is unavailable right now. You can enter coordinates manually.'
        );
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setSearching(false);
      }
    }
  };

  const handleSelect = (result) => {
    onSelect(result);
    setSearchResults(null);
    setSearchError(null);
  };

  return (
    <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
      <label className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
        <Search className="h-3.5 w-3.5 text-indigo-600" />
        {label}
      </label>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSearchAddress();
            }
          }}
          className="h-9 text-xs bg-white"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleSearchAddress}
          disabled={searching || searchQuery.trim().length < 3}
          className="h-9 text-xs px-3 shrink-0 gap-1.5 border-slate-300"
        >
          {searching ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="h-3.5 w-3.5" />
              Search address
            </>
          )}
        </Button>
      </div>

      {/* Selected Location Confirmation */}
      {selectedLabel && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 min-w-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-semibold">Location set: </span>
              <span className="break-words">{selectedLabel}</span>
              {showCoordinates && selectedCoordinates && (
                <span className="block text-[11px] text-emerald-600 mt-0.5">
                  Coordinates: {selectedCoordinates.lat}, {selectedCoordinates.lng}
                </span>
              )}
            </div>
          </div>
          {onClear && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-7 px-2 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0 gap-1"
            >
              <Trash2 className="h-3 w-3" />
              {clearButtonText}
            </Button>
          )}
        </div>
      )}

      {/* Search Results List */}
      {searchResults !== null && (
        <div className="space-y-1.5 pt-1">
          {searchResults.length === 0 ? (
            <p className="text-xs text-slate-500 py-1">
              No results found. Try adding the city, or enter coordinates manually.
            </p>
          ) : (
            <div className="space-y-1 max-h-36 overflow-y-auto">
              <p className="text-[11px] font-medium text-slate-600">Select matching location:</p>
              {searchResults.map((result, idx) => (
                <button
                  key={`${result.latitude}-${result.longitude}-${idx}`}
                  type="button"
                  onClick={() => handleSelect(result)}
                  className="w-full text-left p-2 rounded bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-xs text-slate-800 flex items-start gap-1.5 transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span className="line-clamp-2 leading-relaxed">{result.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search Error State */}
      {searchError && (
        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>{searchError}</span>
        </div>
      )}

      {/* Privacy Notice (if applicable) */}
      {privacyNotice && (
        <p className="text-[11px] text-slate-500 pt-0.5">{privacyNotice}</p>
      )}

      {/* Nominatim Attribution */}
      <p className="text-[10px] text-slate-400 pt-0.5">
        ©{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-600"
        >
          OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}
