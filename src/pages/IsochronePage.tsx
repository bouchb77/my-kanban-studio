import React, { useState, useEffect } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Download, Calculator, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCompanyOrderStats, CompanyOrderPeriod } from "@/hooks/useCompanyOrderStats";
import { useIsochroneExport } from "@/hooks/useIsochroneExport";
import { useEnrichedCompanyData } from "@/hooks/useEnrichedCompanyData";
import { supabase } from '@/integrations/supabase/client';
import LeafletMap from '@/components/LeafletMap';


interface IsochronePoint {
  lat: number;
  lng: number;
}

const IsochronePage = () => {
  const [maxThreshold, setMaxThreshold] = useState<number>(50000);
  const [centerLocation, setCenterLocation] = useState<string>('');
  const [travelTime, setTravelTime] = useState<number>(60);
  const [transportMode, setTransportMode] = useState<string>('driving');
  const [isCalculating, setIsCalculating] = useState(false);
  const [isochronePolygon, setIsochronePolygon] = useState<IsochronePoint[]>([]);
  const [centerCoords, setCenterCoords] = useState<{lat: number, lng: number} | null>(null);
  const [enrichedCompanies, setEnrichedCompanies] = useState<CompanyOrderPeriod[]>([]);
  
  const { companyStats, loading, error, fetchCompanyOrderStats } = useCompanyOrderStats();
  const { exportToExcel, isExporting } = useIsochroneExport();
  const { enrichWithContacts, isEnriching } = useEnrichedCompanyData();
  const { toast } = useToast();

  // Enrichir automatiquement les données avec les contacts décryptés
  useEffect(() => {
    const enrichData = async () => {
      if (companyStats.length > 0) {
        console.log('🔐 Enrichissement automatique avec les contacts...');
        const enriched = await enrichWithContacts(companyStats);
        setEnrichedCompanies(enriched);
        console.log('✅ Entreprises enrichies:', enriched.length);
      }
    };
    enrichData();
  }, [companyStats]);

  const handleCalculateIsochrone = async () => {
    if (!centerLocation.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir une adresse de départ",
        variant: "destructive"
      });
      return;
    }

    setIsCalculating(true);
    
    try {
      // D'abord récupérer les entreprises avec le seuil
      await fetchCompanyOrderStats(maxThreshold);
      
      // L'enrichissement se fait automatiquement via le useEffect
      
      // Géocoder l'adresse avec OpenRouteService
      const geocodeResponse = await supabase.functions.invoke('geocode-address', {
        body: { address: centerLocation }
      });
      
      if (geocodeResponse.error) {
        throw new Error('Erreur lors du géocodage: ' + geocodeResponse.error.message);
      }
      
      const { lat, lng } = geocodeResponse.data;
      setCenterCoords({ lat, lng });
      
      // Calculer l'isochrone avec OpenRouteService
      const isochroneResponse = await supabase.functions.invoke('calculate-isochrone', {
        body: {
          lat: lat,
          lng: lng, 
          time: travelTime,
          profile: transportMode === 'driving' ? 'driving-car' : 'foot-walking'
        }
      });
      
      if (isochroneResponse.error) {
        throw new Error('Erreur lors du calcul de l\'isochrone: ' + isochroneResponse.error.message);
      }
      
      const { polygon } = isochroneResponse.data;
      setIsochronePolygon(polygon);
      
    } catch (err) {
      console.error('Erreur lors du calcul de l\'isochrone:', err);
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur lors du calcul",
        variant: "destructive"
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const generateCirclePolygon = (centerLat: number, centerLng: number, radiusKm: number): IsochronePoint[] => {
    const points: IsochronePoint[] = [];
    const earthRadius = 6371; // Rayon de la Terre en km
    
    for (let i = 0; i <= 360; i += 10) {
      const angle = (i * Math.PI) / 180;
      const deltaLat = (radiusKm / earthRadius) * Math.cos(angle);
      const deltaLng = (radiusKm / earthRadius) * Math.sin(angle) / Math.cos(centerLat * Math.PI / 180);
      
      points.push({
        lat: centerLat + deltaLat * (180 / Math.PI),
        lng: centerLng + deltaLng * (180 / Math.PI)
      });
    }
    
    return points;
  };

  // Fonction point-in-polygon pour déterminer si une entreprise est dans la zone
  const isPointInPolygon = (point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]): boolean => {
    if (polygon.length < 3) return false;
    
    let inside = false;
    let j = polygon.length - 1;
    
    for (let i = 0; i < polygon.length; i++) {
      const xi = polygon[i].lat;
      const yi = polygon[i].lng;
      const xj = polygon[j].lat;
      const yj = polygon[j].lng;
      
      if (((yi > point.lng) !== (yj > point.lng)) && 
          (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
      j = i;
    }
    
    return inside;
  };

  const handleExportToExcel = () => {
    // Filtrer les entreprises dans la zone isochrone ET en dessous du seuil
    const companiesInZone = companyStats.filter(company => {
      if (!company.latitude || !company.longitude || isochronePolygon.length === 0) {
        return false;
      }
      // Vérifier que l'entreprise est dans la zone ET que son montant est entre 1€ et le seuil défini
      const inZone = isPointInPolygon({ lat: company.latitude, lng: company.longitude }, isochronePolygon);
      const inThresholdRange = company.maxAmount > 1 && company.maxAmount <= maxThreshold;
      return inZone && inThresholdRange;
    });

    exportToExcel(companiesInZone, centerLocation, maxThreshold);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Calculateur d'Isochrone</h1>
        <p className="text-muted-foreground mt-1">
          Visualisez les clients par zone géographique et montant de commandes
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Paramètres de Calcul
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="threshold">Montant Maximum (€)</Label>
                <Input
                  id="threshold"
                  type="number"
                  value={maxThreshold}
                  onChange={(e) => setMaxThreshold(Number(e.target.value))}
                  placeholder="50000"
                />
              </div>
              
              <div>
                <Label htmlFor="location">Adresse de départ</Label>
                <Input
                  id="location"
                  value={centerLocation}
                  onChange={(e) => setCenterLocation(e.target.value)}
                  placeholder="123 Rue Example, Paris"
                />
              </div>
              
              <div>
                <Label htmlFor="time">Temps de trajet (min)</Label>
                <Input
                  id="time"
                  type="number"
                  value={travelTime}
                  onChange={(e) => setTravelTime(Number(e.target.value))}
                  placeholder="60"
                />
              </div>
              
              <div>
                <Label htmlFor="transport">Mode de transport</Label>
                <Select value={transportMode} onValueChange={setTransportMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="driving">Voiture</SelectItem>
                    <SelectItem value="walking">À pied</SelectItem>
                    <SelectItem value="transit">Transport en commun</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleCalculateIsochrone}
                disabled={isCalculating || loading}
                className="flex items-center gap-2"
              >
                {(isCalculating || loading) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
                Calculer l'Isochrone
              </Button>
              
              <Button 
                onClick={handleExportToExcel}
                disabled={companyStats.length === 0 || isochronePolygon.length === 0 || isExporting}
                variant="outline"
                className="flex items-center gap-2"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Exporter Clients Zone
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Carte des Entreprises et Isochrone</CardTitle>
          </CardHeader>
          <CardContent>
            <LeafletMap 
              companies={enrichedCompanies.length > 0 ? enrichedCompanies : companyStats}
              centerLocation={centerCoords}
              isochronePolygon={isochronePolygon}
              maxThreshold={maxThreshold}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IsochronePage;