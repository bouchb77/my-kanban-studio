import React, { useEffect, useState, Suspense, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin, Building2, Filter, ChevronDown, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MapComponent = React.lazy(() => import('./MapComponent'));

interface Company {
  id: string;
  sipi_number: string;
  company_name: string;
  latitude: number;
  longitude: number;
  address1?: string;
  city?: string;
  general_department?: string;
  orderStats?: CompanyOrderStats[];
}

interface CompanyOrderStats {
  year: number;
  totalOrders: number;
  totalAmount: number;
}

const CompaniesMap = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [geocoding, setGeocoding] = useState(false);
  const { toast } = useToast();

  // Get unique departments for filter
  const departments = useMemo(() => {
    const uniqueDepartments = [...new Set(companies
      .map(company => company.general_department)
      .filter(dept => dept)
    )].sort();
    return uniqueDepartments;
  }, [companies]);

  // Filter companies based on selected departments
  const filteredCompanies = useMemo(() => {
    if (selectedDepartments.length === 0) {
      return companies;
    }
    return companies.filter(company => 
      company.general_department && selectedDepartments.includes(company.general_department)
    );
  }, [companies, selectedDepartments]);

  const handleDepartmentToggle = (department: string) => {
    setSelectedDepartments(prev => 
      prev.includes(department)
        ? prev.filter(d => d !== department)
        : [...prev, department]
    );
  };

  const handleSelectAll = () => {
    if (selectedDepartments.length === departments.length) {
      setSelectedDepartments([]);
    } else {
      setSelectedDepartments(departments);
    }
  };

  const handleGeocodeCompanies = async () => {
    setGeocoding(true);
    try {
      toast({
        title: "Géolocalisation démarrée",
        description: "Le processus s'exécute en arrière-plan. Consultez les logs pour le suivi.",
      });
      
      const { data, error } = await supabase.functions.invoke('geocode-companies');
      
      if (error) throw error;
      
      toast({
        title: "✅ Processus lancé",
        description: data.message || "La géolocalisation continue en arrière-plan.",
      });
      
      // Refresh companies data after a delay to show progress
      setTimeout(() => {
        fetchCompaniesData();
        fetchTotalCompanies();
      }, 10000);
      
    } catch (error) {
      console.error('Error geocoding companies:', error);
      toast({
        title: "❌ Erreur",
        description: "Erreur lors du lancement de la géolocalisation",
        variant: "destructive"
      });
    } finally {
      setGeocoding(false);
    }
  };

  const fetchTotalCompanies = async () => {
    try {
      const { count, error } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true });
      
      if (!error && count) {
        setTotalCompanies(count);
      }
    } catch (error) {
      console.error('Error fetching total companies:', error);
    }
  };

  // Fetch companies with GPS coordinates and order statistics
  const fetchCompaniesData = async () => {
    try {
      console.log('Fetching companies with GPS coordinates...');
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, sipi_number, company_name, latitude, longitude, address1, city, general_department')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (companiesError) {
        console.error('Error fetching companies:', companiesError);
        setError('Erreur lors du chargement des entreprises');
        return;
      }

      // Fetch order statistics for each company
      console.log('Fetching order statistics...');
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('sipi_number, order_date, amount');

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        setError('Erreur lors du chargement des commandes');
        return;
      }

      // Group orders by SIPI and year
      const orderStatsByCompany = new Map<string, Map<number, { totalOrders: number; totalAmount: number }>>();
      
      ordersData?.forEach(order => {
        const year = new Date(order.order_date).getFullYear();
        
        if (!orderStatsByCompany.has(order.sipi_number)) {
          orderStatsByCompany.set(order.sipi_number, new Map());
        }
        
        const companyStats = orderStatsByCompany.get(order.sipi_number)!;
        const yearStats = companyStats.get(year) || { totalOrders: 0, totalAmount: 0 };
        
        companyStats.set(year, {
          totalOrders: yearStats.totalOrders + 1,
          totalAmount: yearStats.totalAmount + (order.amount || 0)
        });
      });

      // Combine companies with their order statistics
      const companiesWithStats: Company[] = (companiesData || []).map(company => {
        const companyOrderStats = orderStatsByCompany.get(company.sipi_number);
        const orderStats: CompanyOrderStats[] = [];
        
        if (companyOrderStats) {
          companyOrderStats.forEach((stats, year) => {
            orderStats.push({
              year,
              totalOrders: stats.totalOrders,
              totalAmount: stats.totalAmount
            });
          });
          // Sort by year descending
          orderStats.sort((a, b) => b.year - a.year);
        }
        
        return {
          ...company,
          orderStats
        };
      });

      console.log('Companies loaded:', companiesWithStats?.length || 0);
      setCompanies(companiesWithStats);
    } catch (error) {
      console.error('Error:', error);
      setError('Erreur de connexion');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchCompaniesData(),
        fetchTotalCompanies()
      ]);
      setLoading(false);
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Carte des entreprises
          </CardTitle>
          <CardDescription>
            Localisation géographique des entreprises
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center bg-muted/30 rounded-lg">
            <div className="text-muted-foreground">Chargement de la carte...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Carte des entreprises
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center bg-destructive/10 rounded-lg border border-destructive/20">
            <div className="text-destructive">{error}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Carte des entreprises
        </CardTitle>
        <CardDescription className="flex items-center gap-4">
          <span>Localisation géographique des entreprises</span>
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4" />
            <span>{filteredCompanies.length} / {totalCompanies} entreprise{filteredCompanies.length > 1 ? 's' : ''} géolocalisée{filteredCompanies.length > 1 ? 's' : ''}</span>
          </div>
          {totalCompanies > filteredCompanies.length && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleGeocodeCompanies}
              disabled={geocoding}
              className="ml-auto"
            >
              <Globe className="w-4 h-4 mr-2" />
              {geocoding ? "Démarrage..." : "Lancer la géolocalisation"}
            </Button>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {companies.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center bg-muted/30 rounded-lg">
            <MapPin className="w-12 h-12 text-muted-foreground mb-4" />
            <div className="text-muted-foreground text-center">
              <p className="font-medium">Aucune entreprise géolocalisée</p>
              <p className="text-sm mt-1">Les entreprises seront affichées ici une fois géolocalisées</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Carte */}
            <div>
              <Suspense fallback={
                <div className="h-[500px] w-3/4 mx-auto flex items-center justify-center bg-muted/30 rounded-lg border">
                  <div className="text-muted-foreground">Chargement de la carte...</div>
                </div>
              }>
                <MapComponent companies={filteredCompanies} />
              </Suspense>
              
              <div className="flex items-center gap-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filtrer par département :</span>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-64 justify-between">
                      {selectedDepartments.length === 0 
                        ? "Tous les départements"
                        : selectedDepartments.length === 1
                        ? selectedDepartments[0]
                        : `${selectedDepartments.length} départements sélectionnés`
                      }
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0 bg-background border shadow-xl" align="start">
                    <div className="p-2 bg-background">
                      <div className="flex items-center space-x-2 p-2 border-b bg-background">
                        <Checkbox 
                          id="select-all"
                          checked={selectedDepartments.length === departments.length}
                          onCheckedChange={handleSelectAll}
                        />
                        <label htmlFor="select-all" className="text-sm font-medium">
                          Tout sélectionner
                        </label>
                      </div>
                      <div className="max-h-48 overflow-y-auto bg-background">
                        {departments.map((department) => (
                          <div key={department} className="flex items-center space-x-2 p-2 hover:bg-muted/50 bg-background">
                            <Checkbox 
                              id={department}
                              checked={selectedDepartments.includes(department)}
                              onCheckedChange={() => handleDepartmentToggle(department)}
                            />
                            <label htmlFor={department} className="text-sm flex-1 cursor-pointer">
                              {department}
                            </label>
                          </div>
                        ))}
                      </div>
                      {selectedDepartments.length > 0 && (
                        <div className="p-2 border-t bg-background">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setSelectedDepartments([])}
                            className="w-full"
                          >
                            Effacer la sélection
                          </Button>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Tableau des entreprises */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Liste des entreprises ({filteredCompanies.length})
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom de l'entreprise</TableHead>
                      <TableHead>Numéro SIPI</TableHead>
                      <TableHead>Ville</TableHead>
                      <TableHead>Département</TableHead>
                      <TableHead>Statistiques Commandes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.company_name}</TableCell>
                        <TableCell>{company.sipi_number}</TableCell>
                        <TableCell>{company.city || "-"}</TableCell>
                        <TableCell>{company.general_department || "-"}</TableCell>
                        <TableCell>
                          {company.orderStats && company.orderStats.length > 0 ? (
                            <div className="space-y-1">
                              {company.orderStats.map((stat) => (
                                <div key={stat.year} className="text-sm">
                                  <div className="font-medium">{stat.year}</div>
                                  <div className="text-muted-foreground">
                                    {stat.totalOrders} commande{stat.totalOrders > 1 ? 's' : ''} - {stat.totalAmount.toLocaleString()} €
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Aucune commande</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompaniesMap;