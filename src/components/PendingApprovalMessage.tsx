import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export const PendingApprovalMessage = () => {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Clock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Compte en attente d'approbation</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Votre compte a été créé avec succès ! Un administrateur doit maintenant approuver 
            votre accès avant que vous puissiez utiliser l'application.
          </p>
          
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span>Vous recevrez une notification par email une fois approuvé</span>
          </div>

          <div className="pt-4">
            <Button 
              variant="outline" 
              onClick={signOut}
              className="w-full"
            >
              Se déconnecter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};