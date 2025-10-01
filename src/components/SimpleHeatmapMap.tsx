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

const SimpleHeatmapMap = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const heatLayer = useRef<any>(null);
  const { toast } = useToast();

  // Load companies data
  useEffect(() => {
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
  }, [toast]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    // Create map
    map.current = L.map(mapRef.current).setView([46.2276, 2.3522], 5.5);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map.current);

    console.log('Carte initialisée');
    setMapReady(true);

    return () => {
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
      companiesLength: companies.length, 
      loading 
    });

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
        // Create heat layer
        heatLayer.current = (L as any).heatLayer(heatmapData, {
          radius: 25,
          blur: 15,
          maxZoom: 14
        }).addTo(map.current);
        
        console.log('Couche heatmap ajoutée à la carte');
      } else {
        console.warn('Aucune donnée de heatmap ou L.heatLayer non disponible');
      }
    }).catch(error => {
      console.error("Erreur de chargement de leaflet.heat:", error);
    });
  }, [companies, loading, mapReady]);

  if (loading) {
    return (
      <div className="w-full h-[400px] rounded-lg border bg-muted/10 flex items-center justify-center">
        <div className="text-center space-y-2">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto animate-pulse" />
          <p className="text-muted-foreground">Chargement des données...</p>
        </div>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 border rounded-lg bg-muted/20">
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Aucune entreprise géolocalisée trouvée
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-[400px] rounded-lg border">
      <div ref={mapRef} className="w-full h-full rounded-lg" />
    </div>
  );
};

export default SimpleHeatmapMap;