import React, { useEffect, useRef } from 'react';

interface CompanyDE {
  id: string;
  company_name: string;
  address1?: string;
  city?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  contact_name?: string;
  email?: string;
  phone?: string;
  region?: string;
}

interface LeafletMapDEProps {
  companies: CompanyDE[];
  centerLocation: { lat: number; lng: number } | null;
  isochronePolygon: { lat: number; lng: number }[];
}

declare global {
  interface Window {
    L: any;
  }
}

const LeafletMapDE: React.FC<LeafletMapDEProps> = ({
  companies,
  centerLocation,
  isochronePolygon,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const isPointInPolygon = (point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]): boolean => {
    if (polygon.length < 3) return false;
    let inside = false;
    let j = polygon.length - 1;
    for (let i = 0; i < polygon.length; i++) {
      const xi = polygon[i].lat, yi = polygon[i].lng;
      const xj = polygon[j].lat, yj = polygon[j].lng;
      if (((yi > point.lng) !== (yj > point.lng)) &&
        (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
      j = i;
    }
    return inside;
  };

  useEffect(() => {
    if (!mapRef.current) return;

    const loadLeaflet = async () => {
      if (!window.L) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        return new Promise<void>((resolve) => {
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }
    };

    const initMap = async () => {
      await loadLeaflet();
      if (!window.L || !mapRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Centre par défaut : Allemagne
      const defaultCenter: [number, number] = [51.1657, 10.4515];
      const mapCenter: [number, number] = centerLocation
        ? [centerLocation.lat, centerLocation.lng]
        : defaultCenter;

      const map = window.L.map(mapRef.current).setView(mapCenter, centerLocation ? 8 : 6);
      mapInstanceRef.current = map;

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      if (centerLocation) {
        const centerIcon = window.L.divIcon({
          className: 'custom-center-icon',
          html: `<div style="background-color:#ef4444;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        window.L.marker([centerLocation.lat, centerLocation.lng], { icon: centerIcon })
          .addTo(map)
          .bindPopup(`<strong>Point de départ</strong>`);
      }

      if (isochronePolygon.length > 0) {
        const polygonCoords = isochronePolygon.map(p => [p.lat, p.lng]);
        window.L.polygon(polygonCoords, {
          color: '#3b82f6', weight: 2, opacity: 0.8,
          fillColor: '#3b82f6', fillOpacity: 0.2,
        }).addTo(map);
      }

      const createIcon = (color: string) => window.L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color:${color};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      const inZoneIcon = createIcon('#10b981');
      const outZoneIcon = createIcon('#f59e0b');

      companies.forEach((company) => {
        if (!company.latitude || !company.longitude) return;
        const inZone = isochronePolygon.length > 0
          ? isPointInPolygon({ lat: company.latitude, lng: company.longitude }, isochronePolygon)
          : false;
        const icon = inZone ? inZoneIcon : outZoneIcon;

        window.L.marker([company.latitude, company.longitude], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="max-width:250px;">
              <h3 style="margin:0 0 8px;font-weight:bold;">${company.company_name}</h3>
              ${company.contact_name ? `<p style="margin:4px 0;font-size:12px;color:#666;">Contact: ${company.contact_name}</p>` : ''}
              ${company.email ? `<p style="margin:4px 0;font-size:12px;color:#666;">E-mail: ${company.email}</p>` : ''}
              ${company.phone ? `<p style="margin:4px 0;font-size:12px;color:#666;">Tél: ${company.phone}</p>` : ''}
              <p style="margin:4px 0;font-size:12px;color:#666;">Ville: ${company.city || 'N/A'}</p>
              <p style="margin:4px 0;font-size:12px;color:#666;">CP: ${company.postal_code || 'N/A'}</p>
              ${company.region ? `<p style="margin:4px 0;font-size:12px;color:#666;">Région: ${company.region}</p>` : ''}
              <p style="margin:4px 0;font-size:12px;font-weight:bold;color:${inZone ? '#10b981' : '#f59e0b'};">
                ${inZone ? '✅ Dans la zone' : '⚠️ Hors zone'}
              </p>
            </div>
          `);
      });
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [companies, centerLocation, isochronePolygon]);

  const companiesInZone = companies.filter(c => {
    if (!c.latitude || !c.longitude || isochronePolygon.length === 0) return false;
    return isPointInPolygon({ lat: c.latitude, lng: c.longitude }, isochronePolygon);
  });

  return (
    <div className="w-full h-[600px] relative">
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg z-[1000]">
        <h4 className="font-semibold mb-2 text-sm">Légende</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Point de départ</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Dans la zone ({companiesInZone.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>Hors zone ({companies.length - companiesInZone.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 opacity-50" />
            <span>Zone isochrone</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t">
          <p className="text-xs text-gray-600">Total clients: {companies.length}</p>
        </div>
      </div>
    </div>
  );
};

export default LeafletMapDE;
