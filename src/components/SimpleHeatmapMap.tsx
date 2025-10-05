import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

interface SimpleHeatmapMapProps {
  companies?: Company[];
}

const SimpleHeatmapMap = ({ companies: externalCompanies }: SimpleHeatmapMapProps = {}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const heatLayer = useRef<any>(null);
  const { toast } = useToast();

  // Load companies data
  useEffect(() => {
    // If external companies are provided, use them
    if (externalCompanies) {
      setCompanies(externalCompanies);
      setLoading(false);
      return;
    }

    const loadCompanies = async () => {
      setLoading(true);
      try {
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
            setLoading(false);
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
        setLoading(false);
      } catch (error) {
        console.error('Error loading companies:', error);
        setLoading(false);
        toast({
          title: "Erreur de chargement",
          description: "Impossible de charger les données des entreprises.",
          variant: "destructive"
        });
      }
    };

    loadCompanies();
  }, [toast, externalCompanies]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) {
      console.warn('mapRef.current est null lors de l\'initialisation');
      return;
    }

    console.log('Début initialisation de la carte');

    // Create map
    map.current = L.map(mapRef.current).setView([46.2276, 2.3522], 5.5);

    // Add tile layer with simpler style
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map.current);

    console.log('Carte initialisée avec succès');
    
    // Force map to recalculate size after a short delay
    setTimeout(() => {
      if (map.current) {
        map.current.invalidateSize();
      }
    }, 100);
    
    setMapReady(true);

    return () => {
      console.log('Nettoyage de la carte');
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      setMapReady(false);
    };
  }, []);

  // Add heatmap layer
  useEffect(() => {
    console.log('useEffect heatmap déclenché:', { 
      hasMap: !!map.current,
      mapReady,
      companiesLength: companies.length, 
      loading 
    });

    if (!mapReady) {
      console.warn('Carte pas encore prête');
      return;
    }

    if (!map.current) {
      console.warn('map.current est null');
      return;
    }
    
    if (!companies.length) {
      console.warn('Aucune entreprise disponible');
      return;
    }
    
    if (loading) {
      console.warn('Chargement en cours...');
      return;
    }

    console.log('Tentative de chargement de la heatmap avec', companies.length, 'entreprises');

    // Dynamically import leaflet.heat
    import('leaflet.heat').then(() => {
      if (!map.current) return;

      console.log('leaflet.heat chargé avec succès');

      // Remove existing heat layer
      if (heatLayer.current) {
        map.current.removeLayer(heatLayer.current);
      }

      // Prepare heatmap data
      const heatmapData = companies
        .filter(c => 
          c.latitude && c.longitude && 
          typeof c.latitude === 'number' && 
          typeof c.longitude === 'number' &&
          !isNaN(c.latitude) && 
          !isNaN(c.longitude)
        )
        .map(c => [
          Number(c.latitude),
          Number(c.longitude),
          1 // Weight
        ]);

      console.log('Données heatmap préparées:', heatmapData.length, 'points valides');
      console.log('Exemple de points:', heatmapData.slice(0, 3));

      if (heatmapData.length > 0 && (L as any).heatLayer) {
        // Adjust heatmap parameters dynamically based on data size
        const dataCount = heatmapData.length;
        
        // Très faible max pour rendre les zones concentrées bien visibles en rouge/jaune
        // Plus la valeur est basse, plus facilement on atteint les couleurs chaudes
        const maxIntensity = dataCount > 3000 ? 0.25 : dataCount > 1000 ? 0.3 : 0.35;
        
        // Radius plus grand pour mieux voir les concentrations
        const radius = dataCount > 3000 ? 25 : dataCount > 500 ? 28 : 30;
        
        // Blur plus élevé pour des gradients plus lisses
        const blur = dataCount > 3000 ? 15 : dataCount > 500 ? 18 : 20;
        
        console.log('Paramètres heatmap:', { dataCount, maxIntensity, radius, blur });
        
        // Create heat layer with dynamic parameters
        heatLayer.current = (L as any).heatLayer(heatmapData, {
          radius: radius,
          blur: blur,
          maxZoom: 18,
          minOpacity: 0.1,
          max: maxIntensity,
          gradient: {
            0.0: 'rgba(0, 0, 255, 0)',
            0.2: 'rgb(0, 0, 255)',
            0.4: 'rgb(0, 255, 255)',
            0.6: 'rgb(0, 255, 0)',
            0.7: 'rgb(255, 255, 0)',
            0.8: 'rgb(255, 165, 0)',
            1.0: 'rgb(255, 0, 0)'
          }
        }).addTo(map.current);
        
        // Force map resize after heatmap is added
        setTimeout(() => {
          if (map.current) {
            map.current.invalidateSize();
          }
        }, 50);
        
        console.log('Couche heatmap ajoutée à la carte');
      } else {
        console.warn('Aucune donnée de heatmap ou L.heatLayer non disponible');
      }
    }).catch(error => {
      console.error("Erreur de chargement de leaflet.heat:", error);
    });
  }, [companies, loading, mapReady]);

  return (
    <div className="w-full h-[500px] rounded-lg border relative">
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      
      {loading && (
        <div className="absolute inset-0 bg-muted/10 flex items-center justify-center rounded-lg z-[1000]">
          <div className="text-center space-y-2">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto animate-pulse" />
            <p className="text-muted-foreground">Chargement des données...</p>
          </div>
        </div>
      )}
      
      {!loading && companies.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center p-4 rounded-lg z-[1000]">
          <div className="flex items-center gap-2 p-4 border rounded-lg bg-background">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Aucune entreprise géolocalisée trouvée
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleHeatmapMap;