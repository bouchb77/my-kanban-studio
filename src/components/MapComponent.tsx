import React, { useEffect, useRef } from 'react';

interface Company {
  id: string;
  sipi_number: string;
  company_name: string;
  latitude: number;
  longitude: number;
  address1?: string;
  city?: string;
  general_department?: string;
}

interface MapComponentProps {
  companies: Company[];
}

const MapComponent: React.FC<MapComponentProps> = ({ companies }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    const initMap = async () => {
      try {
        // Import dynamique de Leaflet
        const L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');

        if (!mapRef.current) return;

        // Fix pour les icônes
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        // Supprimer la carte existante si elle existe
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        // Créer la carte
        const map = L.map(mapRef.current).setView([46.603354, 1.888334], 6);
        mapInstanceRef.current = map;

        // Ajouter les tuiles OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Ajouter les marqueurs des entreprises
        companies.forEach((company) => {
          const marker = L.marker([company.latitude, company.longitude]).addTo(map);
          
          const popupContent = `
            <div style="padding: 8px;">
              <h3 style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${company.company_name}</h3>
              <p style="font-size: 12px; color: #666; margin-bottom: 4px;">SIPI: ${company.sipi_number}</p>
              ${company.address1 ? `<p style="font-size: 12px; margin-bottom: 4px;">${company.address1}</p>` : ''}
              ${company.city ? `<p style="font-size: 12px;">${company.city}${company.general_department ? ` (${company.general_department})` : ''}</p>` : ''}
            </div>
          `;
          
          marker.bindPopup(popupContent);
        });

        // Ajuster la vue pour inclure tous les marqueurs
        if (companies.length > 0) {
          const markers = companies.map(company => 
            L.marker([company.latitude, company.longitude])
          );
          const group = L.featureGroup(markers);
          map.fitBounds(group.getBounds().pad(0.1));
        }
      } catch (error) {
        console.error('Erreur lors du chargement de la carte:', error);
      }
    };

    initMap();

    // Cleanup lors du démontage
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [companies]); // Dépendance sur companies pour re-rendre quand elles changent

  return (
    <div 
      ref={mapRef} 
      className="h-[500px] w-3/4 mx-auto rounded-lg border"
      style={{ minHeight: '500px' }}
    />
  );
};

export default MapComponent;