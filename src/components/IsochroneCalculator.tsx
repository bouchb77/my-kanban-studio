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

      // 4. Filtrer les entreprises dans la zone en utilisant la géométrie native de Google Maps
      if (window.google?.maps?.geometry) {
        // Utiliser l'API de géométrie native de Google Maps
        const companiesInZone = companyStats.filter(company => {
          if (!company.latitude || !company.longitude) return false;
          
          try {
            // Créer un polygone Google Maps pour la détection précise
            const polygon = new google.maps.Polygon({
              paths: isochroneData.polygon
            });

            // Utiliser l'API geometry native de Google Maps
            const testPoint = new google.maps.LatLng(company.latitude, company.longitude);
            return google.maps.geometry.poly.containsLocation(testPoint, polygon);
          } catch (error) {
            console.error('Erreur détection géométrie pour', company.company_name, error);
            return false;
          }
        });
        
        setCompaniesInZone(companiesInZone);
      } else {
        // Fallback sur l'ancien algorithme si Google Maps geometry n'est pas disponible
        const companiesInZone = companyStats.filter(company => {
          if (!company.latitude || !company.longitude) return false;
          return isPointInPolygon(company.latitude, company.longitude, isochroneData.polygon);
        });
        
        setCompaniesInZone(companiesInZone);
      }

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
    console.log('🚀 BOUTON EXPORT CLIQUÉ!');
    console.log('Nombre d\'entreprises dans la zone:', companiesInZone.length);
    
    if (companiesInZone.length === 0) {
      console.log('❌ ARRÊT: Aucune entreprise dans la zone');
      toast({
        title: "Aucune donnée",
        description: "Aucune entreprise à exporter",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('=== DÉBUT EXPORT EXCEL COMPLET ===');
      console.log('Entreprises dans la zone:', companiesInZone.length);
      
      // Récupérer TOUS les contacts avec pagination complète
      console.log('Récupération des contacts avec pagination...');
      let allContacts: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMoreData = true;

      while (hasMoreData) {
        console.log(`Récupération page ${page + 1} des contacts...`);
        const { data: contactsBatch, error: contactsError } = await supabase
          .from('contacts')
          .select('sipi_number, contact_name, email, phone')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (contactsError) {
          console.error('🚨 ERREUR CRITIQUE récupération contacts page', page + 1, ':', contactsError);
          console.error('Message d\'erreur:', contactsError.message);
          console.error('Code d\'erreur:', contactsError.code);
          console.error('Détails:', contactsError.details);
          
          // Vérifier les permissions utilisateur
          const { data: currentUser } = await supabase.auth.getUser();
          console.log('Utilisateur actuel:', currentUser?.user?.id);
          
          // Tester si on peut accéder aux profils (pour vérifier l'approbation)
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('approved')
            .eq('id', currentUser?.user?.id)
            .single();
          
          console.log('Profil utilisateur:', profile);
          console.log('Erreur profil:', profileError);
          
          break;
        }

        if (contactsBatch && contactsBatch.length > 0) {
          allContacts.push(...contactsBatch);
          console.log(`Page ${page + 1}: ${contactsBatch.length} contacts récupérés`);
          hasMoreData = contactsBatch.length === pageSize;
          page++;
        } else {
          hasMoreData = false;
        }
      }
      
      console.log(`TOTAL CONTACTS RÉCUPÉRÉS: ${allContacts.length}`);
      
      // Créer un index des contacts par SIPI avec debug détaillé
      const contactsByWsipi = new Map();
      let contactsAvecSipi = 0;
      let contactsSansSipi = 0;
      
      allContacts.forEach((contact, index) => {
        if (contact.sipi_number) {
          // Normaliser la clé SIPI en string et la nettoyer
          const sipiKey = String(contact.sipi_number).trim();
          contactsByWsipi.set(sipiKey, contact);
          contactsAvecSipi++;
          if (index < 5) {
            console.log(`Contact ${index + 1}: SIPI="${sipiKey}", Nom="${contact.contact_name}", Email="${contact.email}"`);
          }
        } else {
          contactsSansSipi++;
        }
      });
      
      console.log(`INDEX CONTACTS - AVEC SIPI: ${contactsAvecSipi}, SANS SIPI: ${contactsSansSipi}`);
      console.log(`TAILLE MAP CONTACTS: ${contactsByWsipi.size}`);

      // Créer le workbook Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Entreprises_Isochrone_avec_Contacts');

      // Définir les en-têtes de colonnes
      const headers = [
        'SIPI',
        'Nom Entreprise', 
        'Nom Contact',
        'Email Contact',
        'Téléphone Contact',
        'Ville',
        'Département',
        'Année 1',
        'Montant Année 1 (€)',
        'Année 2', 
        'Montant Année 2 (€)',
        'Montant Maximum (€)',
        'Latitude',
        'Longitude'
      ];

      // Ajouter les en-têtes
      worksheet.addRow(headers);

      // Styler les en-têtes
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF366092' }
      };
      
      headers.forEach((_, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      // Définir les largeurs de colonnes
      worksheet.columns = [
        { width: 15 }, // SIPI
        { width: 40 }, // Nom Entreprise
        { width: 30 }, // Nom Contact
        { width: 40 }, // Email
        { width: 20 }, // Téléphone
        { width: 25 }, // Ville
        { width: 15 }, // Département
        { width: 12 }, // Année 1
        { width: 20 }, // Montant 1
        { width: 12 }, // Année 2
        { width: 20 }, // Montant 2
        { width: 20 }, // Montant Max
        { width: 15 }, // Latitude
        { width: 15 }  // Longitude
      ];

      // Ajouter les données des entreprises avec contacts AVEC DEBUG DETAILLE
      let contactsFound = 0;
      let contactsMissing = 0;

      companiesInZone.forEach((company, index) => {
        // Normaliser la clé de recherche de la même manière
        const sipiKey = company.sipi_number ? String(company.sipi_number).trim() : '';
        const contactInfo = contactsByWsipi.get(sipiKey);
        
        console.log(`=== ENTREPRISE ${index + 1} ===`);
        console.log(`SIPI original: "${company.sipi_number}" (type: ${typeof company.sipi_number})`);
        console.log(`SIPI normalisé: "${sipiKey}"`);
        console.log(`Contact trouvé: ${contactInfo ? 'OUI' : 'NON'}`);
        
        if (contactInfo) {
          contactsFound++;
          console.log(`✅ Contact: "${contactInfo.contact_name}", Email: "${contactInfo.email}", Phone: "${contactInfo.phone}"`);
        } else {
          contactsMissing++;
          // Tester quelques variations pour le debug
          const alternatives = [
            company.sipi_number?.toString(),
            String(company.sipi_number),
            company.sipi_number
          ];
          console.log(`❌ Aucun contact. Testé: ${alternatives.map(a => `"${a}"`).join(', ')}`);
          
          // Montrer les 3 premiers SIPI de la map pour comparaison
          const premiersCouples = Array.from(contactsByWsipi.keys()).slice(0, 3);
          console.log(`Premiers SIPI dans map: ${premiersCouples.map(k => `"${k}"`).join(', ')}`);
        }

        const rowData = [
          company.sipi_number || '',
          company.company_name || '',
          contactInfo?.contact_name || 'Non renseigné',
          contactInfo?.email || 'Non renseigné', 
          contactInfo?.phone || 'Non renseigné',
          company.city || '',
          company.general_department || '',
          company.year1 || '',
          company.amount1 || 0,
          company.year2 || '',
          company.amount2 || 0,
          company.maxAmount || 0,
          company.latitude || '',
          company.longitude || ''
        ];

        const row = worksheet.addRow(rowData);
        
        // DEBUG: Vérifier ce qui est écrit dans la ligne Excel
        if (index < 3) {
          console.log(`📊 Ligne Excel ${index + 1}:`, {
            sipi: rowData[0],
            nom: rowData[1],
            contact: rowData[2],
            email: rowData[3],
            phone: rowData[4]
          });
        }
        
        // Bordures pour les données
        rowData.forEach((_, cellIndex) => {
          const cell = row.getCell(cellIndex + 1);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      console.log(`RÉSUMÉ CONTACTS: ${contactsFound} trouvés, ${contactsMissing} manquants`);

      // Générer le fichier Excel
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      // Créer le nom de fichier avec date et heure complète
      const maintenant = new Date();
      const annee = maintenant.getFullYear();
      const mois = String(maintenant.getMonth() + 1).padStart(2, '0');
      const jour = String(maintenant.getDate()).padStart(2, '0');
      const heures = String(maintenant.getHours()).padStart(2, '0');
      const minutes = String(maintenant.getMinutes()).padStart(2, '0');
      const secondes = String(maintenant.getSeconds()).padStart(2, '0');
      
      const horodatage = `${annee}-${mois}-${jour}_${heures}h${minutes}m${secondes}s`;
      const locationClean = centerLocation.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
      
      const nomFichier = `Export_Isochrone_${locationClean}_${horodatage}_AVEC_CONTACTS.xlsx`;
      
      console.log('Nom du fichier généré:', nomFichier);

      // Télécharger le fichier
      const url = URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = nomFichier;
      
      document.body.appendChild(lien);
      lien.click();
      document.body.removeChild(lien);
      URL.revokeObjectURL(url);

      console.log('=== EXPORT EXCEL TERMINÉ AVEC SUCCÈS ===');

      toast({
        title: "Export terminé",
        description: `${companiesInZone.length} entreprises exportées avec ${contactsFound} contacts trouvés`,
      });

    } catch (error) {
      console.error('ERREUR EXPORT EXCEL:', error);
      toast({
        title: "Erreur d'export",
        description: `Erreur: ${error.message}`,
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
              onClick={() => {
                console.log('🔥 CLIC EXPORT! Entreprises disponibles:', companiesInZone.length);
                exportToExcel();
              }}
              disabled={companiesInZone.length === 0}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Exporter Excel ({companiesInZone.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {(() => {
        console.log('🔍 RENDU: Entreprises dans la zone =', companiesInZone.length);
        return companiesInZone.length > 0;
      })() && (
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