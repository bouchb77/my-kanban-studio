import React, { useEffect, useRef, useState } from 'react';
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
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  // Fetch Google Maps API key
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-google-maps-key');
        if (error) throw error;
        setApiKey(data.apiKey);
      } catch (error) {
        console.error('Error fetching Google Maps API key:', error);
      }
    };

    fetchApiKey();
  }, []);

  // Initialize Google Maps
  useEffect(() => {
    if (!apiKey || !mapRef.current) return;

    const loadGoogleMaps = async () => {
      try {
        // Load Google Maps script
        if (!window.google) {
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker`;
          script.async = true;
          document.head.appendChild(script);
          
          await new Promise((resolve) => {
            script.onload = resolve;
          });
        }

        // Initialize map
        const mapInstance = new google.maps.Map(mapRef.current!, {
          zoom: 6,
          center: { lat: 46.603354, lng: 1.888334 }, // Centre de la France
          mapTypeId: google.maps.MapTypeId.ROADMAP,
        });

        setMap(mapInstance);
      } catch (error) {
        console.error('Error loading Google Maps:', error);
      }
    };

    loadGoogleMaps();
  }, [apiKey]);

  // Add markers when companies or map changes
  useEffect(() => {
    if (!map || !companies.length) return;

    // Clear existing markers
    const markers: google.maps.Marker[] = [];

    // Add markers for companies
    companies.forEach((company) => {
      if (company.latitude && company.longitude) {
        const marker = new google.maps.Marker({
          position: { lat: company.latitude, lng: company.longitude },
          map: map,
          title: company.company_name,
        });

        // Add info window
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div>
              <h3><strong>${company.company_name}</strong></h3>
              <p>SIPI: ${company.sipi_number}</p>
              ${company.city ? `<p>Ville: ${company.city}</p>` : ''}
              ${company.general_department ? `<p>Département: ${company.general_department}</p>` : ''}
              ${company.orderStats && company.orderStats.length > 0 ? 
                `<p>Commandes totales: ${company.orderStats.reduce((sum, stat) => sum + stat.totalOrders, 0)}</p>` : 
                ''
              }
            </div>
          `,
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        markers.push(marker);
      }
    });

    // Cleanup function
    return () => {
      markers.forEach(marker => marker.setMap(null));
    };
  }, [map, companies]);

  if (!apiKey) {
    return (
      <div className="h-[500px] flex items-center justify-center bg-muted/20 rounded-lg">
        <div className="text-center">
          <p className="text-muted-foreground">Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground text-center p-3 bg-muted/30 rounded-lg">
        Carte interactive Google Maps - {companies.length} entreprises
      </div>
      
      <div className="h-[500px] w-full rounded-lg border shadow-lg overflow-hidden">
        <div ref={mapRef} className="w-full h-full" />
      </div>
      
      {/* Liste des entreprises */}
      <div className="max-h-60 overflow-y-auto bg-muted/20 rounded-lg p-4">
        <h4 className="font-semibold mb-2">Entreprises ({companies.length})</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
          {companies.map((company) => (
            <div key={company.id} className="p-2 bg-background rounded border">
              <div className="font-medium truncate">{company.company_name}</div>
              <div className="text-muted-foreground text-xs">
                {company.city && `${company.city} • `}SIPI: {company.sipi_number}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MapComponent;