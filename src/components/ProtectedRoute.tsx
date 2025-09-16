import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PendingApprovalMessage } from './PendingApprovalMessage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const [userApproved, setUserApproved] = useState<boolean | null>(null);
  const [checkingApproval, setCheckingApproval] = useState(true);

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

  if (loading || checkingApproval) {
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

  return <>{children}</>;
};