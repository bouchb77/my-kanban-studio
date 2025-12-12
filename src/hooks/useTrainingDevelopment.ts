import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { encryptedCompaniesService } from '@/services/encryptedCompaniesService';

export interface TrainingDevelopmentMetrics {
  sipi_number: string;
  company_name: string;
  training_year: number;
  training_year_quantity: number;
  training_year_references: number;
  training_year_amount: number;
  // N-1 (année précédente)
  year_minus_1_quantity: number;
  year_minus_1_references: number;
  year_minus_1_amount: number;
  // N-2
  year_minus_2_quantity: number;
  year_minus_2_references: number;
  year_minus_3_quantity: number;
  year_minus_3_references: number;
  year_minus_4_quantity: number;
  year_minus_4_references: number;
  // Croissance vs N-1
  increase_vs_minus_1: number;
  growth_vs_minus_1: number;
  new_references_vs_minus_1: number;
  amount_increase_vs_minus_1: number;
  amount_growth_vs_minus_1: number;
  // Croissance vs autres années
  increase_vs_minus_2: number;
  increase_vs_minus_3: number;
  increase_vs_minus_4: number;
  growth_vs_minus_2: number;
  growth_vs_minus_3: number;
  growth_vs_minus_4: number;
  new_references_vs_minus_2: number;
  new_references_vs_minus_3: number;
  new_references_vs_minus_4: number;
  renewal_rate_vs_minus_2: number;
  development_generated: boolean;
  // Nouvelles métriques d'expiration
  expired_quantity: number;
  active_quantity: number;
  expiring_soon_quantity: number; // < 3 mois
  next_expiration_date: string | null;
  expired_percentage: number;
}

export const useTrainingDevelopment = (formateur: string, trainingYear: number) => {
  const [metrics, setMetrics] = useState<TrainingDevelopmentMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateDevelopment = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[TrainingDevelopment] Début du calcul pour', formateur, trainingYear);

      // 1. Récupérer les départements du formateur (ou tous si formateur === '_tous_')
      let departmentNames: string[];
      
      if (formateur === '_tous_') {
        // Récupérer tous les départements
        const { data: allDepartments } = await supabase
          .from('department_management')
          .select('department_name');
        
        departmentNames = allDepartments?.map(d => d.department_name) || [];
        console.log('[TrainingDevelopment] Tous les départements:', departmentNames.length);
      } else {
        // Récupérer les départements d'un formateur spécifique
        const { data: departments } = await supabase
          .from('department_management')
          .select('department_name')
          .eq('formateur', formateur);

        console.log('[TrainingDevelopment] Départements trouvés:', departments?.length);

        if (!departments || departments.length === 0) {
          console.log('[TrainingDevelopment] Aucun département trouvé');
          setMetrics([]);
          return;
        }

        departmentNames = departments.map(d => d.department_name);
      }

      // 2A. Récupérer les entreprises avec formations PAYANTES (FSITE/FSITEJ) de l'année
      const { data: trainedCompanies } = await supabase
        .from('orders')
        .select(`
          sipi_number,
          order_number,
          order_date
        `)
        .gte('order_date', `${trainingYear}-01-01`)
        .lte('order_date', `${trainingYear}-12-31`);

      console.log('[TrainingDevelopment] Commandes trouvées pour année', trainingYear, ':', trainedCompanies?.length);

      // Filtrer les commandes avec FSITE ou FSITEJ pour formations payantes
      const orderNumbers = trainedCompanies?.map(o => o.order_number) || [];
      const { data: orderDetails } = await supabase
        .from('order_details')
        .select('order_number, article_code')
        .in('order_number', orderNumbers)
        .in('article_code', ['FSITE', 'FSITEJ']);

      const trainedOrderNumbers = new Set(orderDetails?.map(od => od.order_number) || []);
      const paidTrainedSipiNumbers = new Set(
        trainedCompanies?.filter(o => trainedOrderNumbers.has(o.order_number)).map(o => o.sipi_number) || []
      );

      console.log('[TrainingDevelopment] Entreprises avec formations payantes (FSITE/FSITEJ):', paidTrainedSipiNumbers.size);

      // 2B. Récupérer les entreprises avec formations GRATUITES (report_creation_date) de l'année
      const { data: freeTrainedCompanies } = await supabase
        .from('companies')
        .select('sipi_number')
        .gte('report_creation_date', `${trainingYear}-01-01`)
        .lte('report_creation_date', `${trainingYear}-12-31`)
        .in('general_department', departmentNames);

      const freeTrainedSipiNumbers = new Set(freeTrainedCompanies?.map(c => c.sipi_number) || []);
      
      console.log('[TrainingDevelopment] Entreprises avec formations gratuites (report_creation_date):', freeTrainedSipiNumbers.size);

      // 2C. Combiner les deux types de formations (payantes + gratuites)
      const allTrainedSipiNumbers = new Set([...paidTrainedSipiNumbers, ...freeTrainedSipiNumbers]);
      
      console.log('[TrainingDevelopment] Total entreprises formées (payantes + gratuites):', allTrainedSipiNumbers.size);

      if (allTrainedSipiNumbers.size === 0) {
        console.log('[TrainingDevelopment] Aucune entreprise formée trouvée');
        setMetrics([]);
        return;
      }

      // 3. Récupérer les infos des entreprises formées
      const { data: companies } = await supabase
        .from('companies')
        .select('sipi_number, company_name, general_department')
        .in('sipi_number', Array.from(allTrainedSipiNumbers))
        .in('general_department', departmentNames);

      console.log('[TrainingDevelopment] Entreprises dans départements formateur:', companies?.length);

      if (!companies || companies.length === 0) {
        console.log('[TrainingDevelopment] Aucune entreprise trouvée après filtrage département');
        setMetrics([]);
        return;
      }

      // 4. Décrypter les noms d'entreprises
      const allDecryptedCompanies = await encryptedCompaniesService.getAllCompanies();
      const companyNameMap = new Map(
        allDecryptedCompanies.map(c => [c.sipiNumber, c.companyName])
      );

      // 5. Pour chaque entreprise, calculer les quantités pour l'année de formation et les années précédentes
      const developmentMetrics: TrainingDevelopmentMetrics[] = [];

      for (const company of companies) {
        // Fonction helper pour récupérer les données d'une année
        const getYearData = async (year: number): Promise<{ 
          quantity: number; 
          references: Set<string>;
          amount: number;
          expired: number;
          active: number;
          expiringSoon: number;
          nextExpiration: Date | null;
        }> => {
          const { data: orders } = await supabase
            .from('orders')
            .select('order_number, amount')
            .eq('sipi_number', company.sipi_number)
            .gte('order_date', `${year}-01-01`)
            .lte('order_date', `${year}-12-31`);

          const orderNumbers = orders?.map(o => o.order_number) || [];
          const totalAmount = orders?.reduce((sum, o) => sum + (o.amount || 0), 0) || 0;
          
          if (orderNumbers.length === 0) {
            return { 
              quantity: 0, 
              references: new Set(),
              amount: 0,
              expired: 0,
              active: 0,
              expiringSoon: 0,
              nextExpiration: null
            };
          }

          // Récupération avec dates d'expiration
          const { data: details } = await supabase
            .from('order_details')
            .select('quantity, article_code, expiration_date')
            .in('order_number', orderNumbers);

          const quantity = details?.reduce((sum, d) => sum + d.quantity, 0) || 0;
          const references = new Set(details?.map(d => d.article_code) || []);
          
          // Calcul des métriques d'expiration
          const today = new Date();
          const threeMonthsFromNow = new Date();
          threeMonthsFromNow.setMonth(today.getMonth() + 3);
          
          let expired = 0;
          let active = 0;
          let expiringSoon = 0;
          let nextExpiration: Date | null = null;
          
          details?.forEach(d => {
            if (d.expiration_date) {
              const expDate = new Date(d.expiration_date);
              
              if (expDate < today) {
                expired += d.quantity;
              } else {
                active += d.quantity;
                
                if (expDate <= threeMonthsFromNow) {
                  expiringSoon += d.quantity;
                }
                
                if (!nextExpiration || expDate < nextExpiration) {
                  nextExpiration = expDate;
                }
              }
            } else {
              // Pas de date d'expiration = considéré comme actif
              active += d.quantity;
            }
          });
          
          return { 
            quantity, 
            references,
            amount: totalAmount,
            expired,
            active,
            expiringSoon,
            nextExpiration
          };
        };

        // Récupérer les données pour chaque année (ajout N-1)
        const trainingYearData = await getYearData(trainingYear);
        const minus1Data = await getYearData(trainingYear - 1);
        const minus2Data = await getYearData(trainingYear - 2);
        const minus3Data = await getYearData(trainingYear - 3);
        const minus4Data = await getYearData(trainingYear - 4);

        // Calculer les augmentations de quantités (avec N-1)
        const increaseVsMinus1 = trainingYearData.quantity - minus1Data.quantity;
        const increaseVsMinus2 = trainingYearData.quantity - minus2Data.quantity;
        const increaseVsMinus3 = trainingYearData.quantity - minus3Data.quantity;
        const increaseVsMinus4 = trainingYearData.quantity - minus4Data.quantity;

        // Calculer les pourcentages de croissance (avec N-1)
        const growthVsMinus1 = minus1Data.quantity > 0 ? (increaseVsMinus1 / minus1Data.quantity) * 100 : 0;
        const growthVsMinus2 = minus2Data.quantity > 0 ? (increaseVsMinus2 / minus2Data.quantity) * 100 : 0;
        const growthVsMinus3 = minus3Data.quantity > 0 ? (increaseVsMinus3 / minus3Data.quantity) * 100 : 0;
        const growthVsMinus4 = minus4Data.quantity > 0 ? (increaseVsMinus4 / minus4Data.quantity) * 100 : 0;

        // Calculer les augmentations de montant (avec N-1)
        const amountIncreaseVsMinus1 = trainingYearData.amount - minus1Data.amount;
        const amountGrowthVsMinus1 = minus1Data.amount > 0 ? (amountIncreaseVsMinus1 / minus1Data.amount) * 100 : 0;

        // Calculer les nouvelles références apparues (avec N-1)
        const newRefsMinus1 = [...trainingYearData.references].filter(ref => !minus1Data.references.has(ref)).length;
        const newRefsMinus2 = [...trainingYearData.references].filter(ref => !minus2Data.references.has(ref)).length;
        const newRefsMinus3 = [...trainingYearData.references].filter(ref => !minus3Data.references.has(ref)).length;
        const newRefsMinus4 = [...trainingYearData.references].filter(ref => !minus4Data.references.has(ref)).length;

        // Taux de renouvellement vs -2 ans (cycle de 24 mois)
        // Références qui étaient présentes il y a 2 ans et qui sont toujours commandées
        const renewedRefs = [...trainingYearData.references].filter(ref => minus2Data.references.has(ref)).length;
        const renewalRate = minus2Data.references.size > 0 ? (renewedRefs / minus2Data.references.size) * 100 : 0;

        // Calculer la moyenne des 3 années précédentes
        const avgPrevious = (minus2Data.quantity + minus3Data.quantity + minus4Data.quantity) / 3;
        const avgIncrease = trainingYearData.quantity - avgPrevious;

        // Calcul du pourcentage d'expiration
        const totalWithExpiration = trainingYearData.expired + trainingYearData.active;
        const expiredPercentage = totalWithExpiration > 0 
          ? (trainingYearData.expired / totalWithExpiration) * 100 
          : 0;

        developmentMetrics.push({
          sipi_number: company.sipi_number,
          company_name: companyNameMap.get(company.sipi_number) || company.company_name,
          training_year: trainingYear,
          training_year_quantity: trainingYearData.quantity,
          training_year_references: trainingYearData.references.size,
          training_year_amount: Math.round(trainingYearData.amount * 100) / 100,
          // N-1
          year_minus_1_quantity: minus1Data.quantity,
          year_minus_1_references: minus1Data.references.size,
          year_minus_1_amount: Math.round(minus1Data.amount * 100) / 100,
          // N-2 et suivants
          year_minus_2_quantity: minus2Data.quantity,
          year_minus_2_references: minus2Data.references.size,
          year_minus_3_quantity: minus3Data.quantity,
          year_minus_3_references: minus3Data.references.size,
          year_minus_4_quantity: minus4Data.quantity,
          year_minus_4_references: minus4Data.references.size,
          // Croissance vs N-1
          increase_vs_minus_1: Math.round(increaseVsMinus1 * 100) / 100,
          growth_vs_minus_1: Math.round(growthVsMinus1 * 100) / 100,
          new_references_vs_minus_1: newRefsMinus1,
          amount_increase_vs_minus_1: Math.round(amountIncreaseVsMinus1 * 100) / 100,
          amount_growth_vs_minus_1: Math.round(amountGrowthVsMinus1 * 100) / 100,
          // Croissance vs autres années
          increase_vs_minus_2: Math.round(increaseVsMinus2 * 100) / 100,
          increase_vs_minus_3: Math.round(increaseVsMinus3 * 100) / 100,
          increase_vs_minus_4: Math.round(increaseVsMinus4 * 100) / 100,
          growth_vs_minus_2: Math.round(growthVsMinus2 * 100) / 100,
          growth_vs_minus_3: Math.round(growthVsMinus3 * 100) / 100,
          growth_vs_minus_4: Math.round(growthVsMinus4 * 100) / 100,
          new_references_vs_minus_2: newRefsMinus2,
          new_references_vs_minus_3: newRefsMinus3,
          new_references_vs_minus_4: newRefsMinus4,
          renewal_rate_vs_minus_2: Math.round(renewalRate * 100) / 100,
          development_generated: avgIncrease > 0,
          // Métriques d'expiration
          expired_quantity: trainingYearData.expired,
          active_quantity: trainingYearData.active,
          expiring_soon_quantity: trainingYearData.expiringSoon,
          next_expiration_date: trainingYearData.nextExpiration?.toISOString().split('T')[0] || null,
          expired_percentage: Math.round(expiredPercentage * 100) / 100
        });
      }

      console.log('[TrainingDevelopment] Métriques calculées:', developmentMetrics.length);
      setMetrics(developmentMetrics.sort((a, b) => b.increase_vs_minus_2 - a.increase_vs_minus_2));
    } catch (err) {
      console.error('Erreur lors du calcul du développement:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (formateur && trainingYear) {
      calculateDevelopment();
    }
  }, [formateur, trainingYear]);

  return {
    metrics,
    loading,
    error,
    refetch: calculateDevelopment
  };
};
