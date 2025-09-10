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
    
    const { data, error } = await supabase
      .from('companies')
      .select('sipi_number, company_name')
      .eq('sipi_number', cleanSipi)
      .maybeSingle();
    
    if (error || !data) return null;
    
    return {
      name: data.company_name,
      sipi: data.sipi_number
    };
  } catch (error) {
    console.error('Error fetching company:', error);
    return null;
  }
};

/**
 * Valide le format d'un numéro SIPI
 * @param sipi - Numéro SIPI à valider
 * @returns true si le format est valide
 */
export const validateSipiFormat = (sipi: string): boolean => {
  const cleanSipi = sipi.replace(/\D/g, '');
  return cleanSipi.length === 8; // SIPI suisse fait 8 chiffres
};