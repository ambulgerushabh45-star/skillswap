// client/src/components/MapView.jsx
// Interactive Leaflet map rendering event locations and popups safely

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix Leaflet default marker icon paths in bundled environments
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

/**
 * Creates a DOM node for the Leaflet popup with plain text content to avoid XSS injection.
 */
function createSafePopupContent(ev) {
  const container = document.createElement('div');
  container.style.fontFamily = 'sans-serif';
  container.style.padding = '4px';

  // Title (escaped as textContent)
  const titleEl = document.createElement('strong');
  titleEl.style.color = '#4f46e5';
  titleEl.style.fontSize = '14px';
  titleEl.style.display = 'block';
  titleEl.textContent = ev.title || 'Untitled Event';
  container.appendChild(titleEl);

  // Status badge if cancelled or full
  if (ev.cancelled) {
    const badge = document.createElement('span');
    badge.style.display = 'inline-block';
    badge.style.fontSize = '10px';
    badge.style.fontWeight = 'bold';
    badge.style.color = '#dc2626';
    badge.style.backgroundColor = '#fee2e2';
    badge.style.padding = '1px 6px';
    badge.style.borderRadius = '4px';
    badge.style.marginTop = '2px';
    badge.style.marginBottom = '2px';
    badge.textContent = 'Cancelled';
    container.appendChild(badge);
  } else if (ev.isFull) {
    const badge = document.createElement('span');
    badge.style.display = 'inline-block';
    badge.style.fontSize = '10px';
    badge.style.fontWeight = 'bold';
    badge.style.color = '#d97706';
    badge.style.backgroundColor = '#fef3c7';
    badge.style.padding = '1px 6px';
    badge.style.borderRadius = '4px';
    badge.style.marginTop = '2px';
    badge.style.marginBottom = '2px';
    badge.textContent = 'Full';
    container.appendChild(badge);
  }

  // Location (escaped as textContent)
  if (ev.location) {
    const locEl = document.createElement('div');
    locEl.style.fontSize = '12px';
    locEl.style.color = '#64748b';
    locEl.style.marginTop = '2px';
    locEl.textContent = `📍 ${ev.location}`;
    container.appendChild(locEl);
  }

  // Date (escaped as textContent)
  if (ev.dateTime) {
    const dateEl = document.createElement('div');
    dateEl.style.fontSize = '11px';
    dateEl.style.color = '#059669';
    dateEl.style.marginTop = '2px';
    dateEl.textContent = `📅 ${new Date(ev.dateTime).toLocaleDateString()}`;
    container.appendChild(dateEl);
  }

  return container;
}

export default function MapView({ events = [] }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  // Initialize map instance once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default center: Bangalore coordinates as configured in seed / fallback
      const defaultCenter = [12.9716, 77.5946];
      const map = L.map(mapContainerRef.current).setView(defaultCenter, 12);

      // OpenStreetMap tile layer with required attribution
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;

      // Invalidate size once rendered
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 100);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, []);

  // Update markers when events change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    // Clear previous markers
    layer.clearLayers();

    // Filter events with valid numeric coordinates (guard against null/undefined/empty where Number(null) is 0)
    const validEvents = events.filter((ev) => {
      if (ev.lat == null || ev.lng == null || ev.lat === '' || ev.lng === '') {
        return false;
      }
      const lat = Number(ev.lat);
      const lng = Number(ev.lng);
      return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    });

    if (validEvents.length === 0) {
      return;
    }

    validEvents.forEach((ev) => {
      const marker = L.marker([Number(ev.lat), Number(ev.lng)]);
      const popupContent = createSafePopupContent(ev);
      marker.bindPopup(popupContent);
      marker.addTo(layer);
    });

    // Adjust view to fit markers
    if (validEvents.length === 1) {
      map.setView([Number(validEvents[0].lat), Number(validEvents[0].lng)], 13);
    } else {
      const bounds = L.latLngBounds(
        validEvents.map((ev) => [Number(ev.lat), Number(ev.lng)])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }

    map.invalidateSize();
  }, [events]);

  return (
    <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-slate-200 shadow-sm relative z-0">
      <div
        ref={mapContainerRef}
        data-testid="leaflet-map-container"
        className="w-full h-full min-h-[400px]"
      />
    </div>
  );
}
