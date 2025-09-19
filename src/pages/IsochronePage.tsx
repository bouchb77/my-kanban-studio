import React, { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Download, Calculator, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCompanyOrderStats, CompanyOrderPeriod } from "@/hooks/useCompanyOrderStats";
import { supabase } from '@/integrations/supabase/client';
import * as ExcelJS from 'exceljs';
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
  
  const { companyStats, loading, error, fetchCompanyOrderStats } = useCompanyOrderStats();
  const { toast } = useToast();

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

  const exportToExcel2 = async () => {
    // Filtrer les entreprises dans la zone isochrone ET en dessous du seuil
    const companiesInZone = companyStats.filter(company => {
      if (!company.latitude || !company.longitude || isochronePolygon.length === 0) {
        return false;
      }
      // Vérifier que l'entreprise est dans la zone ET que son montant max est <= au seuil
      const inZone = isPointInPolygon({ lat: company.latitude, lng: company.longitude }, isochronePolygon);
      const belowThreshold = company.maxAmount <= maxThreshold;
      return inZone && belowThreshold;
    });

    if (companiesInZone.length === 0) {
      toast({
        title: "Aucune donnée",
        description: "Aucune entreprise dans la zone isochrone et sous le seuil à exporter",
        variant: "destructive"
      });
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Entreprises Zone Isochrone');

      // En-têtes
      worksheet.columns = [
        { header: 'SIPI', key: 'sipi_number', width: 15 },
        { header: 'Nom Entreprise', key: 'company_name', width: 30 },
        { header: 'Ville', key: 'city', width: 20 },
        { header: 'Département', key: 'general_department', width: 15 },
        { header: 'Période 2023-2024 (€)', key: 'period_2023_2024', width: 18 },
        { header: 'Période 2024-2025 (€)', key: 'period_2024_2025', width: 18 },
        { header: 'Montant Maximum (€)', key: 'maxAmount', width: 18 },
        { header: 'Latitude', key: 'latitude', width: 12 },
        { header: 'Longitude', key: 'longitude', width: 12 },
        { header: 'Dans Zone Isochrone', key: 'in_zone', width: 20 },
        { header: 'Contact', key: 'contact_name', width: 20 },
        { header: 'Mail', key: 'mail', width: 20 },
        { header: 'Téléphone', key: 'phone', width: 20 }
      ];

      // Données - uniquement les entreprises dans la zone et sous le seuil
      companiesInZone.forEach(company => {
        worksheet.addRow({
          sipi_number: company.sipi_number,
          company_name: company.company_name,
          city: company.city,
          general_department: company.general_department,
          period_2023_2024: (company.year1 === 2023 && company.year2 === 2024) ? company.amount1 : (company.year1 === 2024 && company.year2 === 2025) ? 0 : company.amount1,
          period_2024_2025: (company.year1 === 2023 && company.year2 === 2024) ? company.amount2 : (company.year1 === 2024 && company.year2 === 2025) ? company.amount1 : company.amount2,
          maxAmount: company.maxAmount,
          latitude: company.latitude,
          longitude: company.longitude,
          in_zone: 'OUI',
          contact_name: company.contact,
          mail: company.mail,
          phone: company.phone
        });
      });

      // Style de l'en-tête
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Générer et télécharger le fichier
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Nettoyer le nom de la ville pour le nom de fichier
      const cleanLocation = centerLocation.replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '_');
      const date = new Date().toISOString().split('T')[0];
      link.download = `entreprises_zone_isochrone_${cleanLocation}_${maxThreshold}€_${date}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export réussi",
        description: `${companiesInZone.length} entreprises dans la zone et sous le seuil exportées`,
      });

    } catch (err) {
      console.error('Erreur lors de l\'export:', err);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'export Excel",
        variant: "destructive"
      });
    }
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
                onClick={exportToExcel}
                disabled={companyStats.length === 0 || isochronePolygon.length === 0}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
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
              companies={companyStats}
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