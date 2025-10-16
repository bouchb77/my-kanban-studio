import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TrainingDevelopmentMetrics {
  sipi_number: string;
  company_name: string;
  training_year: number;
  training_year_quantity: number;
  training_year_references: number;
  year_minus_2_quantity: number;
  year_minus_2_references: number;
  year_minus_3_quantity: number;
  year_minus_3_references: number;
  year_minus_4_quantity: number;
  year_minus_4_references: number;
  increase_vs_minus_2: number;
  increase_vs_minus_3: number;
  increase_vs_minus_4: number;
  growth_vs_minus_2: number;
  growth_vs_minus_3: number;
  growth_vs_minus_4: number;
  new_references_vs_minus_2: number;
  new_references_vs_minus_3: number;
  new_references_vs_minus_4: number;
  renewal_rate_vs_minus_2: number;  // Taux de renouvellement (24 mois)
  development_generated: boolean;
}

export const useTrainingDevelopment = (formateur: string, trainingYear: number) => {
  const [metrics, setMetrics] = useState<TrainingDevelopmentMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateDevelopment = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Récupérer les entreprises formées (formations payantes FSITE/FSITEJ)
      const { data: departments } = await supabase
        .from('department_management')
        .select('department_name')
        .eq('formateur', formateur);

      if (!departments || departments.length === 0) {
        setMetrics([]);
        return;
      }

      const departmentNames = departments.map(d => d.department_name);

      // 2. Récupérer les commandes avec formations payantes de l'année
      const { data: trainedCompanies } = await supabase
        .from('orders')
        .select(`
          sipi_number,
          order_number,
          order_date
        `)
        .gte('order_date', `${trainingYear}-01-01`)
        .lte('order_date', `${trainingYear}-12-31`);

      if (!trainedCompanies || trainedCompanies.length === 0) {
        setMetrics([]);
        return;
      }

      // Filtrer les commandes avec FSITE ou FSITEJ
      // Ce filtre sert uniquement à identifier les entreprises formées
      // L'analyse des quantités/références se fera ensuite sur TOUTES les commandes
      const orderNumbers = trainedCompanies.map(o => o.order_number);
      const { data: orderDetails } = await supabase
        .from('order_details')
        .select('order_number, article_code')
        .in('order_number', orderNumbers)
        .in('article_code', ['FSITE', 'FSITEJ']);

      const trainedOrderNumbers = new Set(orderDetails?.map(od => od.order_number) || []);
      const trainedSipiNumbers = trainedCompanies
        .filter(o => trainedOrderNumbers.has(o.order_number))
        .map(o => o.sipi_number);

      // 3. Récupérer les infos des entreprises
      const { data: companies } = await supabase
        .from('companies')
        .select('sipi_number, company_name, general_department')
        .in('sipi_number', trainedSipiNumbers)
        .in('general_department', departmentNames);

      if (!companies || companies.length === 0) {
        setMetrics([]);
        return;
      }

      // 4. Pour chaque entreprise, calculer les quantités pour l'année de formation et les années précédentes
      const developmentMetrics: TrainingDevelopmentMetrics[] = [];

      for (const company of companies) {
        // Fonction helper pour récupérer les données d'une année
        // IMPORTANT: On récupère TOUTES les références (pas seulement FSITE/FSITEJ)
        const getYearData = async (year: number): Promise<{ quantity: number; references: Set<string> }> => {
          const { data: orders } = await supabase
            .from('orders')
            .select('order_number')
            .eq('sipi_number', company.sipi_number)
            .gte('order_date', `${year}-01-01`)
            .lte('order_date', `${year}-12-31`);

          const orderNumbers = orders?.map(o => o.order_number) || [];
          
          if (orderNumbers.length === 0) return { quantity: 0, references: new Set() };

          // Récupération de TOUTES les références commandées (tous les article_code)
          const { data: details } = await supabase
            .from('order_details')
            .select('quantity, article_code')
            .in('order_number', orderNumbers);
            // Pas de filtre sur article_code : on prend TOUT

          const quantity = details?.reduce((sum, d) => sum + d.quantity, 0) || 0;
          const references = new Set(details?.map(d => d.article_code) || []);
          
          return { quantity, references };
        };

        // Récupérer les données pour chaque année
        const trainingYearData = await getYearData(trainingYear);
        const minus2Data = await getYearData(trainingYear - 2);
        const minus3Data = await getYearData(trainingYear - 3);
        const minus4Data = await getYearData(trainingYear - 4);

        // Calculer les augmentations de quantités
        const increaseVsMinus2 = trainingYearData.quantity - minus2Data.quantity;
        const increaseVsMinus3 = trainingYearData.quantity - minus3Data.quantity;
        const increaseVsMinus4 = trainingYearData.quantity - minus4Data.quantity;

        // Calculer les pourcentages de croissance
        const growthVsMinus2 = minus2Data.quantity > 0 ? (increaseVsMinus2 / minus2Data.quantity) * 100 : 0;
        const growthVsMinus3 = minus3Data.quantity > 0 ? (increaseVsMinus3 / minus3Data.quantity) * 100 : 0;
        const growthVsMinus4 = minus4Data.quantity > 0 ? (increaseVsMinus4 / minus4Data.quantity) * 100 : 0;

        // Calculer les nouvelles références apparues
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

        developmentMetrics.push({
          sipi_number: company.sipi_number,
          company_name: company.company_name,
          training_year: trainingYear,
          training_year_quantity: trainingYearData.quantity,
          training_year_references: trainingYearData.references.size,
          year_minus_2_quantity: minus2Data.quantity,
          year_minus_2_references: minus2Data.references.size,
          year_minus_3_quantity: minus3Data.quantity,
          year_minus_3_references: minus3Data.references.size,
          year_minus_4_quantity: minus4Data.quantity,
          year_minus_4_references: minus4Data.references.size,
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
          development_generated: avgIncrease > 0
        });
      }

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
