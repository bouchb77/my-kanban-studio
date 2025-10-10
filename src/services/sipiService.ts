// Service pour récupérer les informations d'entreprise via le numéro SIPI
import { supabase } from "@/integrations/supabase/client";

interface CompanyInfo {
  name: string;
  sipi: string;
}

/**
 * Récupère les informations d'une entreprise à partir de son numéro SIPI
 * @param sipi - Numéro SIPI de l'entreprise
 * @returns Informations de l'entreprise ou null si non trouvée
 */
export const getCompanyBySipi = async (sipi: string): Promise<CompanyInfo | null> => {
  try {
    // Nettoyer le numéro SIPI (enlever espaces et caractères non numériques)
    const cleanSipi = sipi.replace(/\D/g, '');
    
    if (cleanSipi.length === 0) return null;
    
    // Appeler la fonction edge pour récupérer les données chiffrées
    const { data, error } = await supabase.functions.invoke('encrypted-companies', {
      body: { method: 'SELECT' }
    });
    
    if (error || !data) return null;
    
    // Les données décryptées sont directement dans data.data
    const companies = data.data || [];
    const matchingCompany = companies.find((c: any) => 
      c.sipi_number && c.sipi_number.startsWith(cleanSipi)
    );
    
    if (!matchingCompany) return null;
    
    return {
      name: matchingCompany.company_name,
      sipi: matchingCompany.sipi_number
    };
  } catch (error) {
    console.error('Error fetching company:', error);
    return null;
  }
};

/**
 * Recherche des entreprises par numéro SIPI ou nom (pour autocomplétion)
 * @param query - Recherche par SIPI ou nom
 * @param limit - Nombre max de résultats
 * @returns Liste d'entreprises correspondantes
 */
export const searchCompanies = async (query: string, limit: number = 10): Promise<CompanyInfo[]> => {
  try {
    console.log('🔍 Searching companies with query:', query);
    
    if (!query || query.length < 2) {
      console.log('❌ Query too short');
      return [];
    }
    
    const cleanQuery = query.toLowerCase().trim();
    
    // Appeler la fonction edge pour récupérer les données chiffrées
    console.log('📡 Calling encrypted-companies edge function...');
    const { data, error } = await supabase.functions.invoke('encrypted-companies', {
      body: { method: 'SELECT' }
    });
    
    if (error) {
      console.error('❌ Error from edge function:', error);
      return [];
    }
    
    if (!data) {
      console.log('❌ No data returned');
      return [];
    }
    
    console.log('✅ Received data, companies count:', data.data?.length || 0);
    
    const companies = data.data || [];
    
    // Filtrer par SIPI ou nom d'entreprise
    const results = companies
      .filter((c: any) => {
        if (!c.sipi_number && !c.company_name) return false;
        const sipiMatch = c.sipi_number && c.sipi_number.toLowerCase().includes(cleanQuery);
        const nameMatch = c.company_name && c.company_name.toLowerCase().includes(cleanQuery);
        return sipiMatch || nameMatch;
      })
      .slice(0, limit)
      .map((c: any) => ({
        name: c.company_name,
        sipi: c.sipi_number
      }));
    
    console.log('✅ Found', results.length, 'matching companies');
    return results;
  } catch (error) {
    console.error('❌ Error searching companies:', error);
    return [];
  }
};

/**
 * Valide le format d'un numéro SIPI
 * @param sipi - Numéro SIPI à valider
 * @returns true si le format est valide
 */
export const validateSipiFormat = (sipi: string): boolean => {
  const cleanSipi = sipi.replace(/\D/g, '');
  return cleanSipi.length >= 2;
};