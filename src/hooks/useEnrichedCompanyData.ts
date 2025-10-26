import { useState } from 'react';
import { CompanyOrderPeriod } from './useCompanyOrderStats';
import { encryptedContactsService } from '@/services/encryptedContactsService';

export const useEnrichedCompanyData = () => {
  const [isEnriching, setIsEnriching] = useState(false);

  const enrichWithContacts = async (companies: CompanyOrderPeriod[]): Promise<CompanyOrderPeriod[]> => {
    if (companies.length === 0) return companies;

    setIsEnriching(true);
    
    try {
      console.log('🔐 Enrichissement des données avec contacts décryptés...');
      
      // Récupérer les numéros SIPI
      const sipiNumbers = companies
        .map(c => c.sipi_number)
        .filter(Boolean);
      
      console.log(`📊 Récupération des contacts pour ${sipiNumbers.length} entreprises`);
      
      // Récupérer et décrypter les contacts par lots
      let allContacts: any[] = [];
      const batchSize = 100;
      
      for (let i = 0; i < sipiNumbers.length; i += batchSize) {
        const sipiBatch = sipiNumbers.slice(i, i + batchSize);
        console.log(`📞 Lot ${Math.floor(i/batchSize) + 1}/${Math.ceil(sipiNumbers.length/batchSize)} (${sipiBatch.length} SIPI)...`);
        
        try {
          const contactsBatch = await encryptedContactsService.getContactsBySipiNumbers(sipiBatch);
          
          if (contactsBatch && contactsBatch.length > 0) {
            allContacts.push(...contactsBatch);
            console.log(`✅ ${contactsBatch.length} contacts récupérés`);
          }
        } catch (error) {
          console.error('❌ Erreur lors de la récupération des contacts:', error);
          continue;
        }
      }
      
      console.log(`✅ Total contacts chargés: ${allContacts.length}`);
      
      // Créer un index des contacts par SIPI
      const contactsByWsipi = new Map();
      allContacts.forEach(contact => {
        if (contact.sipi_number) {
          const sipiKey = String(contact.sipi_number).trim();
          contactsByWsipi.set(sipiKey, {
            contact_name: contact.contact_name,
            email: contact.email,
            phone: contact.phone
          });
        }
      });
      
      console.log(`INDEX CONTACTS - TAILLE MAP: ${contactsByWsipi.size}`);
      
      // Enrichir les entreprises avec les contacts
      const enrichedCompanies = companies.map(company => {
        const sipiKey = company.sipi_number ? String(company.sipi_number).trim() : '';
        const contactInfo = contactsByWsipi.get(sipiKey);
        
        return {
          ...company,
          contact_name: contactInfo?.contact_name || undefined,
          email: contactInfo?.email || undefined,
          phone: contactInfo?.phone || undefined
        };
      });
      
      const companiesWithContacts = enrichedCompanies.filter(c => c.contact_name || c.email || c.phone).length;
      console.log(`🎯 Entreprises enrichies: ${companiesWithContacts}/${enrichedCompanies.length}`);
      
      return enrichedCompanies;
    } catch (error) {
      console.error('❌ Erreur lors de l\'enrichissement:', error);
      return companies;
    } finally {
      setIsEnriching(false);
    }
  };

  return { enrichWithContacts, isEnriching };
};
