import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OrderDetail {
  id: string;
  order_number: string;
  article_code: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export const useOrderDetails = (orderNumber?: string) => {
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderDetails = async (ordNum?: string) => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('order_details')
        .select('*')
        .order('article_code', { ascending: true });

      if (ordNum) {
        query = query.eq('order_number', ordNum);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setOrderDetails(data || []);
    } catch (err) {
      console.error('Erreur lors du chargement des détails de commandes:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderNumber) {
      fetchOrderDetails(orderNumber);
    } else {
      setLoading(false);
    }
  }, [orderNumber]);

  return {
    orderDetails,
    loading,
    error,
    refetch: () => fetchOrderDetails(orderNumber)
  };
};
