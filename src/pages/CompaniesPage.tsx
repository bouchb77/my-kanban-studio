import React from 'react';
import { CompanyImportSection } from '@/components/CompanyImportSection';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

const CompaniesPage: React.FC = () => {
  const { isAdmin, loading } = useUserRole();

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="max-w-md mx-auto mt-20">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Accès non autorisé</h2>
            <p className="text-muted-foreground">
              Seuls les administrateurs peuvent accéder à cette page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestion des Entreprises</h1>
        <p className="text-muted-foreground mt-1">
          Importez et gérez la base de données commune des entreprises
        </p>
      </div>

      <CompanyImportSection />
    </div>
  );
};

export default CompaniesPage;