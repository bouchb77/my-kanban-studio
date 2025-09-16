import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin, Download, Calculator, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCompanyOrderStats, CompanyOrderPeriod } from "@/hooks/useCompanyOrderStats";
import { supabase } from '@/integrations/supabase/client';
import * as ExcelJS from 'exceljs';

interface IsochronePoint {
  lat: number;
  lng: number;
}

const IsochroneCalculator = () => {
  const [maxThreshold, setMaxThreshold] = useState<number>(50000);
  const [centerLocation, setCenterLocation] = useState<string>('');
  const [travelTime, setTravelTime] = useState<number>(60);
  const [transportMode, setTransportMode] = useState<string>('driving');
  const [isCalculating, setIsCalculating] = useState(false);
  const [isochronePolygon, setIsochronePolygon] = useState<IsochronePoint[]>([]);
  const [companiesInZone, setCompaniesInZone] = useState<CompanyOrderPeriod[]>([]);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const { companyStats, loading, error, fetchCompanyOrderStats } = useCompanyOrderStats();
  const { toast } = useToast();

  const handleCalculateIsochrone = async () => {
    if (!centerLocation.trim() || !maxThreshold || !travelTime) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs requis.",
        variant: "destructive",
      });
      return;
    }

    setIsCalculating(true);
    try {
      // 1. Récupérer les données des entreprises
      await fetchCompanyOrderStats(maxThreshold);

      // 2. Géocoder l'adresse de départ
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(centerLocation)}&limit=1`
      );
      const geocodeData = await response.json();
      
      if (geocodeData.length === 0) {
        throw new Error("Impossible de géocoder l'adresse fournie");
      }

      const centerCoords = {
        lat: parseFloat(geocodeData[0].lat),
        lng: parseFloat(geocodeData[0].lon)
      };

      // 3. Calculer l'isochrone via OpenRouteService
      const profileMapping: Record<string, string> = {
        'driving': 'driving-car',
        'walking': 'foot-walking',
        'cycling': 'cycling-regular'
      };

      const isochroneResponse = await supabase.functions.invoke('calculate-isochrone', {
        body: {
          lat: centerCoords.lat,
          lng: centerCoords.lng,
          time: travelTime,
          profile: profileMapping[transportMode] || 'driving-car'
        }
      });

      if (isochroneResponse.error) {
        throw new Error(`Erreur API isochrone: ${isochroneResponse.error.message}`);
      }

      const isochroneData = isochroneResponse.data;
      setIsochronePolygon(isochroneData.polygon);

      // 4. Filtrer les entreprises dans la zone en utilisant la géométrie exacte
      const companiesInZone = companyStats.filter(company => {
        if (!company.latitude || !company.longitude) return false;
        return isPointInPolygon(company.latitude, company.longitude, isochroneData.polygon);
      });

      setCompaniesInZone(companiesInZone);

      toast({
        title: "Calcul terminé",
        description: `${companiesInZone.length} entreprises trouvées dans la zone isochrone.`,
      });

    } catch (error) {
      console.error('Erreur lors du calcul de l\'isochrone:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors du calcul",
        variant: "destructive",
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

  // Helper function to check if a point is within a polygon using improved ray casting algorithm
  const isPointInPolygon = (pointLat: number, pointLng: number, polygon: IsochronePoint[]): boolean => {
    if (polygon.length < 3) return false;

    let inside = false;
    let j = polygon.length - 1;

    for (let i = 0; i < polygon.length; i++) {
      const xi = polygon[i].lat;
      const yi = polygon[i].lng;
      const xj = polygon[j].lat;
      const yj = polygon[j].lng;

      // Vérifier si le point de test est sur une arête (cas limite)
      if (Math.abs((yj - yi) * (pointLat - xi) - (xj - xi) * (pointLng - yi)) < 1e-10) {
        // Point sur l'arête, considéré comme à l'intérieur
        if (Math.min(xi, xj) <= pointLat && pointLat <= Math.max(xi, xj) &&
            Math.min(yi, yj) <= pointLng && pointLng <= Math.max(yi, yj)) {
          return true;
        }
      }

      // Algorithme ray casting amélioré
      if (((yi > pointLng) !== (yj > pointLng)) &&
          (pointLat < (xj - xi) * (pointLng - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
      
      j = i;
    }

    console.log(`Point (${pointLat}, ${pointLng}): ${inside ? 'DANS' : 'HORS'} isochrone`);
    return inside;
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const exportToExcel = async () => {
    if (companiesInZone.length === 0) {
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
      companiesInZone.forEach(company => {
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
        description: `${companiesInZone.length} entreprises exportées`,
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Calculateur d'Isochrone
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
                  <SelectItem value="cycling">Vélo</SelectItem>
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
              disabled={companiesInZone.length === 0}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Exporter Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {companiesInZone.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Entreprises dans la zone ({companiesInZone.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SIPI</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Montants</TableHead>
                    <TableHead>Max</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companiesInZone.map((company) => (
                    <TableRow key={company.sipi_number}>
                      <TableCell className="font-mono">{company.sipi_number}</TableCell>
                      <TableCell>{company.company_name}</TableCell>
                      <TableCell>{company.city}</TableCell>
                      <TableCell>{company.year1}-{company.year2}</TableCell>
                      <TableCell>
                        {company.amount1.toLocaleString()}€ / {company.amount2.toLocaleString()}€
                      </TableCell>
                      <TableCell className="font-semibold">
                        {company.maxAmount.toLocaleString()}€
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default IsochroneCalculator;