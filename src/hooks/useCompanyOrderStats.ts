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
}

export const useCompanyOrderStats = () => {
  const [companyStats, setCompanyStats] = useState<CompanyOrderPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanyOrderStats = async (maxThreshold: number) => {
    try {
      setLoading(true);
      setError(null);

      // Récupérer toutes les entreprises avec leurs coordonnées
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id, sipi_number, company_name, latitude, longitude, address1, city, general_department')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (companiesError) throw companiesError;
      console.log(`Entreprises avec coordonnées trouvées: ${companies?.length || 0}`);

      // Récupérer toutes les commandes
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('sipi_number, amount, order_date');

      if (ordersError) throw ordersError;
      console.log(`Commandes trouvées: ${orders?.length || 0}`);

      // Grouper les commandes par SIPI et par année
      const ordersByCompany = new Map<string, Map<number, number>>();
      
      orders?.forEach(order => {
        const year = new Date(order.order_date).getFullYear();
        
        if (!ordersByCompany.has(order.sipi_number)) {
          ordersByCompany.set(order.sipi_number, new Map());
        }
        
        const companyOrders = ordersByCompany.get(order.sipi_number)!;
        const currentAmount = companyOrders.get(year) || 0;
        companyOrders.set(year, currentAmount + (order.amount || 0));
      });

      // Calculer les périodes de 2 années consécutives pour chaque entreprise
      const companyPeriods: CompanyOrderPeriod[] = [];

      console.log(`Début du traitement pour ${companies?.length || 0} entreprises`);
      
      companies?.forEach(company => {
        const companyOrders = ordersByCompany.get(company.sipi_number);
        if (!companyOrders) return;

        // Chercher toutes les paires d'années consécutives
        const years = Array.from(companyOrders.keys()).sort((a, b) => a - b);
        
        for (let i = 0; i < years.length - 1; i++) {
          const year1 = years[i];
          const year2 = years[i + 1];
          
          // Vérifier si les années sont consécutives
          if (year2 - year1 === 1) {
            const amount1 = companyOrders.get(year1) || 0;
            const amount2 = companyOrders.get(year2) || 0;
            const maxAmount = Math.max(amount1, amount2);
            
            // Vérifier si le montant maximum est inférieur ou égal au seuil
            if (maxAmount <= maxThreshold) {
              companyPeriods.push({
                company_id: company.id,
                sipi_number: company.sipi_number,
                company_name: company.company_name,
                year1,
                year2,
                amount1,
                amount2,
                maxAmount,
                latitude: company.latitude,
                longitude: company.longitude,
                address1: company.address1,
                city: company.city,
                general_department: company.general_department
              });
            }
          }
        }
      });

      // Garder seulement la période avec le montant maximum le plus élevé pour chaque entreprise
      const companyMaxPeriods = new Map<string, CompanyOrderPeriod>();
      
      companyPeriods.forEach(period => {
        const existing = companyMaxPeriods.get(period.sipi_number);
        if (!existing || period.maxAmount > existing.maxAmount) {
          companyMaxPeriods.set(period.sipi_number, period);
        }
      });

      const finalResults = Array.from(companyMaxPeriods.values());
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