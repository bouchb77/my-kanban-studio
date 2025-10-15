import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TrainingDevelopmentMetrics {
  sipi_number: string;
  company_name: string;
  training_year: number;
  pre_training_quantity: number;  // Quantité moyenne avant formation (2 ans avant)
  post_training_quantity: number; // Quantité moyenne après formation (2 ans après)
  quantity_increase: number;      // Augmentation absolue
  growth_percentage: number;      // Pourcentage de croissance
  development_generated: boolean; // Vrai si augmentation > 0
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

      // 4. Pour chaque entreprise, calculer les quantités avant/après formation
      const developmentMetrics: TrainingDevelopmentMetrics[] = [];

      for (const company of companies) {
        // Période AVANT formation: 2 ans avant l'année de formation
        const preStartYear = trainingYear - 2;
        const preEndYear = trainingYear - 1;

        // Période APRÈS formation: année de formation + 2 ans après
        const postStartYear = trainingYear;
        const postEndYear = trainingYear + 2;

        // Quantités avant formation
        const { data: preOrders } = await supabase
          .from('orders')
          .select('order_number')
          .eq('sipi_number', company.sipi_number)
          .gte('order_date', `${preStartYear}-01-01`)
          .lte('order_date', `${preEndYear}-12-31`);

        const preOrderNumbers = preOrders?.map(o => o.order_number) || [];
        let preQuantity = 0;

        if (preOrderNumbers.length > 0) {
          const { data: preDetails } = await supabase
            .from('order_details')
            .select('quantity')
            .in('order_number', preOrderNumbers);

          preQuantity = preDetails?.reduce((sum, d) => sum + d.quantity, 0) || 0;
        }

        // Quantités après formation
        const { data: postOrders } = await supabase
          .from('orders')
          .select('order_number')
          .eq('sipi_number', company.sipi_number)
          .gte('order_date', `${postStartYear}-01-01`)
          .lte('order_date', `${postEndYear}-12-31`);

        const postOrderNumbers = postOrders?.map(o => o.order_number) || [];
        let postQuantity = 0;

        if (postOrderNumbers.length > 0) {
          const { data: postDetails } = await supabase
            .from('order_details')
            .select('quantity')
            .in('order_number', postOrderNumbers);

          postQuantity = postDetails?.reduce((sum, d) => sum + d.quantity, 0) || 0;
        }

        // Calculer la moyenne sur 2 ans
        const preAverage = preQuantity / 2;
        const postAverage = postQuantity / 3; // 3 ans (année formation + 2 après)

        const increase = postAverage - preAverage;
        const growthPercentage = preAverage > 0 ? (increase / preAverage) * 100 : 0;

        developmentMetrics.push({
          sipi_number: company.sipi_number,
          company_name: company.company_name,
          training_year: trainingYear,
          pre_training_quantity: Math.round(preAverage * 100) / 100,
          post_training_quantity: Math.round(postAverage * 100) / 100,
          quantity_increase: Math.round(increase * 100) / 100,
          growth_percentage: Math.round(growthPercentage * 100) / 100,
          development_generated: increase > 0
        });
      }

      setMetrics(developmentMetrics.sort((a, b) => b.quantity_increase - a.quantity_increase));
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
