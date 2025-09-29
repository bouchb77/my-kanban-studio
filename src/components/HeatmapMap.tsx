import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // Nécessaire pour le style de la carte Leaflet
import L from 'leaflet';
import 'leaflet.heat'; // Nécessaire pour l'extension heatmap

// Importations des composants UI et Supabase
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// --- Définition des types ---
interface Company {
  id: string;
  company_name: string;
  latitude: number;
  longitude: number;
  city: string;
  postal_code: string;
}

// Interface pour les propriétés de la couche de chaleur
interface HeatmapLayerProps {
  // Format attendu: [latitude, longitude, intensité (poids)]
  points: [number, number, number][]; 
  // Utilisation de 'any' car les types du plugin leaflet.heat ne sont pas exportés dans @types/leaflet
  options?: any; 
}

// --- Composant pour la couche de chaleur Leaflet ---
// Ce composant doit être un enfant de MapContainer pour utiliser useMap
const HeatmapLayer: React.FC<HeatmapLayerProps> = ({ points, options }) => {
  const map = useMap(); 
  // Utilisation de 'any' pour stocker l'objet HeatLayer non typé
  const heatLayerRef = useRef<L.Layer | any>(null); 

  useEffect(() => {
    if (map) {
      // 1. Retirer la couche précédente si elle existe
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
      }

      if (points.length > 0) {
        // 2. Créer et ajouter la nouvelle couche de chaleur
        // Utilisation de 'as any' pour bypasser l'erreur TS2339 (L.heatLayer n'est pas typé)
        const newHeatLayer = (L as any).heatLayer(points, {
          radius: 25, 
          blur: 15,  
          maxZoom: 14,
          ...options,
        }).addTo(map);
        heatLayerRef.current = newHeatLayer;
      }
    }

    // 3. Fonction de nettoyage : retire la couche quand le composant est démonté
    return () => {
      if (map && heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points]); // map est stable, mais les points changent au chargement

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

  // Chargement des entreprises (identique à votre code original)
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
        setMapInitialized(true); 
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
  // Format: [latitude, longitude, poids]
  const heatmapData: [number, number, number][] = companies
    .filter(c => c.latitude && c.longitude) // Filtrer pour s'assurer qu'ils existent
    .map(c => [
      c.latitude,
      c.longitude,
      1 // Poids par défaut de 1 (fréquence)
    ]);
    
  // La logique Mapbox (initializeMap, createHeatmap) est remplacée par la déclaration du MapContainer.

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
            {/* Couche de tuiles OpenStreetMap par défaut (gratuite et sans token) */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Ajout de la couche de chaleur */}
            <HeatmapLayer points={heatmapData} />
          </MapContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default HeatmapMap;