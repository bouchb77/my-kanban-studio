// Service pour récupérer les informations d'entreprise via le numéro SIPI
// En production, ceci ferait appel à une API externe réelle

interface CompanyInfo {
  name: string;
  sipi: string;
}

// Base de données simulée d'entreprises (à remplacer par une vraie API)
const mockCompanies: Record<string, CompanyInfo> = {
  "12345678": { name: "Tech Solutions SA", sipi: "12345678" },
  "87654321": { name: "Innovation Corp", sipi: "87654321" },
  "11111111": { name: "Digital Services SARL", sipi: "11111111" },
  "22222222": { name: "Business Consulting SA", sipi: "22222222" },
  "33333333": { name: "Creative Agency SARL", sipi: "33333333" }
};

/**
 * Récupère les informations d'une entreprise à partir de son numéro SIPI
 * @param sipi - Numéro SIPI de l'entreprise
 * @returns Informations de l'entreprise ou null si non trouvée
 */
export const getCompanyBySipi = async (sipi: string): Promise<CompanyInfo | null> => {
  // Simuler un délai d'API
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Nettoyer le numéro SIPI (enlever espaces et caractères non numériques)
  const cleanSipi = sipi.replace(/\D/g, '');
  
  if (cleanSipi.length === 0) return null;
  
  return mockCompanies[cleanSipi] || null;
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