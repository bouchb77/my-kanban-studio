import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Company {
  id: string;
  company_name: string;
  latitude: number;
  longitude: number;
  city: string;
  postal_code: string;
}

const HeatmapMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const { toast } = useToast();

  // Load companies data and Mapbox token
  useEffect(() => {
    loadCompanies();
    loadMapboxToken();
  }, []);

  const loadMapboxToken = async () => {
    try {
      // Try to use Mapbox token from Supabase secrets
      const { data, error } = await supabase.functions.invoke('get-google-maps-key');
      
      if (error) {
        console.error('Error loading Mapbox token:', error);
        return;
      }
      
      // Assume the token is in the MAPBOX_ACCESS_TOKEN secret
      if (data?.mapboxToken) {
        setMapboxToken(data.mapboxToken);
      }
    } catch (error) {
      console.error('Error loading Mapbox token:', error);
    }
  };

  const loadCompanies = async () => {
    try {
      // Charger toutes les entreprises avec une approche de pagination
      let allCompanies: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('companies')
          .select('id, company_name, latitude, longitude, city, postal_code')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .range(from, from + batchSize - 1);

        if (error) {
          console.error('Error loading companies:', error);
          return;
        }

        if (data && data.length > 0) {
          allCompanies = [...allCompanies, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`Total entreprises chargées pour heatmap: ${allCompanies.length}`);
      setCompanies(allCompanies);
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const initializeMap = () => {
    if (!mapContainer.current || !mapboxToken.trim()) return;

    setLoading(true);
    try {
      mapboxgl.accessToken = mapboxToken.trim();
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [2.3522, 46.2276], // Center of France
        zoom: 5.5,
        maxZoom: 12,
        minZoom: 4
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      map.current.on('load', () => {
        createHeatmap();
        setMapInitialized(true);
        setLoading(false);
        toast({
          title: "Carte chargée",
          description: "La carte de chaleur des clients a été générée avec succès"
        });
      });

      map.current.on('error', (e) => {
        console.error('Mapbox error:', e);
        setLoading(false);
        toast({
          title: "Erreur de carte",
          description: "Vérifiez votre token Mapbox",
          variant: "destructive"
        });
      });

    } catch (error) {
      console.error('Error initializing map:', error);
      setLoading(false);
      toast({
        title: "Erreur d'initialisation",
        description: "Impossible d'initialiser la carte",
        variant: "destructive"
      });
    }
  };

  const createHeatmap = () => {
    if (!map.current || companies.length === 0) return;

    // Prepare GeoJSON data for heatmap
    const geojsonData = {
      type: 'FeatureCollection' as const,
      features: companies.map((company) => ({
        type: 'Feature' as const,
        properties: {
          name: company.company_name,
          city: company.city,
          postal_code: company.postal_code
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [company.longitude, company.latitude]
        }
      }))
    };

    // Add heatmap source
    map.current.addSource('companies-heatmap', {
      type: 'geojson',
      data: geojsonData
    });

    // Add heatmap layer
    map.current.addLayer({
      id: 'companies-heat',
      type: 'heatmap',
      source: 'companies-heatmap',
      maxzoom: 15,
      paint: {
        // Heatmap weight based on frequency/density
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'mag'],
          0, 0,
          6, 1
        ],
        // Heatmap intensity based on zoom level
        'heatmap-intensity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 1,
          15, 3
        ],
        // Color ramp for heatmap
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(33,102,172,0)',
          0.2, 'rgb(103,169,207)',
          0.4, 'rgb(209,229,240)',
          0.6, 'rgb(253,219,199)',
          0.8, 'rgb(239,138,98)',
          1, 'rgb(178,24,43)'
        ],
        // Heatmap radius based on zoom level
        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 2,
          15, 20
        ],
        // Transition from heatmap to circle layer by zoom level
        'heatmap-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 1,
          9, 0
        ]
      }
    });

    // Add circle layer for individual points at higher zoom levels
    map.current.addLayer({
      id: 'companies-point',
      type: 'circle',
      source: 'companies-heatmap',
      minzoom: 7,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, ['interpolate', ['linear'], ['get', 'mag'], 1, 1, 6, 4],
          16, ['interpolate', ['linear'], ['get', 'mag'], 1, 5, 6, 50]
        ],
        'circle-color': [
          'interpolate',
          ['linear'],
          ['get', 'mag'],
          1, 'rgba(33,102,172,0.2)',
          2, 'rgba(103,169,207,0.4)',
          3, 'rgba(209,229,240,0.6)',
          4, 'rgba(253,219,199,0.8)',
          5, 'rgba(239,138,98,0.9)',
          6, 'rgba(178,24,43,1)'
        ],
        'circle-stroke-color': 'white',
        'circle-stroke-width': 1,
        'circle-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 0,
          8, 1
        ]
      }
    });

    // Add popup on click
    map.current.on('click', 'companies-point', (e) => {
      if (!e.features || e.features.length === 0) return;
      
      const feature = e.features[0];
      const properties = feature.properties;
      
      if (properties) {
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="p-2">
              <h3 class="font-semibold">${properties.name}</h3>
              <p class="text-sm text-gray-600">${properties.city}</p>
              <p class="text-sm text-gray-600">${properties.postal_code}</p>
            </div>
          `)
          .addTo(map.current!);
      }
    });

    // Change cursor on hover
    map.current.on('mouseenter', 'companies-point', () => {
      if (map.current) {
        map.current.getCanvas().style.cursor = 'pointer';
      }
    });

    map.current.on('mouseleave', 'companies-point', () => {
      if (map.current) {
        map.current.getCanvas().style.cursor = '';
      }
    });
  };

  // Auto-initialize map when token is available
  useEffect(() => {
    if (mapboxToken && !mapInitialized) {
      initializeMap();
    }
  }, [mapboxToken, mapInitialized]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carte de Chaleur - Concentration des Clients</CardTitle>
        <CardDescription>
          Visualisation de la densité géographique des entreprises clientes ({companies.length} entreprises géolocalisées)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {companies.length === 0 && (
          <div className="flex items-center gap-2 p-4 border rounded-lg bg-muted/20">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Aucune entreprise géolocalisée trouvée
            </span>
          </div>
        )}
        
        <div 
          ref={mapContainer} 
          className="w-full h-[400px] rounded-lg border bg-muted/10"
          style={{ 
            display: mapInitialized ? 'block' : 'none'
          }}
        />
        
        {!mapInitialized && companies.length > 0 && (
          <div className="w-full h-[400px] rounded-lg border bg-muted/10 flex items-center justify-center">
            <div className="text-center space-y-2">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">
                {loading ? "Chargement de la carte..." : "Token Mapbox requis pour afficher la carte"}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HeatmapMap;