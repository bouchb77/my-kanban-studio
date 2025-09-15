import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, MapPin, Building2, Calendar, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CompanyData {
  id: string;
  sipi_number: string;
  company_name: string;
  address1?: string;
  address2?: string;
  city?: string;
  postal_code?: string;
  general_department?: string;
  quality?: string;
  last_order_date?: string;
  client_blocked_date?: string;
  training_date?: string;
  report_creation_date?: string;
  latitude?: number;
  longitude?: number;
  geocoded_address?: string;
  created_at: string;
}

const PublicReportingPage: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [qualityFilter, setQualityFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    filterCompanies();
  }, [companies, searchTerm, qualityFilter, departmentFilter]);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('company_name');

      if (error) {
        throw error;
      }

      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données des entreprises",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterCompanies = () => {
    let filtered = companies;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(company => 
        company.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.sipi_number.includes(searchTerm) ||
        company.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.general_department?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by quality
    if (qualityFilter !== 'all') {
      filtered = filtered.filter(company => company.quality === qualityFilter);
    }

    // Filter by department
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(company => company.general_department === departmentFilter);
    }

    setFilteredCompanies(filtered);
  };

  const getUniqueValues = (field: keyof CompanyData) => {
    const values = companies
      .map(company => company[field])
      .filter(value => value && value !== '')
      .filter((value, index, array) => array.indexOf(value) === index) as string[];
    return values.sort();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR');
    } catch {
      return dateString;
    }
  };

  const stats = {
    total: companies.length,
    withGPS: companies.filter(c => c.latitude && c.longitude).length,
    withLastOrder: companies.filter(c => c.last_order_date).length,
    blocked: companies.filter(c => c.client_blocked_date).length,
  };

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

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Reporting Entreprises</h1>
        <p className="text-muted-foreground mt-1">
          Vue d'ensemble des entreprises de la base de données
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entreprises</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Géolocalisées</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withGPS}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.withGPS / stats.total) * 100) : 0}% du total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avec Commandes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withLastOrder}</div>
            <p className="text-xs text-muted-foreground">
              Dernière commande enregistrée
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients Bloqués</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.blocked}</div>
            <p className="text-xs text-muted-foreground">
              Nécessitent attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Recherche</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nom, SIPI, ville..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Qualité</label>
              <Select value={qualityFilter} onValueChange={setQualityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les qualités" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les qualités</SelectItem>
                  {getUniqueValues('quality').map(quality => (
                    <SelectItem key={quality} value={quality}>{quality}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Département</label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les départements" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les départements</SelectItem>
                  {getUniqueValues('general_department').map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Entreprises ({filteredCompanies.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SIPI</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Département</TableHead>
                  <TableHead>Qualité</TableHead>
                  <TableHead>Dernière Cmd</TableHead>
                  <TableHead>GPS</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.sipi_number}</TableCell>
                    <TableCell>{company.company_name}</TableCell>
                    <TableCell>{company.city || '-'}</TableCell>
                    <TableCell>{company.general_department || '-'}</TableCell>
                    <TableCell>
                      {company.quality && (
                        <Badge variant={company.quality === 'Premium' ? 'default' : 'secondary'}>
                          {company.quality}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(company.last_order_date)}</TableCell>
                    <TableCell>
                      {company.latitude && company.longitude ? (
                        <Badge variant="outline" className="text-green-600">
                          <MapPin className="w-3 h-3 mr-1" />
                          Oui
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Non
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {company.client_blocked_date ? (
                        <Badge variant="destructive">Bloqué</Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600">Actif</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicReportingPage;