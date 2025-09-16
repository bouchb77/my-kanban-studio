import React, { useEffect, useRef, useMemo } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { supabase } from '@/integrations/supabase/client';

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
  const markersRef = useRef<any[]>([]);
  const markerClustererRef = useRef<any>(null);

  useEffect(() => {
    const initGoogleMap = async () => {
      try {
        if (!mapRef.current) return;

        // Récupérer la clé API Google Maps depuis les secrets via edge function si nécessaire
        // Pour l'instant, utiliser directement la clé stockée
        const googleMapsApiKey = process.env.NODE_ENV === 'development' 
          ? 'AIzaSyBpKK9_mCN8V8vhcLHbN0iKx-0aUK4-uCc' 
          : 'YOUR_PRODUCTION_KEY'; // Remplacer par votre vraie clé
        
        const loader = new Loader({
          apiKey: googleMapsApiKey,
          version: 'weekly',
          libraries: ['maps']
        });

        await loader.load();

        // Créer la carte Google Maps avec les marqueurs classiques
        const map = new (window as any).google.maps.Map(mapRef.current, {
          center: { lat: 46.603354, lng: 1.888334 },
          zoom: 6,
          gestureHandling: 'cooperative',
          zoomControl: true,
          mapTypeControl: false,
          scaleControl: true,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: true
        });

        mapInstanceRef.current = map;

        // Nettoyer les marqueurs existants
        markersRef.current.forEach(marker => {
          if (marker.setMap) {
            marker.setMap(null);
          }
        });
        markersRef.current = [];

        // Créer les marqueurs classiques avec InfoWindows
        const bounds = new (window as any).google.maps.LatLngBounds();
        const markers: any[] = [];

        companies.forEach((company) => {
          const position = { lat: company.latitude, lng: company.longitude };
          bounds.extend(position);

          // Créer le marqueur classique
          const marker = new (window as any).google.maps.Marker({
            position,
            map,
            title: company.company_name,
            animation: (window as any).google.maps.Animation.DROP
          });

          // Créer le contenu de l'InfoWindow avec les statistiques
          let orderStatsHtml = '';
          if (company.orderStats && company.orderStats.length > 0) {
            orderStatsHtml = `
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
                <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #1976d2;">📊 Statistiques des commandes</h4>
                <div style="max-height: 150px; overflow-y: auto;">
                  ${company.orderStats.slice(0, 5).map(stat => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f0f0f0;">
                      <span style="font-weight: 600; color: #333; min-width: 40px;">${stat.year}</span>
                      <span style="color: #666; font-size: 12px; text-align: center; flex: 1;">${stat.totalOrders} cmd${stat.totalOrders > 1 ? 's' : ''}</span>
                      <span style="font-weight: 600; color: #1976d2; text-align: right; min-width: 80px;">${stat.totalAmount.toLocaleString()} €</span>
                    </div>
                  `).join('')}
                  ${company.orderStats.length > 5 ? `
                    <div style="text-align: center; padding: 8px; color: #666; font-style: italic; font-size: 12px;">
                      ...et ${company.orderStats.length - 5} autres années
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }

          const infoWindowContent = `
            <div style="padding: 16px; max-width: 350px; font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.4;">
              <h3 style="font-size: 18px; font-weight: 600; margin: 0 0 12px 0; color: #1976d2; border-bottom: 2px solid #e3f2fd; padding-bottom: 8px;">
                ${company.company_name}
              </h3>
              <div style="margin-bottom: 12px;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                  <span style="font-weight: 500; color: #666; margin-right: 8px;">🏢 SIPI:</span>
                  <span style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                    ${company.sipi_number}
                  </span>
                </div>
                ${company.address1 ? `
                  <div style="color: #666; font-size: 14px; margin-bottom: 4px; display: flex; align-items: center;">
                    <span style="margin-right: 6px;">📍</span>
                    <span>${company.address1}</span>
                  </div>
                ` : ''}
                ${company.city ? `
                  <div style="color: #666; font-size: 14px; display: flex; align-items: center;">
                    <span style="margin-right: 6px;">🏙️</span>
                    <span>${company.city}${company.general_department ? ` (${company.general_department})` : ''}</span>
                  </div>
                ` : ''}
              </div>
              ${orderStatsHtml}
            </div>
          `;

          const infoWindow = new (window as any).google.maps.InfoWindow({
            content: infoWindowContent,
            maxWidth: 400
          });

          // Ajouter l'événement de clic pour afficher l'InfoWindow
          marker.addListener('click', () => {
            // Fermer toutes les autres InfoWindows
            markersRef.current.forEach(m => {
              if ((m as any).infoWindow) {
                (m as any).infoWindow.close();
              }
            });
            
            infoWindow.open(map, marker);
          });

          // Stocker l'InfoWindow avec le marqueur
          (marker as any).infoWindow = infoWindow;
          markers.push(marker);
        });

        markersRef.current = markers;

        // Ajuster la vue pour inclure tous les marqueurs
        if (companies.length > 0) {
          map.fitBounds(bounds);
          
          // Éviter de trop zoomer si il n'y a qu'une entreprise
          const listener = (window as any).google.maps.event.addListener(map, 'idle', () => {
            if (map.getZoom() > 15) map.setZoom(15);
            (window as any).google.maps.event.removeListener(listener);
          });
        }

      } catch (error) {
        console.error('Erreur lors du chargement de Google Maps:', error);
      }
    };

    initGoogleMap();

    // Cleanup lors du démontage
    return () => {
      markersRef.current.forEach(marker => {
        if (marker.setMap) {
          marker.setMap(null);
        }
      });
      markersRef.current = [];
      mapInstanceRef.current = null;
    };
  }, [companies]);

  return (
    <div className="space-y-2">
      {companies.length > 1000 && (
        <div className="text-sm text-muted-foreground text-center p-2 bg-muted/30 rounded-lg">
          Affichage de {companies.length} entreprises avec Google Maps
        </div>
      )}
      <div 
        ref={mapRef} 
        className="h-[500px] w-3/4 mx-auto rounded-lg border shadow-lg"
        style={{ minHeight: '500px' }}
      />
    </div>
  );
};

export default MapComponent;