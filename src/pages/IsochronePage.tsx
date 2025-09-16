import React, { useState } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Download, Calculator, Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCompanyOrderStats, CompanyOrderPeriod } from "@/hooks/useCompanyOrderStats";
import { supabase } from '@/integrations/supabase/client';
import * as ExcelJS from 'exceljs';
import IsochroneMap from '@/components/IsochroneMap';

interface IsochronePoint {
  lat: number;
  lng: number;
}

const IsochronePage = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();
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
      
      // Géocoder l'adresse de départ
      const geocodeResponse = await supabase.functions.invoke('get-google-maps-key');
      if (geocodeResponse.error) throw geocodeResponse.error;
      
      const { apiKey } = geocodeResponse.data;
      
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(centerLocation)}&key=${apiKey}`;
      const geocodeResult = await fetch(geocodeUrl);
      const geocodeData = await geocodeResult.json();
      
      if (geocodeData.status !== 'OK' || !geocodeData.results.length) {
        throw new Error('Impossible de géocoder l\'adresse de départ');
      }
      
      const centerCoordResult = geocodeData.results[0].geometry.location;
      setCenterCoords(centerCoordResult);
      
      // Calculer l'isochrone (approximation basique avec un cercle)
      // Pour une vraie implémentation, utilisez l'API Google Maps Directions
      const approximateRadius = travelTime * (transportMode === 'driving' ? 1.5 : 0.5); // km approximatifs
      const polygon = generateCirclePolygon(centerCoordResult.lat, centerCoordResult.lng, approximateRadius);
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

  const exportToExcel = async () => {
    if (companyStats.length === 0) {
      toast({
        title: "Aucune donnée",
        description: "Aucune entreprise à exporter",
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
        { header: 'Année 1', key: 'year1', width: 10 },
        { header: 'Montant Année 1', key: 'amount1', width: 15 },
        { header: 'Année 2', key: 'year2', width: 10 },
        { header: 'Montant Année 2', key: 'amount2', width: 15 },
        { header: 'Montant Maximum', key: 'maxAmount', width: 15 },
        { header: 'Latitude', key: 'latitude', width: 12 },
        { header: 'Longitude', key: 'longitude', width: 12 }
      ];

      // Données
      companyStats.forEach(company => {
        worksheet.addRow({
          sipi_number: company.sipi_number,
          company_name: company.company_name,
          city: company.city,
          general_department: company.general_department,
          year1: company.year1,
          amount1: company.amount1,
          year2: company.year2,
          amount2: company.amount2,
          maxAmount: company.maxAmount,
          latitude: company.latitude,
          longitude: company.longitude
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
      link.download = `entreprises_isochrone_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export réussi",
        description: `${companyStats.length} entreprises exportées`,
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

  if (roleLoading) {
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

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="max-w-md mx-auto mt-20">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Accès non autorisé</h2>
            <p className="text-muted-foreground">
              Seuls les administrateurs peuvent accéder à cette page.
            </p>
          </CardContent>
        </Card>
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
                disabled={companyStats.length === 0}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Exporter Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Carte des Entreprises et Isochrone</CardTitle>
          </CardHeader>
          <CardContent>
            <IsochroneMap 
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