import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CompanyOrderPeriod {
  company_id: string;
  sipi_number: string;
  company_name: string;
  year1: number;
  year2: number;
  amount1: number;
  amount2: number;
  maxAmount: number;
  latitude?: number;
  longitude?: number;
  address1?: string;
  city?: string;
  general_department?: string;
  quality?: string;
}

export const useCompanyOrderStats = () => {
  const [companyStats, setCompanyStats] = useState<CompanyOrderPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanyOrderStats = async (maxThreshold: number) => {
    try {
      setLoading(true);
      setError(null);

      // Récupérer toutes les entreprises avec leurs coordonnées (avec pagination)
      let allCompanies: any[] = [];
      let companiesFrom = 0;
      const companiesBatchSize = 1000;
      let hasMoreCompanies = true;

      while (hasMoreCompanies) {
        const { data: companiesBatch, error: companiesError } = await supabase
          .from('companies')
          .select('id, sipi_number, company_name, latitude, longitude, address1, city, general_department, quality')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .range(companiesFrom, companiesFrom + companiesBatchSize - 1);

        if (companiesError) throw companiesError;

        if (companiesBatch && companiesBatch.length > 0) {
          allCompanies = [...allCompanies, ...companiesBatch];
          companiesFrom += companiesBatchSize;
          hasMoreCompanies = companiesBatch.length === companiesBatchSize;
        } else {
          hasMoreCompanies = false;
        }
      }

      console.log(`Entreprises avec coordonnées trouvées: ${allCompanies.length}`);

      // Récupérer toutes les commandes (avec pagination)
      let allOrders: any[] = [];
      let ordersFrom = 0;
      const ordersBatchSize = 1000;
      let hasMoreOrders = true;

      while (hasMoreOrders) {
        const { data: ordersBatch, error: ordersError } = await supabase
          .from('orders')
          .select('sipi_number, amount, order_date')
          .range(ordersFrom, ordersFrom + ordersBatchSize - 1);

        if (ordersError) throw ordersError;

        if (ordersBatch && ordersBatch.length > 0) {
          allOrders = [...allOrders, ...ordersBatch];
          ordersFrom += ordersBatchSize;
          hasMoreOrders = ordersBatch.length === ordersBatchSize;
        } else {
          hasMoreOrders = false;
        }
      }

      console.log(`Commandes trouvées: ${allOrders.length}`);

      // Grouper les commandes par SIPI et par période
      const ordersByCompany = new Map<string, { period2023_2024: number, period2024_2025: number }>();
      
      console.log('Début du groupement des commandes...');
      let processedOrders = 0;
      
      allOrders?.forEach(order => {
        const orderDate = new Date(order.order_date);
        processedOrders++;
        
        if (!ordersByCompany.has(order.sipi_number)) {
          ordersByCompany.set(order.sipi_number, { period2023_2024: 0, period2024_2025: 0 });
        }
        
        const companyOrders = ordersByCompany.get(order.sipi_number)!;
        
        // Période 2023-2024: du 1/1/2023 au 31/12/2024
        if (orderDate >= new Date('2023-01-01') && orderDate <= new Date('2024-12-31')) {
          companyOrders.period2023_2024 += (order.amount || 0);
        }
        
        // Période 2024-2025: du 1/1/2024 au 31/12/2025
        if (orderDate >= new Date('2024-01-01') && orderDate <= new Date('2025-12-31')) {
          companyOrders.period2024_2025 += (order.amount || 0);
        }
      });

      console.log(`Commandes traitées: ${processedOrders}`);
      console.log(`Entreprises ayant des commandes: ${ordersByCompany.size}`);
      
      // Afficher un échantillon des données groupées
      const sampleEntries = Array.from(ordersByCompany.entries()).slice(0, 3);
      console.log('Échantillon des commandes groupées par période:', sampleEntries);

      // Vérifier le matching entre entreprises et commandes
      const companySipis = new Set(allCompanies?.map(c => c.sipi_number) || []);
      const orderSipis = new Set(Array.from(ordersByCompany.keys()));
      
      console.log(`SIPI des entreprises (échantillon):`, Array.from(companySipis).slice(0, 10));
      console.log(`SIPI des commandes (échantillon):`, Array.from(orderSipis).slice(0, 10));
      
      const matchingSipis = Array.from(companySipis).filter(sipi => orderSipis.has(sipi));
      console.log(`Entreprises avec commandes correspondantes: ${matchingSipis.length}/${companySipis.size}`);
      
      if (matchingSipis.length === 0) {
        console.error('PROBLÈME: Aucun SIPI ne correspond entre entreprises et commandes!');
        console.log('Exemple SIPI entreprise:', Array.from(companySipis)[0]);
        console.log('Exemple SIPI commande:', Array.from(orderSipis)[0]);
      }

      // Calculer les périodes spécifiques pour chaque entreprise
      const companyPeriods: CompanyOrderPeriod[] = [];

      console.log(`Début du traitement pour ${allCompanies?.length || 0} entreprises`);
      
      allCompanies?.forEach(company => {
  const companyOrders = ordersByCompany.get(company.sipi_number);
  
  // N'ajouter l'entreprise que si elle a des commandes dans l'une des périodes
  if (companyOrders) {
    const sum2023_2024 = companyOrders.period2023_2024;
    const sum2024_2025 = companyOrders.period2024_2025;
    
    // Condition : Inclure l'entreprise seulement si au moins une période a un montant supérieur à 0
    // ET si les deux montants sont inférieurs ou égaux au seuil maximum
    if ((sum2023_2024 > 0 || sum2024_2025 > 0) && sum2023_2024 <= maxThreshold && sum2024_2025 <= maxThreshold) {
      const newPeriod: CompanyOrderPeriod = {
        company_id: company.id,
        sipi_number: company.sipi_number,
        company_name: company.company_name,
        // Ces années ne sont plus pertinentes comme "période principale"
        // mais nous les gardons pour la structure
        year1: 2023, 
        year2: 2024,
        // Assigner les montants totaux pour chaque période
        amount1: sum2023_2024,
        amount2: sum2024_2025,
        // maxAmount peut être utilisé pour le tri ou le filtrage
        maxAmount: Math.max(sum2023_2024, sum2024_2025),
        latitude: company.latitude,
        longitude: company.longitude,
        address1: company.address1,
        city: company.city,
        general_department: company.general_department,
        quality: company.quality
      };
      companyPeriods.push(newPeriod);
    }
  }
});

      console.log(`Entreprises avec commandes: ${companiesWithOrders}`);
      console.log(`Périodes trouvées répondant aux critères: ${totalPeriods}`);
      console.log(`Entreprises finales: ${companyPeriods.length}`);

      // Pas besoin de filtrer par montant max ici car c'est déjà fait
      const finalResults = companyPeriods;
      console.log(`Entreprises trouvées avec seuil ${maxThreshold}€:`, finalResults.length);
      console.log('Échantillon des résultats:', finalResults.slice(0, 5));
      
      setCompanyStats(finalResults);
    } catch (err) {
      console.error('Erreur lors du chargement des statistiques des entreprises:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return {
    companyStats,
    loading,
    error,
    fetchCompanyOrderStats
  };
};