import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search, Loader2, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';

interface CompanyDE {
  id: string;
  sipi_number?: string;
  company_name: string;
  address1?: string;
  address2?: string;
  city?: string;
  postal_code?: string;
  region?: string;
}

const IsochroneDEPage = () => {
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
      setCompanies((data || []).map(c => ({
        id: c.id,
        sipi_number: c.sipi_number ?? undefined,
        company_name: c.company_name,
        address1: c.address1 ?? undefined,
        address2: c.address2 ?? undefined,
        city: c.city ?? undefined,
        postal_code: c.postal_code ?? undefined,
        region: c.region ?? undefined,
      })));
    } catch (err) {
      console.error('Erreur chargement companies DE:', err);
      toast({ title: "Erreur", description: "Impossible de charger les entreprises DE", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = companies.filter(c =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.city && c.city.toLowerCase().includes(search.toLowerCase())) ||
    (c.postal_code && c.postal_code.includes(search)) ||
    (c.sipi_number && c.sipi_number.includes(search)) ||
    (c.region && c.region.toLowerCase().includes(search.toLowerCase()))
  );

  const handleExport = () => {
    if (filtered.length === 0) {
      toast({ title: "Info", description: "Aucune entreprise à exporter" });
      return;
    }

    const headers = ['SIPI', 'Entreprise', 'Adresse 1', 'Adresse 2', 'CP', 'Ville', 'Région'];
    const rows = filtered.map(c => [
      c.sipi_number || '', c.company_name, c.address1 || '', c.address2 || '',
      c.postal_code || '', c.city || '', c.region || '',
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entreprises_de_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="w-8 h-8" />
          Entreprises Allemagne (DE)
        </h1>
        <p className="text-muted-foreground mt-1">
          Liste et export des clients allemands
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{filtered.length} entreprise(s)</span>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                onClick={handleExport}
                disabled={filtered.length === 0}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Exporter CSV
              </Button>
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

export default IsochroneDEPage;
