import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OrderStats {
  year: number;
  totalOrders: number;
  totalAmount: number;
}

export const useOrders = () => {
  const [orderStats, setOrderStats] = useState<OrderStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Récupérer toutes les commandes en utilisant une approche de pagination
      let allOrders: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('order_date, amount')
          .range(from, from + batchSize - 1);

        if (ordersError) {
          throw ordersError;
        }

        if (orders && orders.length > 0) {
          allOrders = [...allOrders, ...orders];
          from += batchSize;
          hasMore = orders.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`Total commandes récupérées: ${allOrders.length}`);

      // Grouper les données par année
      const statsMap = new Map<number, { totalOrders: number; totalAmount: number }>();
      
      allOrders.forEach(order => {
        const year = new Date(order.order_date).getFullYear();
        const current = statsMap.get(year) || { totalOrders: 0, totalAmount: 0 };
        
        statsMap.set(year, {
          totalOrders: current.totalOrders + 1,
          totalAmount: current.totalAmount + (order.amount || 0)
        });
      });

      // Convertir en tableau et trier par année
      const stats: OrderStats[] = Array.from(statsMap.entries())
        .map(([year, data]) => ({
          year,
          ...data
        }))
        .sort((a, b) => a.year - b.year);

      setOrderStats(stats);
    } catch (err) {
      console.error('Erreur lors du chargement des statistiques des commandes:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderStats();
  }, []);

  return {
    orderStats,
    loading,
    error,
    refetch: fetchOrderStats
  };
};