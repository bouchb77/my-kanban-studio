import { UserApprovalPanel } from '@/components/UserApprovalPanel';
import { UserRoleManager } from '@/components/UserRoleManager';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserCheck, UserX, Clock } from 'lucide-react';
import { usePendingUsers } from '@/hooks/usePendingUsers';
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';

const UserApprovalPage = () => {
  const { isAdmin, loading } = useUserRole();
  const { pendingUsers } = usePendingUsers();
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    total: 0
  });

  useEffect(() => {
    const loadStats = async () => {
      // Compter les utilisateurs en attente
      setStats(prev => ({
        ...prev,
        pending: pendingUsers.length
      }));
    };

    loadStats();
  }, [pendingUsers]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground">Validez les nouveaux utilisateurs qui souhaitent accéder à l'application</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En attente
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.pending}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approuvés aujourd'hui
            </CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.approved}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total utilisateurs
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total || '-'}
            </div></CardContent>
        </Card>
      </div>

      {/* User Management Tabs */}
      <Tabs defaultValue="approval" className="w-full">
        <TabsList>
          <TabsTrigger value="approval">Approbation</TabsTrigger>
          <TabsTrigger value="roles">Rôles et Secteurs</TabsTrigger>
        </TabsList>
        <TabsContent value="approval">
          <UserApprovalPanel />
        </TabsContent>
        <TabsContent value="roles">
          <UserRoleManager />
        </TabsContent>
      </Tabs>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
            <p className="text-muted-foreground">
              Les nouveaux utilisateurs qui s'inscrivent sur l'application ne peuvent pas accéder aux fonctionnalités tant qu'ils ne sont pas approuvés par un administrateur.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
            <p className="text-muted-foreground">
              Cliquez sur "Approuver" pour donner accès à un utilisateur. Une fois approuvé, il pourra se connecter et utiliser toutes les fonctionnalités.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
            <p className="text-muted-foreground">
              Les utilisateurs en attente verront un message leur indiquant que leur compte est en cours de validation.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserApprovalPage;