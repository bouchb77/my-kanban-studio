import React from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';
import { CompanyImportSection } from '@/components/CompanyImportSection';
import { OrderImportSection } from '@/components/OrderImportSection';
import { OrderDetailImportSection } from '@/components/OrderDetailImportSection';
import DepartmentImportSection from '@/components/DepartmentImportSection';
import ContactImportSection from '@/components/ContactImportSection';
import IncompleteGeocodingTable from '@/components/IncompleteGeocodingTable';
import { EncryptExistingDataButton } from '@/components/EncryptExistingDataButton';

const ImportReportingPage: React.FC = () => {
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
        <h1 className="text-3xl font-bold">Import Reporting</h1>
        <p className="text-muted-foreground mt-1">
          Importez des données depuis des fichiers Excel
        </p>
      </div>

      <div className="space-y-8">
        {/* Chiffrement des données */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Chiffrement des Données</h2>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                Chiffrez les données sensibles des entreprises déjà présentes dans la base de données.
              </p>
              <EncryptExistingDataButton />
            </CardContent>
          </Card>
        </div>

        {/* Import des départements */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Import des Départements</h2>
          <DepartmentImportSection />
        </div>

        {/* Import des entreprises */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Import des Entreprises</h2>
          <CompanyImportSection />
        </div>

        {/* Import des commandes */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Import des Commandes</h2>
          <OrderImportSection />
        </div>

        {/* Import des détails de commandes */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Import des Détails de Commandes</h2>
          <OrderDetailImportSection />
        </div>

        {/* Import des contacts */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Import des Contacts</h2>
          <ContactImportSection />
        </div>

        {/* Gestion des entreprises avec géolocalisation incomplète */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Géolocalisation des Entreprises</h2>
          <IncompleteGeocodingTable />
        </div>
      </div>
    </div>
  );
};

export default ImportReportingPage;