import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'admin' | 'bo' | 'ct' | 'fo' | 'de';

export const useUserRole = () => {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) {
        setRoles([]);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error checking user role:', error);
          setRoles([]);
          setIsAdmin(false);
        } else {
          const userRoles = (data || []).map(r => r.role as UserRole);
          setRoles(userRoles);
          setIsAdmin(userRoles.includes('admin'));
        }
      } catch (error) {
        console.error('Error checking user role:', error);
        setRoles([]);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkUserRole();
  }, [user]);

  // Return the primary role (admin takes priority, then fo, ct, bo)
  const role = roles.includes('admin') ? 'admin' : 
               roles.includes('fo') ? 'fo' :
               roles.includes('ct') ? 'ct' :
               roles.includes('bo') ? 'bo' : null;

  return { role, roles, isAdmin, loading };
};
