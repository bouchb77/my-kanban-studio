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
import exportToExcel from '@/components/IsochroneCalculator';

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
      
      // Récupérer les contacts correspondants aux entreprises dans la zone
      console.log('🚀 Récupération des contacts pour les entreprises dans la zone...');
      const inZoneCompanySipis = companiesInZone
        .map(c => c.sipi_number)
        .filter(Boolean); // Enlever les valeurs nulles/undefined
      
      console.log('📊 Numéros SIPI à rechercher:', inZoneCompanySipis.length, 'entreprises');
      console.log('📊 Échantillon SIPI zone:', inZoneCompanySipis.slice(0, 10));
      
      let allMatchingContacts: any[] = [];
      const batchSize = 50; // Traiter par lots de 50 SIPI pour éviter les URLs trop longues
      
      for (let i = 0; i < inZoneCompanySipis.length; i += batchSize) {
        const sipiBatch = inZoneCompanySipis.slice(i, i + batchSize);
        console.log(`📞 Récupération des contacts pour le lot ${Math.floor(i/batchSize) + 1}/${Math.ceil(inZoneCompanySipis.length/batchSize)} (${sipiBatch.length} SIPI)...`);
        
        try {
          const { data: contactsBatch, error: contactsError } = await supabase
            .from('contacts')
            .select('sipi_number, contact_name, email, phone')
            .in('sipi_number', sipiBatch);

          if (contactsError) {
            console.error('🚨 ERREUR récupération contacts batch:', contactsError);
            // Continuer même en cas d'erreur pour ne pas bloquer l'export
            continue; 
          }

          if (contactsBatch && contactsBatch.length > 0) {
            allMatchingContacts.push(...contactsBatch);
            console.log(`✅ ${contactsBatch.length} contacts récupérés pour ce lot`);
            console.log(`📞 Échantillon contacts lot:`, contactsBatch.slice(0, 3).map(c => `${c.sipi_number}: ${c.contact_name}`));
          } else {
            console.log(`⚠️ Aucun contact trouvé pour ce lot de ${sipiBatch.length} SIPI`);
          }
        } catch (error) {
          console.error('❌ Erreur inattendue lors de la récupération des contacts:', error);
          continue;
        }
      }
      
      console.log(`🎯 TOTAL CONTACTS CORRESPONDANTS RÉCUPÉRÉS: ${allMatchingContacts.length}`);
      
      // Créer un index des contacts par SIPI avec debug détaillé
      const contactsByWsipi = new Map();
      let contactsAvecSipi = 0;
      let contactsSansSipi = 0;
      
      allMatchingContacts.forEach((contact, index) => {
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
      
      console.log('🔍 DÉBUT DE LA CORRESPONDANCE ENTREPRISES <-> CONTACTS');
      console.log(`📊 Entreprises dans la zone: ${companiesInZone.length}`);
      console.log(`📊 Contacts disponibles: ${contactsByWsipi.size}`);
      
      // Montrer les premières clés de la map pour debug
      const premieresCles = Array.from(contactsByWsipi.keys()).slice(0, 10);
      console.log('🔑 Premiers SIPI dans la map des contacts:', premieresCles);
      
      // Montrer les premiers SIPI des entreprises pour comparaison
      const premiersSipiEntreprises = companiesInZone.slice(0, 10).map(c => c.sipi_number);
      console.log('🏢 Premiers SIPI des entreprises zone:', premiersSipiEntreprises);

      companiesInZone.forEach((company, index) => {
        // Normaliser la clé de recherche de la même manière
        const sipiKey = company.sipi_number ? String(company.sipi_number).trim() : '';
        const contactInfo = contactsByWsipi.get(sipiKey);
        
        if (index < 5) { // Debug seulement pour les 5 premiers
          console.log(`=== ENTREPRISE ${index + 1} ===`);
          console.log(`SIPI original: "${company.sipi_number}" (type: ${typeof company.sipi_number})`);
          console.log(`SIPI normalisé: "${sipiKey}"`);
          console.log(`Contact trouvé: ${contactInfo ? 'OUI' : 'NON'}`);
        }
        
        if (contactInfo) {
          contactsFound++;
          if (index < 5) {
            console.log(`✅ Contact: "${contactInfo.contact_name}", Email: "${contactInfo.email}", Phone: "${contactInfo.phone}"`);
          }
        } else {
          contactsMissing++;
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
      
      // RÉSUMÉ FINAL DE LA CORRESPONDANCE
      console.log('🎯 RÉSUMÉ FINAL DE LA CORRESPONDANCE:');
      console.log(`✅ Entreprises avec contact: ${contactsFound}`);
      console.log(`❌ Entreprises sans contact: ${contactsMissing}`);
      console.log(`📊 Taux de correspondance: ${((contactsFound / companiesInZone.length) * 100).toFixed(1)}%`);

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