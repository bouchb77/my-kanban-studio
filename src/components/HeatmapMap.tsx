import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // Importez le CSS de Leaflet
import L from 'leaflet';
import 'leaflet.heat'; // Importez le plugin leaflet.heat

// Importations des composants UI et Supabase
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// --- Types ---
interface Company {
  id: string;
  company_name: string;
  latitude: number;
  longitude: number;
  city: string;
  postal_code: string;
}

// --- Composant pour la couche de chaleur Leaflet ---
interface HeatmapLayerProps {
  points: [number, number, number][]; // [latitude, longitude, intensité (poids)]
  options?: L.HeatIconOptions;
}

const HeatmapLayer: React.FC<HeatmapLayerProps> = ({ points, options }) => {
  // Utilisez le hook useMap pour accéder à l'instance de la carte Leaflet
  // Note: Ce composant doit être un enfant de MapContainer.
  const map = (L as any).useMap();
  const heatLayerRef = React.useRef<L.HeatLayer | null>(null);

  useEffect(() => {
    if (map) {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current); // Supprime l'ancienne couche si elle existe
      }

      if (points.length > 0) {
        // Crée la nouvelle couche de chaleur
        const newHeatLayer = (L.heatLayer as any)(points, {
          radius: 25, // Taille des points de chaleur
          blur: 15,  // Flou
          maxZoom: 14,
          ...options,
        }).addTo(map);
        heatLayerRef.current = newHeatLayer;
      }
    }

    // Fonction de nettoyage
    return () => {
      if (map && heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
      }
    };
  }, [map, points, options]);

  return null; // Ce composant ne rend rien dans le DOM
};

// --- Composant principal de la carte ---
const HeatmapMap = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapInitialized, setMapInitialized] = useState(false);
  const { toast } = useToast();

  // Position centrale pour la France (Latitude, Longitude)
  const center: L.LatLngExpression = [46.2276, 2.3522];
  const initialZoom = 5.5;

  // La récupération des entreprises reste la même
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
      if (allCompanies.length > 0) {
        setMapInitialized(true); // Considérer la carte initialisée si les données sont chargées
        toast({
          title: "Données chargées",
          description: `Les données de ${allCompanies.length} clients sont prêtes pour la carte.`
        });
      }
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

  useEffect(() => {
    loadCompanies();
  }, []);


  // Préparation des données pour la couche de chaleur Leaflet
  // Leaflet Heat s'attend à un tableau de [latitude, longitude, intensité(facultatif)]
  const heatmapData: [number, number, number][] = companies.map(c => [
    c.latitude,
    c.longitude,
    1 // Poids par défaut de 1. Vous pouvez ajuster cela si vous avez une métrique d'intensité.
  ]);

  // Leaflet n'a pas besoin de token d'accès pour les tuiles OpenStreetMap par défaut
  // L'appel à loadMapboxToken n'est plus nécessaire.

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carte de Chaleur - Concentration des Clients (Leaflet)</CardTitle>
        <CardDescription>
          Visualisation de la densité géographique des entreprises clientes ({companies.length} entreprises géolocalisées)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && companies.length === 0 && (
          <div className="w-full h-[400px] rounded-lg border bg-muted/10 flex items-center justify-center">
            <div className="text-center space-y-2">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto animate-pulse" />
              <p className="text-muted-foreground">Chargement des données...</p>
            </div>
          </div>
        )}
        
        {companies.length === 0 && !loading && (
          <div className="flex items-center gap-2 p-4 border rounded-lg bg-muted/20">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Aucune entreprise géolocalisée trouvée
            </span>
          </div>
        )}

        {mapInitialized && (
          <MapContainer
            center={center}
            zoom={initialZoom}
            scrollWheelZoom={true}
            style={{ height: '400px', width: '100%' }}
            className="rounded-lg border"
          >
            {/* Couche de tuiles OpenStreetMap par défaut */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Couche de chaleur personnalisée */}
            <HeatmapLayer points={heatmapData} />
          </MapContainer>
        )}
      </CardContent>
    </Card>
  );
};

// Exportez la version non-HOC pour les tests si nécessaire
export default HeatmapMap;