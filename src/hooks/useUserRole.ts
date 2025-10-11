import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'admin' | 'bo' | 'ct' | 'fo' | null;

export const useUserRole = () => {
  const [role, setRole] = useState<UserRole>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) {
        setRole(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking user role:', error);
          setRole(null);
          setIsAdmin(false);
        } else {
          const userRole = data?.role as UserRole;
          setRole(userRole);
          setIsAdmin(userRole === 'admin');
        }
      } catch (error) {
        console.error('Error checking user role:', error);
        setRole(null);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkUserRole();
  }, [user]);

  return { role, isAdmin, loading };
};
