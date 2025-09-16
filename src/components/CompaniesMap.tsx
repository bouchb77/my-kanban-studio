import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Building2 } from "lucide-react";

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

const CompaniesMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Use a public demo token for now
  const MAPBOX_TOKEN = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

  // Fetch companies with GPS coordinates
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id, sipi_number, company_name, latitude, longitude, address1, city, general_department')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);

        if (error) {
          console.error('Error fetching companies:', error);
          return;
        }

        setCompanies(data || []);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [2.3522, 46.6031], // Centre de la France
      zoom: 5.5,
      pitch: 0,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    // Disable scroll zoom for better UX
    map.current.scrollZoom.disable();

    return () => {
      map.current?.remove();
    };
  }, [MAPBOX_TOKEN]);

  // Add company markers
  useEffect(() => {
    if (!map.current || companies.length === 0) return;

    // Wait for map to load
    map.current.on('load', () => {
      // Add companies as a data source
      map.current!.addSource('companies', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: companies.map(company => ({
            type: 'Feature',
            properties: {
              id: company.id,
              sipi_number: company.sipi_number,
              company_name: company.company_name,
              address: company.address1 || '',
              city: company.city || '',
              department: company.general_department || ''
            },
            geometry: {
              type: 'Point',
              coordinates: [company.longitude, company.latitude]
            }
          }))
        }
      });

      // Add company markers layer
      map.current!.addLayer({
        id: 'companies-layer',
        type: 'circle',
        source: 'companies',
        paint: {
          'circle-radius': 8,
          'circle-color': 'hsl(var(--primary))',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.8
        }
      });

      // Create popup
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
      });

      // Show popup on hover
      map.current!.on('mouseenter', 'companies-layer', (e) => {
        map.current!.getCanvas().style.cursor = 'pointer';

        if (e.features && e.features[0]) {
          const feature = e.features[0];
          const coordinates = (feature.geometry as any).coordinates.slice();
          const properties = feature.properties;

          // Ensure that if the map is zoomed out such that multiple
          // copies of the feature are visible, the popup appears
          // over the copy being pointed to
          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
          }

          const popupContent = `
            <div class="p-3 min-w-64">
              <div class="flex items-start gap-2 mb-2">
                <div class="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h3 class="font-semibold text-foreground text-sm leading-tight">${properties?.company_name || 'N/A'}</h3>
                  <p class="text-xs text-muted-foreground mt-1">SIPI: ${properties?.sipi_number || 'N/A'}</p>
                </div>
              </div>
              ${properties?.address ? `<p class="text-xs text-muted-foreground">${properties.address}</p>` : ''}
              ${properties?.city ? `<p class="text-xs text-muted-foreground">${properties.city}${properties?.department ? `, ${properties.department}` : ''}</p>` : ''}
            </div>
          `;

          popup.setLngLat(coordinates).setHTML(popupContent).addTo(map.current!);
        }
      });

      // Hide popup on mouse leave
      map.current!.on('mouseleave', 'companies-layer', () => {
        map.current!.getCanvas().style.cursor = '';
        popup.remove();
      });

      // Fit map to show all companies
      if (companies.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        companies.forEach(company => {
          bounds.extend([company.longitude, company.latitude]);
        });
        
        map.current!.fitBounds(bounds, {
          padding: 50,
          maxZoom: 10
        });
      }
    });
  }, [companies]);

  if (loading) {
    return (
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Carte des entreprises
          </CardTitle>
          <CardDescription>
            Localisation géographique des entreprises
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center bg-muted/30 rounded-lg">
            <div className="text-muted-foreground">Chargement de la carte...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Carte des entreprises
        </CardTitle>
        <CardDescription className="flex items-center gap-4">
          <span>Localisation géographique des entreprises</span>
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4" />
            <span>{companies.length} entreprises géolocalisées</span>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div 
          ref={mapContainer} 
          className="h-96 w-full rounded-lg overflow-hidden border"
          style={{ background: '#f8f9fa' }}
        />
        <div className="mt-4 text-xs text-muted-foreground">
          Survolez les points pour voir les détails des entreprises
        </div>
      </CardContent>
    </Card>
  );
};

export default CompaniesMap;