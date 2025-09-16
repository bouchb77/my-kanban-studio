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

      // Récupérer toutes les entreprises avec leurs coordonnées (avec pagination)
      let allCompanies: any[] = [];
      let companiesFrom = 0;
      const companiesBatchSize = 1000;
      let hasMoreCompanies = true;

      while (hasMoreCompanies) {
        const { data: companiesBatch, error: companiesError } = await supabase
          .from('companies')
          .select('id, sipi_number, company_name, latitude, longitude, address1, city, general_department')
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

      // Grouper les commandes par SIPI et par année
      const ordersByCompany = new Map<string, Map<number, number>>();
      
      console.log('Début du groupement des commandes...');
      let processedOrders = 0;
      
      allOrders?.forEach(order => {
        const year = new Date(order.order_date).getFullYear();
        processedOrders++;
        
        if (!ordersByCompany.has(order.sipi_number)) {
          ordersByCompany.set(order.sipi_number, new Map());
        }
        
        const companyOrders = ordersByCompany.get(order.sipi_number)!;
        const currentAmount = companyOrders.get(year) || 0;
        companyOrders.set(year, currentAmount + (order.amount || 0));
      });

      console.log(`Commandes traitées: ${processedOrders}`);
      console.log(`Entreprises ayant des commandes: ${ordersByCompany.size}`);
      
      // Afficher un échantillon des données groupées
      const sampleEntries = Array.from(ordersByCompany.entries()).slice(0, 3);
      console.log('Échantillon des commandes groupées:', sampleEntries.map(([sipi, orders]) => ({
        sipi,
        orders: Array.from(orders.entries())
      })));

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
      
      let companiesWithOrders = 0;
      let totalPeriods = 0;
      
      allCompanies?.forEach(company => {
        const companyOrders = ordersByCompany.get(company.sipi_number);
        if (!companyOrders) {
          return;
        }
        
        companiesWithOrders++;

        // Calculer les sommes pour les périodes spécifiques 2023+2024 et 2024+2025
        const amount2023 = companyOrders.get(2023) || 0;
        const amount2024 = companyOrders.get(2024) || 0;
        const amount2025 = companyOrders.get(2025) || 0;
        
        const sum2023_2024 = amount2023 + amount2024;
        const sum2024_2025 = amount2024 + amount2025;
        
        console.log(`Entreprise ${company.sipi_number} (${company.company_name}): 2023=${amount2023}€, 2024=${amount2024}€, 2025=${amount2025}€`);
        console.log(`  Sommes: 2023+2024=${sum2023_2024}€, 2024+2025=${sum2024_2025}€, seuil=${maxThreshold}€`);
        
        // Vérifier si au moins une période respecte le critère ET qu'il y a des données
        if ((sum2023_2024 > 0 || sum2024_2025 > 0)) {
          
          // Prendre la période avec le montant le plus élevé qui respecte le critère
          let selectedPeriod: CompanyOrderPeriod | null = null;
          
          // Choisir la meilleure période (priorité à 2024+2025 si disponible)
          if (sum2024_2025 <= maxThreshold && sum2024_2025 > 0) {
            selectedPeriod = {
              company_id: company.id,
              sipi_number: company.sipi_number,
              company_name: company.company_name,
              year1: 2024,
              year2: 2025,
              amount1: amount2024,
              amount2: amount2025,
              maxAmount: sum2024_2025,
              latitude: company.latitude,
              longitude: company.longitude,
              address1: company.address1,
              city: company.city,
              general_department: company.general_department
            };
          } else if (sum2023_2024 <= maxThreshold && sum2023_2024 > 0) {
            selectedPeriod = {
              company_id: company.id,
              sipi_number: company.sipi_number,
              company_name: company.company_name,
              year1: 2023,
              year2: 2024,
              amount1: amount2023,
              amount2: amount2024,
              maxAmount: sum2023_2024,
              latitude: company.latitude,
              longitude: company.longitude,
              address1: company.address1,
              city: company.city,
              general_department: company.general_department
            };
          }
          
          if (selectedPeriod) {
            totalPeriods++;
            companyPeriods.push(selectedPeriod);
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