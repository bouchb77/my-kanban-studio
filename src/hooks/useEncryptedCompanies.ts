import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Company, encryptedCompaniesService } from '@/services/encryptedCompaniesService';
import { useToast } from '@/hooks/use-toast';

export const useEncryptedCompanies = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadCompanies = async () => {
    if (!user) {
      setCompanies([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const rawCompanies = await encryptedCompaniesService.getAllCompanies();
      const mappedCompanies = rawCompanies.map(company => encryptedCompaniesService.mapDbCompany(company));
      setCompanies(mappedCompanies);
    } catch (error) {
      console.error('Error loading encrypted companies:', error);
      toast({ 
        title: "Erreur", 
        description: "Impossible de charger les entreprises", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCompaniesByArticles = async (articleCodes: string[] | null, lisOnly: boolean) => {
    if (!user) {
      setCompanies([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const rawCompanies = await encryptedCompaniesService.getCompaniesByArticles(articleCodes, lisOnly);
      const mappedCompanies = rawCompanies.map(company => encryptedCompaniesService.mapDbCompany(company));
      setCompanies(mappedCompanies);
    } catch (error) {
      console.error('Error loading companies by articles:', error);
      toast({ 
        title: "Erreur", 
        description: "Impossible de charger les entreprises filtrées", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const createCompany = async (companyData: Partial<Company>): Promise<Company | null> => {
    if (!user) return null;
    
    try {
      const dbCompanyData = encryptedCompaniesService.companyToDbFormat(companyData);
      const rawCompany = await encryptedCompaniesService.createCompany(dbCompanyData);
      const newCompany = encryptedCompaniesService.mapDbCompany(rawCompany);
      
      setCompanies(prev => [newCompany, ...prev]);
      
      toast({ 
        title: "Entreprise créée", 
        description: "L'entreprise a été créée avec succès" 
      });
      
      return newCompany;
    } catch (error) {
      console.error('Error creating company:', error);
      toast({ 
        title: "Erreur", 
        description: "Impossible de créer l'entreprise", 
        variant: "destructive" 
      });
      return null;
    }
  };

  const updateCompany = async (companyId: string, updates: Partial<Company>): Promise<Company | null> => {
    if (!user) return null;
    
    try {
      const dbUpdates = encryptedCompaniesService.companyToDbFormat(updates);
      const rawCompany = await encryptedCompaniesService.updateCompany(companyId, dbUpdates);
      const updatedCompany = encryptedCompaniesService.mapDbCompany(rawCompany);
      
      setCompanies(prev => prev.map(company => 
        company.id === companyId ? updatedCompany : company
      ));
      
      return updatedCompany;
    } catch (error) {
      console.error('Error updating company:', error);
      toast({ 
        title: "Erreur", 
        description: "Impossible de mettre à jour l'entreprise", 
        variant: "destructive" 
      });
      return null;
    }
  };

  const deleteCompany = async (companyId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      await encryptedCompaniesService.deleteCompany(companyId);
      
      setCompanies(prev => prev.filter(company => company.id !== companyId));
      
      toast({ 
        title: "Entreprise supprimée", 
        description: "L'entreprise a été supprimée avec succès" 
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting company:', error);
      toast({ 
        title: "Erreur", 
        description: "Impossible de supprimer l'entreprise", 
        variant: "destructive" 
      });
      return false;
    }
  };

  const bulkUpsertCompanies = async (companies: Partial<Company>[]): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const dbCompanies = companies.map(c => encryptedCompaniesService.companyToDbFormat(c));
      await encryptedCompaniesService.bulkUpsertCompanies(dbCompanies);
      
      await loadCompanies();
      
      return true;
    } catch (error) {
      console.error('Error bulk upserting companies:', error);
      toast({ 
        title: "Erreur", 
        description: "Impossible d'importer les entreprises", 
        variant: "destructive" 
      });
      return false;
    }
  };

  useEffect(() => {
    loadCompanies();
  }, [user]);

  return {
    companies,
    loading,
    loadCompanies,
    loadCompaniesByArticles,
    createCompany,
    updateCompany,
    deleteCompany,
    bulkUpsertCompanies,
  };
};
