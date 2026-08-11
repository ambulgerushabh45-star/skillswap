"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

interface MapEventItem {
  id: string;
  title: string;
  location: string;
  lat: number;
  lng: number;
  dateTime: string;
}

export default function MapView({ events }: { events: MapEventItem[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Dynamically import Leaflet in browser environment
    import("leaflet").then((L) => {
      // Fix default Leaflet icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Default center (Boston/US coords or average of events)
      const defaultCenter: [number, number] = events.length > 0
        ? [events[0].lat, events[0].lng]
        : [42.3601, -71.0589];

      const container = mapRef.current;
      if (!container) return;

      if (!mapInstanceRef.current) {
        const map = L.map(container).setView(defaultCenter, 12);

        // OpenStreetMap free tile layer
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Add event markers
      events.forEach((ev) => {
        const popupContent = `
          <div style="font-family: sans-serif; padding: 4px;">
            <strong style="color: #4f46e5; font-size: 14px;">${ev.title}</strong><br/>
            <span style="font-size: 12px; color: #64748b;">📍 ${ev.location}</span><br/>
            <span style="font-size: 11px; color: #059669;">📅 ${new Date(ev.dateTime).toLocaleDateString()}</span>
          </div>
        `;

        L.marker([ev.lat, ev.lng])
          .addTo(map)
          .bindPopup(popupContent);
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [events]);

  return (
    <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-slate-200 shadow-sm relative z-0">
      <div ref={mapRef} className="w-full h-full min-h-[400px]" />
    </div>
  );
}
