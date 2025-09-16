import React, { useEffect, useRef, useMemo } from 'react';

interface Company {
  id: string;
  sipi_number: string;
  company_name: string;
  latitude: number;
  longitude: number;
  address1?: string;
  city?: string;
  general_department?: string;
  orderStats?: Array<{
    year: number;
    totalOrders: number;
    totalAmount: number;
  }>;
}

interface MapComponentProps {
  companies: Company[];
}

const MapComponent: React.FC<MapComponentProps> = ({ companies }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  // Optimiser les données des entreprises avec useMemo pour limiter à 1000 pour de meilleures performances
  const optimizedCompanies = useMemo(() => {
    return companies.slice(0, 1000); // Limiter à 1000 entreprises pour éviter les ralentissements
  }, [companies]);

  useEffect(() => {
    const initMap = async () => {
      try {
        // Import dynamique de Leaflet seulement
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

        // Créer la carte avec des options de performance
        const map = L.map(mapRef.current, {
          preferCanvas: true, // Utilise Canvas pour de meilleures performances
        }).setView([46.603354, 1.888334], 6);
        mapInstanceRef.current = map;

        // Ajouter les tuiles OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 18
        }).addTo(map);

        // Créer les marqueurs en batch pour de meilleures performances
        const markers: any[] = [];
        
        optimizedCompanies.forEach((company) => {
          const marker = L.marker([company.latitude, company.longitude]);
          
          // Créer le contenu du popup avec les statistiques de commandes
          let orderStatsHtml = '';
          if (company.orderStats && company.orderStats.length > 0) {
            orderStatsHtml = `
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
                <h4 style="font-size: 12px; font-weight: 600; margin-bottom: 4px;">Statistiques des commandes:</h4>
                ${company.orderStats.slice(0, 3).map(stat => `
                  <div style="font-size: 11px; margin-bottom: 2px;">
                    ${stat.year}: ${stat.totalOrders} commande${stat.totalOrders > 1 ? 's' : ''} - ${stat.totalAmount.toLocaleString()} €
                  </div>
                `).join('')}
                ${company.orderStats.length > 3 ? `<div style="font-size: 11px; color: #666;">...et ${company.orderStats.length - 3} autres années</div>` : ''}
              </div>
            `;
          }
          
          const popupContent = `
            <div style="padding: 8px; min-width: 200px;">
              <h3 style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${company.company_name}</h3>
              <p style="font-size: 12px; color: #666; margin-bottom: 4px;">SIPI: ${company.sipi_number}</p>
              ${company.address1 ? `<p style="font-size: 12px; margin-bottom: 4px;">${company.address1}</p>` : ''}
              ${company.city ? `<p style="font-size: 12px; margin-bottom: 4px;">${company.city}${company.general_department ? ` (${company.general_department})` : ''}</p>` : ''}
              ${orderStatsHtml}
            </div>
          `;
          
          marker.bindPopup(popupContent);
          marker.addTo(map);
          markers.push(marker);
        });

        // Ajuster la vue pour inclure tous les marqueurs
        if (markers.length > 0) {
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
  }, [optimizedCompanies]); // Dépendance sur optimizedCompanies pour re-rendre quand elles changent

  return (
    <div className="space-y-2">
      {companies.length > 1000 && (
        <div className="text-sm text-muted-foreground text-center p-2 bg-muted/30 rounded-lg">
          Affichage de 1000 entreprises sur {companies.length} pour optimiser les performances
        </div>
      )}
      <div 
        ref={mapRef} 
        className="h-[500px] w-3/4 mx-auto rounded-lg border"
        style={{ minHeight: '500px' }}
      />
    </div>
  );
};

export default MapComponent;