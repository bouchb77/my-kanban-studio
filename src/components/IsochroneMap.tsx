import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CompanyOrderPeriod } from '@/hooks/useCompanyOrderStats';

// Fix des icônes Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface IsochroneMapProps {
  companies: CompanyOrderPeriod[];
  centerLocation: { lat: number; lng: number } | null;
  isochronePolygon: { lat: number; lng: number}[];
  maxThreshold: number;
}

// Créer des icônes personnalisées
const createCustomIcon = (color: string) => {
  return L.divIcon({
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

const centerIcon = L.divIcon({
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

const inZoneIcon = createCustomIcon('#10b981');
const outZoneIcon = createCustomIcon('#f59e0b');

const IsochroneMap: React.FC<IsochroneMapProps> = ({ 
  companies, 
  centerLocation, 
  isochronePolygon, 
  maxThreshold 
}) => {
  const [companiesInZone, setCompaniesInZone] = useState<CompanyOrderPeriod[]>([]);
  const [companiesOutZone, setCompaniesOutZone] = useState<CompanyOrderPeriod[]>([]);

  // Fonction point-in-polygon utilisant l'algorithme de Leaflet
  const isPointInPolygon = (point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]): boolean => {
    if (polygon.length < 3) return false;
    
    const latLngs = polygon.map(p => L.latLng(p.lat, p.lng));
    const leafletPolygon = L.polygon(latLngs);
    const testPoint = L.latLng(point.lat, point.lng);
    
    // Utiliser la méthode Leaflet pour tester si un point est dans un polygone
    const bounds = leafletPolygon.getBounds();
    if (!bounds.contains(testPoint)) return false;
    
    // Ray casting algorithm comme fallback
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

  // Classifier les entreprises en "dans la zone" ou "hors zone"
  useEffect(() => {
    if (isochronePolygon.length === 0) {
      setCompaniesInZone([]);
      setCompaniesOutZone(companies);
      return;
    }

    const inZone: CompanyOrderPeriod[] = [];
    const outZone: CompanyOrderPeriod[] = [];

    companies.forEach((company) => {
      if (!company.latitude || !company.longitude) {
        outZone.push(company);
        return;
      }

      const isInside = isPointInPolygon(
        { lat: company.latitude, lng: company.longitude },
        isochronePolygon
      );

      if (isInside) {
        inZone.push(company);
      } else {
        outZone.push(company);
      }
    });

    setCompaniesInZone(inZone);
    setCompaniesOutZone(outZone);

    console.log(`📊 Résultats: ${inZone.length} dans la zone, ${outZone.length} hors zone`);
  }, [companies, isochronePolygon]);

  // Position par défaut (centre de la France)
  const defaultCenter: [number, number] = [46.603354, 1.888334];
  const mapCenter: [number, number] = centerLocation 
    ? [centerLocation.lat, centerLocation.lng] 
    : defaultCenter;

  // Coordonnées pour le polygone Leaflet
  const polygonCoords: [number, number][] = isochronePolygon.map(point => [point.lat, point.lng]);

  return (
    <div className="w-full h-[600px] relative">
      <MapContainer
        center={mapCenter}
        zoom={8}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        {/* Polygone isochrone */}
        {polygonCoords.length > 0 && (
          <Polygon
            positions={polygonCoords}
            pathOptions={{
              color: '#3b82f6',
              weight: 2,
              opacity: 0.8,
              fillColor: '#3b82f6',
              fillOpacity: 0.2,
            }}
          />
        )}

        {/* Marqueur du centre */}
        {centerLocation && (
          <Marker position={[centerLocation.lat, centerLocation.lng]} icon={centerIcon}>
            <Popup>
              <div>
                <strong>Point de départ</strong><br />
                {centerLocation.lat.toFixed(6)}, {centerLocation.lng.toFixed(6)}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Marqueurs des entreprises dans la zone */}
        {companiesInZone.map((company) => (
          company.latitude && company.longitude && (
            <Marker
              key={`in-${company.sipi_number}`}
              position={[company.latitude, company.longitude]}
              icon={inZoneIcon}
            >
              <Popup>
                <div style={{ maxWidth: '250px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{company.company_name}</h3>
                  <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>SIPI: {company.sipi_number}</p>
                  <p style={{ margin: '4px 0', fontSize: '12px', color: '#666' }}>Ville: {company.city || 'N/A'}</p>
                  <p style={{ margin: '4px 0', fontSize: '12px', color: '#666' }}>
                    Coordonnées: {company.latitude.toFixed(6)}, {company.longitude.toFixed(6)}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '12px' }}>
                    Période: {company.year1}-{company.year2}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '12px' }}>
                    Montants: {company.amount1.toLocaleString()}€ / {company.amount2.toLocaleString()}€
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: '#10b981' }}>
                    Max: {company.maxAmount.toLocaleString()}€ (Dans la zone)
                  </p>
                </div>
              </Popup>
            </Marker>
          )
        ))}

        {/* Marqueurs des entreprises hors zone */}
        {companiesOutZone.map((company) => (
          company.latitude && company.longitude && (
            <Marker
              key={`out-${company.sipi_number}`}
              position={[company.latitude, company.longitude]}
              icon={outZoneIcon}
            >
              <Popup>
                <div style={{ maxWidth: '250px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{company.company_name}</h3>
                  <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>SIPI: {company.sipi_number}</p>
                  <p style={{ margin: '4px 0', fontSize: '12px', color: '#666' }}>Ville: {company.city || 'N/A'}</p>
                  <p style={{ margin: '4px 0', fontSize: '12px', color: '#666' }}>
                    Coordonnées: {company.latitude.toFixed(6)}, {company.longitude.toFixed(6)}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '12px' }}>
                    Période: {company.year1}-{company.year2}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '12px' }}>
                    Montants: {company.amount1.toLocaleString()}€ / {company.amount2.toLocaleString()}€
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: '#f59e0b' }}>
                    Max: {company.maxAmount.toLocaleString()}€ (Hors zone)
                  </p>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
      
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
            <span>Client dans la zone ({companiesInZone.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span>Client hors zone ({companiesOutZone.length})</span>
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