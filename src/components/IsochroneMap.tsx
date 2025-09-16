import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CompanyOrderPeriod } from '@/hooks/useCompanyOrderStats';

interface IsochroneMapProps {
  companies: CompanyOrderPeriod[];
  centerLocation: { lat: number; lng: number } | null;
  isochronePolygon: { lat: number; lng: number}[];
  maxThreshold: number;
}

const IsochroneMap: React.FC<IsochroneMapProps> = ({ 
  companies, 
  centerLocation, 
  isochronePolygon, 
  maxThreshold 
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Charger Google Maps
  useEffect(() => {
    const loadGoogleMaps = async () => {
      if (!window.google) {
        try {
          const response = await supabase.functions.invoke('get-google-maps-key');
          if (response.error) throw response.error;
          
          const { apiKey } = response.data;
          
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,drawing`;
          script.onload = () => setIsLoaded(true);
          document.head.appendChild(script);
        } catch (error) {
          console.error('Erreur lors du chargement de Google Maps:', error);
        }
      } else {
        setIsLoaded(true);
      }
    };

    loadGoogleMaps();
  }, []);

  // Initialiser la carte
  useEffect(() => {
    if (!isLoaded || !mapRef.current || map) return;

    const mapOptions: google.maps.MapOptions = {
      zoom: 8,
      center: centerLocation || { lat: 46.603354, lng: 1.888334 }, // Centre de la France
      mapTypeId: google.maps.MapTypeId.ROADMAP,
    };

    const newMap = new google.maps.Map(mapRef.current, mapOptions);
    setMap(newMap);
  }, [isLoaded, centerLocation, map]);

  // Dessiner l'isochrone et les marqueurs
  useEffect(() => {
    if (!map || !isLoaded) return;

    console.log('IsochroneMap: Polygone reçu:', isochronePolygon.length, 'points');
    console.log('IsochroneMap: Entreprises reçues:', companies.length);

    // Nettoyer les anciens marqueurs et polygones
    // (Dans une vraie app, on stockerait les références pour les nettoyer)

    // Dessiner l'isochrone si elle existe
    if (isochronePolygon.length > 0) {
      const polygon = new google.maps.Polygon({
        paths: isochronePolygon,
        strokeColor: '#3b82f6',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
      });
      polygon.setMap(map);

      // Centre de l'isochrone
      if (centerLocation) {
        new google.maps.Marker({
          position: centerLocation,
          map: map,
          title: 'Point de départ',
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="8" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
                <circle cx="12" cy="12" r="3" fill="#ffffff"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(24, 24),
            anchor: new google.maps.Point(12, 12),
          },
        });
      }
    }

    // Ajouter les marqueurs pour les entreprises - Montrer TOUTES les entreprises avec distinction visuelle
    companies.forEach((company) => {
      if (!company.latitude || !company.longitude) return;

      // Utiliser l'algorithme point-in-polygon pour déterminer si dans la zone
      let inZone = false;
      if (isochronePolygon.length > 0) {
        const testLat = company.latitude;
        const testLng = company.longitude;
        
        for (let i = 0, j = isochronePolygon.length - 1; i < isochronePolygon.length; j = i++) {
          const lat1 = isochronePolygon[i].lat;
          const lng1 = isochronePolygon[i].lng;
          const lat2 = isochronePolygon[j].lat;
          const lng2 = isochronePolygon[j].lng;
          
          // Ray casting algorithm: cast a ray from the test point to the right
          if (((lng1 > testLng) !== (lng2 > testLng)) && 
              (testLat < (lat2 - lat1) * (testLng - lng1) / (lng2 - lng1) + lat1)) {
            inZone = !inZone;
          }
        }
      }
      
      const marker = new google.maps.Marker({
        position: { lat: company.latitude, lng: company.longitude },
        map: map,
        title: company.company_name,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="8" cy="8" r="6" fill="${inZone ? '#10b981' : '#f59e0b'}" stroke="#ffffff" stroke-width="2"/>
              <circle cx="8" cy="8" r="2" fill="#ffffff"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(16, 16),
          anchor: new google.maps.Point(8, 8),
        },
      });

      // Info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="max-width: 250px;">
            <h3 style="margin: 0 0 8px 0; font-weight: bold;">${company.company_name}</h3>
            <p style="margin: 0; font-size: 12px; color: #666;">SIPI: ${company.sipi_number}</p>
            <p style="margin: 4px 0; font-size: 12px; color: #666;">Ville: ${company.city || 'N/A'}</p>
            <p style="margin: 4px 0; font-size: 12px;">
              Période: ${company.year1}-${company.year2}
            </p>
            <p style="margin: 4px 0; font-size: 12px;">
              Montants: ${company.amount1.toLocaleString()}€ / ${company.amount2.toLocaleString()}€
            </p>
            <p style="margin: 4px 0 0 0; font-weight: bold; color: ${inZone ? '#10b981' : '#f59e0b'};">
              Max: ${company.maxAmount.toLocaleString()}€ ${inZone ? '(Dans la zone)' : '(Hors zone)'}
            </p>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });
    });

    // Ajuster la vue pour inclure tous les éléments
    if (companies.length > 0 || isochronePolygon.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      
      if (centerLocation) {
        bounds.extend(centerLocation);
      }
      
      companies.forEach(company => {
        if (company.latitude && company.longitude) {
          bounds.extend({ lat: company.latitude, lng: company.longitude });
        }
      });
      
      isochronePolygon.forEach(point => {
        bounds.extend(point);
      });
      
      map.fitBounds(bounds);
    }

  }, [map, companies, centerLocation, isochronePolygon, isLoaded]);

  return (
    <div className="w-full h-[600px] relative">
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      
      {/* Légende */}
      <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg z-10">
        <h4 className="font-semibold mb-2 text-sm">Légende</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Point de départ</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Client dans la zone</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span>Client hors zone</span>
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

export default IsochroneMap;