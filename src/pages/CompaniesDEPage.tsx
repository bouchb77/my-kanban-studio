import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, Search, Loader2, MapPin } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { CompanyDEImportSection } from "@/components/CompanyDEImportSection";

interface CompanyDE {
  id: string;
  company_name: string;
  address1: string | null;
  address2: string | null;
  city: string | null;
  postal_code: string | null;
  region: string | null;
  sipi_number: string | null;
  latitude: number | null;
  longitude: number | null;
}

const CompaniesDEPage = () => {
  const [companies, setCompanies] = useState<CompanyDE[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies_de')
        .select('*')
        .order('company_name');
      
      if (error) throw error;
      setCompanies(data || []);
    } catch (err) {
      console.error('Erreur chargement companies DE:', err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les entreprises DE",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGeocode = async () => {
    const withoutCoords = companies.filter(c => !c.latitude || !c.longitude);
    if (withoutCoords.length === 0) {
      toast({ title: "Info", description: "Toutes les entreprises sont déjà géolocalisées" });
      return;
    }

    setGeocoding(true);
    toast({
      title: "Géolocalisation démarrée",
      description: `${withoutCoords.length} entreprise(s) à géolocaliser en arrière-plan...`,
    });

    try {
      const { data, error } = await supabase.functions.invoke('geocode-companies-de', {});
      if (error) throw error;

      toast({
        title: "Géolocalisation terminée",
        description: `${data.succeeded} réussie(s), ${data.failed} échouée(s) sur ${data.processed} traitée(s)`,
      });
      fetchCompanies();
    } catch (err) {
      console.error('Erreur géocodage:', err);
      toast({
        title: "Erreur de géolocalisation",
        description: "Impossible de lancer la géolocalisation",
        variant: "destructive",
      });
    } finally {
      setGeocoding(false);
    }
  };

  const withoutCoords = companies.filter(c => !c.latitude || !c.longitude).length;
  const withCoords = companies.filter(c => c.latitude && c.longitude).length;

  const filtered = companies.filter(c =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.city && c.city.toLowerCase().includes(search.toLowerCase())) ||
    (c.postal_code && c.postal_code.includes(search))
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="w-8 h-8" />
          Entreprises Allemagne (DE)
        </h1>
        <p className="text-muted-foreground mt-1">
          Liste des entreprises allemandes
        </p>
      </div>

      <div className="mb-6">
        <CompanyDEImportSection onImportComplete={fetchCompanies} />
      </div>

      {companies.length > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-sm"><span className="font-semibold">{withCoords}</span> géolocalisée(s)</span>
                </div>
                {withoutCoords > 0 && (
                  <Badge variant="outline">
                    {withoutCoords} sans coordonnées
                  </Badge>
                )}
              </div>
              <Button
                onClick={handleGeocode}
                disabled={geocoding || withoutCoords === 0}
                className="flex items-center gap-2"
              >
                {geocoding ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Géolocalisation...</>
                ) : (
                  <><MapPin className="w-4 h-4" />Géolocaliser les adresses ({withoutCoords})</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{filtered.length} entreprise(s)</span>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° SIPI</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Adresse</TableHead>
                    <TableHead>Adresse 2</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>CP</TableHead>
                    <TableHead>Région</TableHead>
                    <TableHead>Géo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-mono text-sm">{company.sipi_number || '-'}</TableCell>
                      <TableCell className="font-medium">{company.company_name}</TableCell>
                      <TableCell>{company.address1 || '-'}</TableCell>
                      <TableCell>{company.address2 || '-'}</TableCell>
                      <TableCell>{company.city || '-'}</TableCell>
                      <TableCell>{company.postal_code || '-'}</TableCell>
                      <TableCell>{company.region || '-'}</TableCell>
                      <TableCell>
                        {company.latitude && company.longitude ? (
                          <MapPin className="w-4 h-4 text-primary" />
                        ) : (
                          <MapPin className="w-4 h-4 text-muted-foreground opacity-30" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Aucune entreprise trouvée
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CompaniesDEPage;
