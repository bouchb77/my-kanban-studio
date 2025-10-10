// Service pour récupérer les informations d'entreprise via le numéro SIPI
import { encryptedCompaniesService } from "./encryptedCompaniesService";

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
    
    // Récupérer toutes les entreprises décryptées
    const companies = await encryptedCompaniesService.getAllCompanies();
    
    // Trouver l'entreprise correspondant au SIPI
    const company = companies.find(c => 
      c.sipiNumber.toLowerCase().startsWith(cleanSipi.toLowerCase())
    );
    
    if (!company) return null;
    
    return {
      name: company.companyName,
      sipi: company.sipiNumber
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
  return cleanSipi.length >= 2;
};