import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TrainingDevelopmentMetrics {
  sipi_number: string;
  company_name: string;
  training_year: number;
  training_year_quantity: number;  // Quantité année de formation
  year_minus_2_quantity: number;   // Quantité 2 ans avant
  year_minus_3_quantity: number;   // Quantité 3 ans avant
  year_minus_4_quantity: number;   // Quantité 4 ans avant
  increase_vs_minus_2: number;     // Augmentation vs 2 ans avant
  increase_vs_minus_3: number;     // Augmentation vs 3 ans avant
  increase_vs_minus_4: number;     // Augmentation vs 4 ans avant
  growth_vs_minus_2: number;       // Croissance % vs 2 ans avant
  growth_vs_minus_3: number;       // Croissance % vs 3 ans avant
  growth_vs_minus_4: number;       // Croissance % vs 4 ans avant
  development_generated: boolean;  // Vrai si augmentation > 0 (vs moyenne)
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
        // Fonction helper pour récupérer la quantité d'une année
        const getYearQuantity = async (year: number): Promise<number> => {
          const { data: orders } = await supabase
            .from('orders')
            .select('order_number')
            .eq('sipi_number', company.sipi_number)
            .gte('order_date', `${year}-01-01`)
            .lte('order_date', `${year}-12-31`);

          const orderNumbers = orders?.map(o => o.order_number) || [];
          
          if (orderNumbers.length === 0) return 0;

          const { data: details } = await supabase
            .from('order_details')
            .select('quantity')
            .in('order_number', orderNumbers);

          return details?.reduce((sum, d) => sum + d.quantity, 0) || 0;
        };

        // Récupérer les quantités pour chaque année
        const trainingYearQty = await getYearQuantity(trainingYear);
        const minus2Qty = await getYearQuantity(trainingYear - 2);
        const minus3Qty = await getYearQuantity(trainingYear - 3);
        const minus4Qty = await getYearQuantity(trainingYear - 4);

        // Calculer les augmentations
        const increaseVsMinus2 = trainingYearQty - minus2Qty;
        const increaseVsMinus3 = trainingYearQty - minus3Qty;
        const increaseVsMinus4 = trainingYearQty - minus4Qty;

        // Calculer les pourcentages de croissance
        const growthVsMinus2 = minus2Qty > 0 ? (increaseVsMinus2 / minus2Qty) * 100 : 0;
        const growthVsMinus3 = minus3Qty > 0 ? (increaseVsMinus3 / minus3Qty) * 100 : 0;
        const growthVsMinus4 = minus4Qty > 0 ? (increaseVsMinus4 / minus4Qty) * 100 : 0;

        // Calculer la moyenne des 3 années précédentes
        const avgPrevious = (minus2Qty + minus3Qty + minus4Qty) / 3;
        const avgIncrease = trainingYearQty - avgPrevious;

        developmentMetrics.push({
          sipi_number: company.sipi_number,
          company_name: company.company_name,
          training_year: trainingYear,
          training_year_quantity: trainingYearQty,
          year_minus_2_quantity: minus2Qty,
          year_minus_3_quantity: minus3Qty,
          year_minus_4_quantity: minus4Qty,
          increase_vs_minus_2: Math.round(increaseVsMinus2 * 100) / 100,
          increase_vs_minus_3: Math.round(increaseVsMinus3 * 100) / 100,
          increase_vs_minus_4: Math.round(increaseVsMinus4 * 100) / 100,
          growth_vs_minus_2: Math.round(growthVsMinus2 * 100) / 100,
          growth_vs_minus_3: Math.round(growthVsMinus3 * 100) / 100,
          growth_vs_minus_4: Math.round(growthVsMinus4 * 100) / 100,
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
