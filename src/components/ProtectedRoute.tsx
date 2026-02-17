import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PendingApprovalMessage } from './PendingApprovalMessage';
import { useUserRole } from '@/hooks/useUserRole';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Pages allowed for DE-only users
const DE_ALLOWED_PATHS = ['/isochrone-de', '/companies-de'];

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const { roles, isAdmin, loading: roleLoading } = useUserRole();
  const [userApproved, setUserApproved] = useState<boolean | null>(null);
  const [checkingApproval, setCheckingApproval] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkUserApproval = async () => {
      if (!user) {
        setCheckingApproval(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('approved')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error checking user approval:', error);
          setUserApproved(false);
        } else {
          setUserApproved(data?.approved || false);
        }
      } catch (error) {
        console.error('Error checking user approval:', error);
        setUserApproved(false);
      } finally {
        setCheckingApproval(false);
      }
    };

    checkUserApproval();
  }, [user]);

  if (loading || checkingApproval || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--gradient-surface)" }}>
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (userApproved === false) {
    return <PendingApprovalMessage />;
  }

  // DE-only users can only access DE pages
  const isDeOnly = roles.includes('de') && !isAdmin;
  if (isDeOnly && !DE_ALLOWED_PATHS.includes(location.pathname)) {
    return <Navigate to="/isochrone-de" replace />;
  }

  return <>{children}</>;
};