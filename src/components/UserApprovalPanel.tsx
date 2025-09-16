import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Users, Calendar } from 'lucide-react';
import { usePendingUsers } from '@/hooks/usePendingUsers';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const UserApprovalPanel = () => {
  const { pendingUsers, loading, approveUser } = usePendingUsers();
  const { toast } = useToast();

  const handleApprove = async (userId: string, userName: string) => {
    const success = await approveUser(userId);
    if (success) {
      toast({
        title: "Utilisateur approuvé",
        description: `${userName} peut maintenant accéder à l'application.`,
      });
    } else {
      toast({
        title: "Erreur",
        description: "Impossible d'approuver cet utilisateur.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Utilisateurs en attente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Utilisateurs en attente d'approbation
          <Badge variant="secondary">{pendingUsers.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pendingUsers.length === 0 ? (
          <p className="text-muted-foreground">Aucun utilisateur en attente d'approbation.</p>
        ) : (
          <div className="space-y-4">
            {pendingUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <p className="font-medium">{user.full_name || 'Utilisateur sans nom'}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Inscrit le {format(new Date(user.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                  </p>
                </div>
                <Button
                  onClick={() => handleApprove(user.id, user.full_name || user.email)}
                  className="flex items-center gap-2"
                >
                  <UserCheck className="h-4 w-4" />
                  Approuver
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};