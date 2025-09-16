import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { InlineEditField } from '@/components/InlineEditField';
import { RefreshCw, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Company {
  id: string;
  company_name: string;
  sipi_number: string;
  address1: string | null;
  address2: string | null;
  city: string | null;
  postal_code: string | null;
  geocoded_address: string | null;
  latitude: number | null;
  longitude: number | null;
}

const IncompleteGeocodingTable: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchIncompleteCompanies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, company_name, sipi_number, address1, address2, city, postal_code, geocoded_address, latitude, longitude')
        .or('geocoded_address.ilike.%France%,geocoded_address.ilike.%Région%')
        .order('company_name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des entreprises:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les entreprises"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncompleteCompanies();
  }, []);

  const handleUpdateCompany = async (id: string, field: string, value: string) => {
    try {
      const updateData: any = { [field]: value };
      
      // Si on modifie l'adresse ou la ville, on réinitialise la géolocalisation
      if (field === 'address1' || field === 'city') {
        updateData.geocoded_address = null;
        updateData.latitude = null;
        updateData.longitude = null;
        updateData.geocoding_date = null;
      }

      const { error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Mettre à jour l'état local
      setCompanies(prev => prev.map(company => 
        company.id === id 
          ? { ...company, [field]: value, ...(updateData.geocoded_address === null ? { geocoded_address: null, latitude: null, longitude: null } : {}) }
          : company
      ));

      toast({
        title: "Succès",
        description: "Entreprise mise à jour avec succès"
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour l'entreprise"
      });
    }
  };

  const handleForceGeocode = async () => {
    try {
      const { error } = await supabase.functions.invoke('geocode-companies');
      
      if (error) throw error;

      toast({
        title: "Géolocalisation lancée",
        description: "La géolocalisation des entreprises a été lancée en arrière-plan"
      });

      // Actualiser les données après un délai
      setTimeout(() => {
        fetchIncompleteCompanies();
      }, 2000);
    } catch (error) {
      console.error('Erreur lors du géocodage:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de lancer la géolocalisation"
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Entreprises avec géolocalisation incomplète
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Entreprises avec géolocalisation incomplète ({companies.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchIncompleteCompanies}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            <Button variant="default" size="sm" onClick={handleForceGeocode}>
              <MapPin className="w-4 h-4 mr-2" />
              Forcer la géolocalisation
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {companies.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Aucune entreprise avec géolocalisation incomplète trouvée
          </p>
        ) : (
          <ScrollArea className="h-96 w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>SIPI</TableHead>
                  <TableHead>Adresse 1</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Code postal</TableHead>
                  <TableHead>Adresse géocodée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">
                      <InlineEditField
                        value={company.company_name}
                        onSave={(value) => handleUpdateCompany(company.id, 'company_name', value)}
                        type="text"
                        placeholder="Nom de l'entreprise"
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditField
                        value={company.sipi_number}
                        onSave={(value) => handleUpdateCompany(company.id, 'sipi_number', value)}
                        type="text"
                        placeholder="SIPI"
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditField
                        value={company.address1 || ''}
                        onSave={(value) => handleUpdateCompany(company.id, 'address1', value)}
                        type="text"
                        placeholder="Adresse 1"
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditField
                        value={company.city || ''}
                        onSave={(value) => handleUpdateCompany(company.id, 'city', value)}
                        type="text"
                        placeholder="Ville"
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditField
                        value={company.postal_code || ''}
                        onSave={(value) => handleUpdateCompany(company.id, 'postal_code', value)}
                        type="text"
                        placeholder="Code postal"
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {company.geocoded_address || 'Non géolocalisé'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default IncompleteGeocodingTable;