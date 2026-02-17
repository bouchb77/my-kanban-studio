import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Search, Loader2 } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { CompanyDEImportSection } from "@/components/CompanyDEImportSection";

interface CompanyDE {
  id: string;
  sipi_number: string | null;
  company_name: string;
  address1: string | null;
  address2: string | null;
  city: string | null;
  postal_code: string | null;
  region: string | null;
}

const CompaniesDEPage = () => {
  const [companies, setCompanies] = useState<CompanyDE[]>([]);
  const [loading, setLoading] = useState(true);
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

  const filtered = companies.filter(c =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.city && c.city.toLowerCase().includes(search.toLowerCase())) ||
    (c.postal_code && c.postal_code.includes(search)) ||
    (c.sipi_number && c.sipi_number.includes(search))
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
                    <TableHead>SIPI</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Adresse 1</TableHead>
                    <TableHead>Adresse 2</TableHead>
                    <TableHead>CP</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Région</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>{company.sipi_number || '-'}</TableCell>
                      <TableCell className="font-medium">{company.company_name}</TableCell>
                      <TableCell>{company.address1 || '-'}</TableCell>
                      <TableCell>{company.address2 || '-'}</TableCell>
                      <TableCell>{company.postal_code || '-'}</TableCell>
                      <TableCell>{company.city || '-'}</TableCell>
                      <TableCell>{company.region || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
