import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as ExcelJS from 'exceljs';
import { CompanyOrderPeriod } from '@/hooks/useCompanyOrderStats';

interface IsochronePoint {
  lat: number;
  lng: number;
}

export const useIsochroneExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const exportToExcel = async (
    companiesInZone: CompanyOrderPeriod[],
    centerLocation: string,
    maxThreshold: number
  ) => {
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

    setIsExporting(true);

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
            continue; 
          }

          if (contactsBatch && contactsBatch.length > 0) {
            allMatchingContacts.push(...contactsBatch);
            console.log(`✅ ${contactsBatch.length} contacts récupérés pour ce lot`);
          }
        } catch (error) {
          console.error('❌ Erreur inattendue lors de la récupération des contacts:', error);
          continue;
        }
      }
      
      console.log(`🎯 TOTAL CONTACTS CORRESPONDANTS RÉCUPÉRÉS: ${allMatchingContacts.length}`);
      
      // Créer un index des contacts par SIPI
      const contactsByWsipi = new Map();
      allMatchingContacts.forEach(contact => {
        if (contact.sipi_number) {
          const sipiKey = String(contact.sipi_number).trim();
          contactsByWsipi.set(sipiKey, contact);
        }
      });
      
      console.log(`INDEX CONTACTS - TAILLE MAP: ${contactsByWsipi.size}`);

      // Créer le workbook Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Entreprises_Isochrone_avec_Contacts');

      // Définir les en-têtes de colonnes
      worksheet.columns = [
        { header: 'SIPI', key: 'sipi_number', width: 15 },
        { header: 'Nom Entreprise', key: 'company_name', width: 40 },
        { header: 'Nom Contact', key: 'contact_name', width: 30 },
        { header: 'Email Contact', key: 'email', width: 40 },
        { header: 'Téléphone Contact', key: 'phone', width: 20 },
        { header: 'Ville', key: 'city', width: 25 },
        { header: 'Département', key: 'general_department', width: 15 },
        { header: 'Période 2023-2024 (€)', key: 'period_2023_2024', width: 20 },
        { header: 'Période 2024-2025 (€)', key: 'period_2024_2025', width: 20 },
        { header: 'Montant Maximum (€)', key: 'maxAmount', width: 20 },
        { header: 'Latitude', key: 'latitude', width: 15 },
        { header: 'Longitude', key: 'longitude', width: 15 }
      ];

      // Style de l'en-tête
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Ajouter les données des entreprises avec contacts
      let contactsFound = 0;
      let contactsMissing = 0;
      
      companiesInZone.forEach((company) => {
        const sipiKey = company.sipi_number ? String(company.sipi_number).trim() : '';
        const contactInfo = contactsByWsipi.get(sipiKey);
        
        if (contactInfo) {
          contactsFound++;
        } else {
          contactsMissing++;
        }

        worksheet.addRow({
          sipi_number: company.sipi_number,
          company_name: company.company_name,
          contact_name: contactInfo?.contact_name || 'Non renseigné',
          email: contactInfo?.email || 'Non renseigné',
          phone: contactInfo?.phone || 'Non renseigné',
          city: company.city,
          general_department: company.general_department,
          period_2023_2024: (company.year1 === 2023 && company.year2 === 2024) ? company.amount1 : (company.year1 === 2024 && company.year2 === 2025) ? 0 : company.amount1,
          period_2024_2025: (company.year1 === 2023 && company.year2 === 2024) ? company.amount2 : (company.year1 === 2024 && company.year2 === 2025) ? company.amount1 : company.amount2,
          maxAmount: company.maxAmount,
          latitude: company.latitude,
          longitude: company.longitude
        });
      });
      
      console.log('🎯 RÉSUMÉ FINAL:');
      console.log(`✅ Entreprises avec contact: ${contactsFound}`);
      console.log(`❌ Entreprises sans contact: ${contactsMissing}`);

      // Générer et télécharger le fichier
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const cleanLocation = centerLocation.replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '_');
      const date = new Date().toISOString().split('T')[0];
      link.download = `entreprises_zone_isochrone_${cleanLocation}_${maxThreshold}€_${date}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export réussi",
        description: `${companiesInZone.length} entreprises exportées avec ${contactsFound} contacts trouvés`,
      });

    } catch (err) {
      console.error('Erreur lors de l\'export:', err);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'export Excel",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return { exportToExcel, isExporting };
};