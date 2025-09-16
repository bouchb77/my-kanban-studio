import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PendingUser {
  id: string;
  email: string;
  full_name?: string;
  created_at: string;
}

export const usePendingUsers = () => {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const loadPendingUsers = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at')
        .eq('approved', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading pending users:', error);
        return;
      }

      setPendingUsers(data || []);
    } catch (error) {
      console.error('Error loading pending users:', error);
    } finally {
      setLoading(false);
    }
  };

  const approveUser = async (userId: string) => {
    try {
      const { error } = await supabase.rpc('approve_user', {
        user_id_to_approve: userId
      });

      if (error) {
        console.error('Error approving user:', error);
        return false;
      }

      // Refresh the list
      await loadPendingUsers();
      return true;
    } catch (error) {
      console.error('Error approving user:', error);
      return false;
    }
  };

  useEffect(() => {
    loadPendingUsers();
  }, [user]);

  return { pendingUsers, loading, approveUser, refetch: loadPendingUsers };
};