import React, { useEffect, useRef, useState } from 'react';
import { CompanyOrderPeriod } from '@/hooks/useCompanyOrderStats';
import { supabase } from '@/integrations/supabase/client';

interface Contact {
  sipi_number: string;
  contact_name?: string;
  email?: string;
  phone?: string;
}

interface LeafletMapProps {
  companies: CompanyOrderPeriod[];
  centerLocation: { lat: number; lng: number } | null;
  isochronePolygon: { lat: number; lng: number}[];
  maxThreshold: number;
}

declare global {
  interface Window {
    L: any;
  }
}

const LeafletMap: React.FC<LeafletMapProps> = ({ 
  companies, 
  centerLocation, 
  isochronePolygon, 
  maxThreshold 
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  // Plus besoin de charger les contacts séparément car ils sont déjà dans companies (décryptés)

  useEffect(() => {
    if (!mapRef.current) return;

    // Charger Leaflet dynamiquement
    const loadLeaflet = async () => {
      if (!window.L) {
        // Charger CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        // Charger JS
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

      // Nettoyer la carte existante
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Position par défaut (centre de la France)
      const defaultCenter: [number, number] = [46.603354, 1.888334];
      const mapCenter: [number, number] = centerLocation 
        ? [centerLocation.lat, centerLocation.lng] 
        : defaultCenter;

      // Créer la carte
      const map = window.L.map(mapRef.current).setView(mapCenter, centerLocation ? 8 : 6);
      mapInstanceRef.current = map;

      // Ajouter le fond de carte
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      // Ajouter le marqueur du centre
      if (centerLocation) {
        const centerIcon = window.L.divIcon({
          className: 'custom-center-icon',
          html: `<div style="
            background-color: #ef4444;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          "></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        window.L.marker([centerLocation.lat, centerLocation.lng], { icon: centerIcon })
          .addTo(map)
          .bindPopup(`
            <div>
              <strong>Point de départ</strong><br />
              ${centerLocation.lat.toFixed(6)}, ${centerLocation.lng.toFixed(6)}
            </div>
          `);
      }

      // Ajouter le polygone isochrone
      if (isochronePolygon.length > 0) {
        const polygonCoords = isochronePolygon.map(point => [point.lat, point.lng]);
        window.L.polygon(polygonCoords, {
          color: '#3b82f6',
          weight: 2,
          opacity: 0.8,
          fillColor: '#3b82f6',
          fillOpacity: 0.2,
        }).addTo(map);
      }

      // Classifier les entreprises et ajouter les marqueurs
      const companiesInZone: CompanyOrderPeriod[] = [];
      const companiesOutZone: CompanyOrderPeriod[] = [];

      companies.forEach((company) => {
        if (!company.latitude || !company.longitude) {
          companiesOutZone.push(company);
          return;
        }

        const isInside = isochronePolygon.length > 0 ? 
          isPointInPolygon({ lat: company.latitude, lng: company.longitude }, isochronePolygon) :
          false;
        
        const belowThreshold = company.maxAmount <= maxThreshold;

        // L'entreprise doit être dans la zone ET sous le seuil pour être considérée "dans la zone"
        if (isInside && belowThreshold) {
          companiesInZone.push(company);
        } else {
          companiesOutZone.push(company);
        }
      });

      // Créer les icônes
      const createCustomIcon = (color: string) => {
        return window.L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="
            background-color: ${color};
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          "></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
      };

      const inZoneIcon = createCustomIcon('#10b981');
      const outZoneIcon = createCustomIcon('#f59e0b');

      // Ajouter les marqueurs des entreprises dans la zone
      companiesInZone.forEach((company) => {
        if (company.latitude && company.longitude) {
          window.L.marker([company.latitude, company.longitude], { icon: inZoneIcon })
            .addTo(map)
            .bindPopup(`
              <div style="max-width: 250px;">
                <h3 style="margin: 0 0 8px 0; font-weight: bold;">${company.company_name}</h3>
                <p style="margin: 0; font-size: 12px; color: #666;">SIPI: ${company.sipi_number}</p>
                ${company.contact_name ? `<p style="margin: 4px 0; font-size: 12px; color: #666;">Contact: ${company.contact_name}</p>` : ''}
                ${company.email ? `<p style="margin: 4px 0; font-size: 12px; color: #666;">E-mail: ${company.email}</p>` : ''}
                ${company.phone ? `<p style="margin: 4px 0; font-size: 12px; color: #666;">Téléphone: ${company.phone}</p>` : ''}
                <p style="margin: 4px 0; font-size: 12px; color: #666;">Ville: ${company.city || 'N/A'}</p>
                <p style="margin: 4px 0; font-size: 12px; color: #666;">
                  Coordonnées: ${company.latitude.toFixed(6)}, ${company.longitude.toFixed(6)}
                </p>
                <p style="margin: 4px 0; font-size: 12px;">
                  Période: ${company.year1}-${company.year2}
                </p>
                <p style="margin: 4px 0; font-size: 12px;">
                  Montants: ${company.amount1.toLocaleString()}€ / ${company.amount2.toLocaleString()}€
                </p>
                <p style="margin: 4px 0 0 0; font-weight: bold; color: #10b981;">
                  Max: ${company.maxAmount.toLocaleString()}€ (Éligible - Dans zone et sous seuil)
                </p>
              </div>
            `);
        }
      });

      // Ajouter les marqueurs des entreprises hors zone
      companiesOutZone.forEach((company) => {
        if (company.latitude && company.longitude) {
          window.L.marker([company.latitude, company.longitude], { icon: outZoneIcon })
            .addTo(map)
            .bindPopup(`
              <div style="max-width: 250px;">
                <h3 style="margin: 0 0 8px 0; font-weight: bold;">${company.company_name}</h3>
                <p style="margin: 0; font-size: 12px; color: #666;">SIPI: ${company.sipi_number}</p>
                ${company.contact_name ? `<p style="margin: 4px 0; font-size: 12px; color: #666;">Contact: ${company.contact_name}</p>` : ''}
                ${company.email ? `<p style="margin: 4px 0; font-size: 12px; color: #666;">E-mail: ${company.email}</p>` : ''}
                ${company.phone ? `<p style="margin: 4px 0; font-size: 12px; color: #666;">Téléphone: ${company.phone}</p>` : ''}
                <p style="margin: 4px 0; font-size: 12px; color: #666;">Ville: ${company.city || 'N/A'}</p>
                <p style="margin: 4px 0; font-size: 12px; color: #666;">
                  Coordonnées: ${company.latitude.toFixed(6)}, ${company.longitude.toFixed(6)}
                </p>
                <p style="margin: 4px 0; font-size: 12px;">
                  Période: ${company.year1}-${company.year2}
                </p>
                <p style="margin: 4px 0; font-size: 12px;">
                  Montants: ${company.amount1.toLocaleString()}€ / ${company.amount2.toLocaleString()}€
                </p>
                <p style="margin: 4px 0 0 0; font-weight: bold; color: #f59e0b;">
                  Max: ${company.maxAmount.toLocaleString()}€ (Non éligible)
                </p>
              </div>
            `);
        }
      });

      console.log(`📊 Résultats: ${companiesInZone.length} dans la zone, ${companiesOutZone.length} hors zone`);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [companies, centerLocation, isochronePolygon]);

  // Fonction point-in-polygon utilisant l'algorithme ray casting
  const isPointInPolygon = (point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]): boolean => {
    if (polygon.length < 3) return false;
    
    let inside = false;
    let j = polygon.length - 1;
    
    for (let i = 0; i < polygon.length; i++) {
      const xi = polygon[i].lat;
      const yi = polygon[i].lng;
      const xj = polygon[j].lat;
      const yj = polygon[j].lng;
      
      if (((yi > point.lng) !== (yj > point.lng)) && 
          (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
      j = i;
    }
    
    return inside;
  };

  // Classification des entreprises pour la légende
  const companiesInZone = companies.filter(company => {
    if (!company.latitude || !company.longitude || isochronePolygon.length === 0) return false;
    const inZone = isPointInPolygon({ lat: company.latitude, lng: company.longitude }, isochronePolygon);
    const belowThreshold = company.maxAmount <= maxThreshold;
    return inZone && belowThreshold;
  });
  const companiesOutZone = companies.filter(company => !companiesInZone.includes(company));

  return (
    <div className="w-full h-[600px] relative">
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      
      {/* Légende */}
      <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg z-[1000]">
        <h4 className="font-semibold mb-2 text-sm">Légende</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Point de départ</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Client éligible ({companiesInZone.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span>Client non éligible ({companiesOutZone.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 opacity-50"></div>
            <span>Zone isochrone</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t">
          <p className="text-xs text-gray-600">
            Seuil max: {maxThreshold.toLocaleString()}€
          </p>
          <p className="text-xs text-gray-600">
            Total clients: {companies.length}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LeafletMap;