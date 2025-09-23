import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { MapPin, Building2, Filter, ChevronDown, Globe, Search, CalendarIcon, ChevronUp, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import MapComponent from './MapComponent';
import CompanyDetailDialog from './CompanyDetailDialog';

interface Company {
  id: string;
  sipi_number: string;
  company_name: string;
  latitude: number;
  longitude: number;
  address1?: string;
  city?: string;
  general_department?: string;
  client_blocked_date?: string;
  training_date?: string;
  report_creation_date?: string;
  last_order_date?: string;
  quality?: string;
  orderStats?: CompanyOrderStats[];
  averageOrderPerYear?: number;
}

interface CompanyOrderStats {
  year: number;
  totalOrders: number;
  totalAmount: number;
}

interface CompaniesMapProps {
  clientTypeFilter?: string;
  heatmapMode?: boolean;
  externalFilters?: {
    startDate?: Date;
    endDate?: Date;
    sipiFilter?: string;
    cityFilter?: string;
    companyNameFilter?: string;
  };
}

const CompaniesMap = ({ clientTypeFilter: initialClientTypeFilter = 'all', heatmapMode = false, externalFilters }: CompaniesMapProps) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [geocoding, setGeocoding] = useState(false);
  
  // Company detail dialog state
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyDetailOpen, setCompanyDetailOpen] = useState(false);
  
  // Filtres
  const [sipiFilter, setSipiFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [companyNameFilter, setCompanyNameFilter] = useState('');
  const [minAverageFilter, setMinAverageFilter] = useState('');
  const [maxAverageFilter, setMaxAverageFilter] = useState('');
  const [formationFilter, setFormationFilter] = useState('');
  const [responsableBOFilter, setResponsableBOFilter] = useState('');
  const [formateurFilter, setFormateurFilter] = useState('');
  const [localClientTypeFilter, setLocalClientTypeFilter] = useState(initialClientTypeFilter);

  // Department management data
  const [departmentManagement, setDepartmentManagement] = useState<Record<string, any>>({});
  
  // Date filters
  const [startDate, setStartDate] = useState<Date>(externalFilters?.startDate);
  const [endDate, setEndDate] = useState<Date>(externalFilters?.endDate);

  // Sync external filters with internal state
  useEffect(() => {
    if (externalFilters?.startDate !== undefined) {
      setStartDate(externalFilters.startDate);
    }
    if (externalFilters?.endDate !== undefined) {
      setEndDate(externalFilters.endDate);
    }
    if (externalFilters?.sipiFilter !== undefined) {
      setSipiFilter(externalFilters.sipiFilter);
    }
    if (externalFilters?.cityFilter !== undefined) {
      setCityFilter(externalFilters.cityFilter);
    }
    if (externalFilters?.companyNameFilter !== undefined) {
      setCompanyNameFilter(externalFilters.companyNameFilter);
    }
  }, [externalFilters]);
  
  // Sort state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const { toast } = useToast();

  // Fetch department management data
  const fetchDepartmentManagement = async () => {
    try {
      const { data, error } = await supabase
        .from('department_management')
        .select('*');

      if (error) {
        console.error('Error fetching department management:', error);
        return;
      }

      // Create a lookup map by department name
      const managementMap: Record<string, any> = {};
      data?.forEach(dept => {
        managementMap[dept.department_name] = dept;
      });
      
      setDepartmentManagement(managementMap);
    } catch (error) {
      console.error('Error fetching department management:', error);
    }
  };

  // Get unique departments for filter
  const departments = useMemo(() => {
    const uniqueDepartments = [...new Set(companies
      .map(company => company.general_department)
      .filter(dept => dept)
    )].sort();
    return uniqueDepartments;
  }, [companies]);

  // Get all unique years from order statistics
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    companies.forEach(company => {
      if (company.orderStats) {
        company.orderStats.forEach(stat => years.add(stat.year));
      }
    });
    return Array.from(years).sort((a, b) => b - a); // Sort descending
  }, [companies]);

  // Get unique responsables BO and formateurs for dropdowns
  const uniqueResponsablesBO = useMemo(() => {
    const responsables = new Set<string>();
    Object.values(departmentManagement).forEach((dept: any) => {
      if (dept.responsable_bo) {
        responsables.add(dept.responsable_bo);
      }
    });
    return Array.from(responsables).sort();
  }, [departmentManagement]);

  const uniqueFormateurs = useMemo(() => {
    const formateurs = new Set<string>();
    Object.values(departmentManagement).forEach((dept: any) => {
      if (dept.formateur) {
        formateurs.add(dept.formateur);
      }
    });
    return Array.from(formateurs).sort();
  }, [departmentManagement]);

  // Filter companies based on all filters (date filtering is now done server-side)
  const filteredCompanies = useMemo(() => {
    let filtered = companies.filter(company => {
      // Type de client filter
      if (localClientTypeFilter !== 'all') {
        if (!company.quality || company.quality !== localClientTypeFilter) {
          return false;
        }
      }
      
      // Department filter
      if (selectedDepartments.length > 0) {
        if (!company.general_department || !selectedDepartments.includes(company.general_department)) {
          return false;
        }
      }
      
      // SIPI filter
      if (sipiFilter && !company.sipi_number.toLowerCase().includes(sipiFilter.toLowerCase())) {
        return false;
      }
      
      // City filter
      if (cityFilter && (!company.city || !company.city.toLowerCase().includes(cityFilter.toLowerCase()))) {
        return false;
      }
      
      // Company name filter
      if (companyNameFilter && !company.company_name.toLowerCase().includes(companyNameFilter.toLowerCase())) {
        return false;
      }
      
      // Average filter
      if (minAverageFilter || maxAverageFilter) {
        const average = company.averageOrderPerYear || 0;
        const min = minAverageFilter ? parseFloat(minAverageFilter) : 0;
        const max = maxAverageFilter ? parseFloat(maxAverageFilter) : Infinity;
        
        if (average < min || average > max) {
          return false;
        }
      }
      
      // Formation filter
      if (formationFilter) {
        let formationStatus = 'non_formee';
        
        if (company.training_date) {
          formationStatus = 'formee_payant'; // Structure Formée (Uniquement payant)
        } else if (company.report_creation_date) {
          formationStatus = 'formee_mixte'; // Structure Formée* (Payant comme gratuit)
        }
        
        if (formationStatus !== formationFilter) {
          return false;
        }
      }
      
      // Responsable BO filter
      if (responsableBOFilter && company.general_department) {
        const deptData = departmentManagement[company.general_department];
        if (!deptData || !deptData.responsable_bo || 
            !deptData.responsable_bo.toLowerCase().includes(responsableBOFilter.toLowerCase())) {
          return false;
        }
      }
      
      // Formateur filter
      if (formateurFilter && company.general_department) {
        const deptData = departmentManagement[company.general_department];
        if (!deptData || !deptData.formateur || 
            !deptData.formateur.toLowerCase().includes(formateurFilter.toLowerCase())) {
          return false;
        }
      }
      
      return true;
    });

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (sortColumn) {
          case 'company_name':
            aValue = a.company_name.toLowerCase();
            bValue = b.company_name.toLowerCase();
            break;
          case 'sipi_number':
            aValue = a.sipi_number;
            bValue = b.sipi_number;
            break;
          case 'city':
            aValue = (a.city || '').toLowerCase();
            bValue = (b.city || '').toLowerCase();
            break;
          case 'general_department':
            aValue = (a.general_department || '').toLowerCase();
            bValue = (b.general_department || '').toLowerCase();
            break;
          case 'averageOrderPerYear':
            aValue = a.averageOrderPerYear || 0;
            bValue = b.averageOrderPerYear || 0;
            break;
          default:
            // For year columns (format: "year_YYYY")
            if (sortColumn.startsWith('year_')) {
              const year = parseInt(sortColumn.replace('year_', ''));
              const aData = a.orderStats?.find(stat => stat.year === year);
              const bData = b.orderStats?.find(stat => stat.year === year);
              aValue = aData?.totalAmount || 0;
              bValue = bData?.totalAmount || 0;
            } else {
              return 0;
            }
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue);
          return sortDirection === 'asc' ? comparison : -comparison;
        } else {
          const comparison = aValue - bValue;
          return sortDirection === 'asc' ? comparison : -comparison;
        }
      });
    }

    return filtered;
  }, [companies, localClientTypeFilter, selectedDepartments, sipiFilter, cityFilter, companyNameFilter, minAverageFilter, maxAverageFilter, formationFilter, responsableBOFilter, formateurFilter, departmentManagement, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleCompanyClick = async (company: Company) => {
    // Fetch complete company data
    try {
      const { data: fullCompanyData, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', company.id)
        .single();

      if (error) {
        console.error('Error fetching company details:', error);
        return;
      }

      setSelectedCompany(fullCompanyData);
      setCompanyDetailOpen(true);
    } catch (error) {
      console.error('Error fetching company details:', error);
    }
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4" />
      : <ChevronDown className="w-4 h-4" />;
  };

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
      
      // Récupérer toutes les entreprises en utilisant une approche de pagination
      let allCompanies: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: companiesBatch, error: companiesError } = await supabase
          .from('companies')
          .select('id, sipi_number, company_name, latitude, longitude, address1, city, general_department, client_blocked_date, training_date, report_creation_date, last_order_date, quality')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .range(from, from + batchSize - 1);

        if (companiesError) {
          console.error('Error fetching companies:', companiesError);
          setError('Erreur lors du chargement des entreprises');
          return;
        }

        if (companiesBatch && companiesBatch.length > 0) {
          allCompanies = [...allCompanies, ...companiesBatch];
          from += batchSize;
          hasMore = companiesBatch.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`Total entreprises récupérées: ${allCompanies.length}`);

      // Récupérer les commandes avec filtrage par date si spécifié
      console.log('Fetching order statistics...');
      let allOrders: any[] = [];
      from = 0;
      hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('orders')
          .select('sipi_number, order_date, amount');
        
        // Apply date filters at database level
        if (startDate) {
          query = query.gte('order_date', startDate.toISOString().split('T')[0]);
        }
        if (endDate) {
          query = query.lte('order_date', endDate.toISOString().split('T')[0]);
        }

        const { data: ordersBatch, error: ordersError } = await query
          .range(from, from + batchSize - 1);

        if (ordersError) {
          console.error('Error fetching orders:', ordersError);
          setError('Erreur lors du chargement des commandes');
          return;
        }

        if (ordersBatch && ordersBatch.length > 0) {
          allOrders = [...allOrders, ...ordersBatch];
          from += batchSize;
          hasMore = ordersBatch.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`Total commandes récupérées: ${allOrders.length}`);

      // Group orders by SIPI and year
      const orderStatsByCompany = new Map<string, Map<number, { totalOrders: number; totalAmount: number }>>();
      
      allOrders.forEach(order => {
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
      const companiesWithStats: Company[] = allCompanies.map(company => {
        const companyOrderStats = orderStatsByCompany.get(company.sipi_number);
        const orderStats: CompanyOrderStats[] = [];
        let totalAmount = 0;
        let totalYears = 0;
        
        if (companyOrderStats) {
          companyOrderStats.forEach((stats, year) => {
            orderStats.push({
              year,
              totalOrders: stats.totalOrders,
              totalAmount: stats.totalAmount
            });
            totalAmount += stats.totalAmount;
            totalYears++;
          });
          // Sort by year descending
          orderStats.sort((a, b) => b.year - a.year);
        }
        
        // Calculate average order amount per year
        const averageOrderPerYear = totalYears > 0 ? totalAmount / totalYears : 0;
        
        return {
          ...company,
          orderStats,
          averageOrderPerYear
        };
      });

      console.log('Companies with stats processed:', companiesWithStats?.length || 0);
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

    // Also fetch department management data
    fetchDepartmentManagement();
  }, [startDate, endDate]); // Re-add dependencies to reload when dates change

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
              <MapComponent companies={filteredCompanies} heatmapMode={heatmapMode} />
              
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

            {/* Filtres */}
            <div className="bg-muted/30 p-4 rounded-lg space-y-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5" />
                Filtres
              </h3>
              
              {/* Date Range Filter */}
              <div className="flex flex-col gap-4">
                <h4 className="text-md font-medium">Période des commandes</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-2">Date de début</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "dd/MM/yyyy") : "Sélectionner une date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">Date de fin</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "dd/MM/yyyy") : "Sélectionner une date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                {(startDate || endDate) && (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setStartDate(undefined);
                        setEndDate(undefined);
                      }}
                    >
                      Effacer les dates
                    </Button>
                    <div className="text-sm text-muted-foreground flex items-center">
                      {startDate && endDate 
                        ? `Période: ${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`
                        : startDate 
                        ? `À partir du: ${format(startDate, "dd/MM/yyyy")}`
                        : endDate 
                        ? `Jusqu'au: ${format(endDate, "dd/MM/yyyy")}`
                        : ''
                      }
                    </div>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
                <div>
                  <label className="text-sm font-medium">Numéro SIPI</label>
                  <Input
                    placeholder="Rechercher par SIPI..."
                    value={sipiFilter}
                    onChange={(e) => setSipiFilter(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Ville</label>
                  <Input
                    placeholder="Rechercher par ville..."
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Nom de l'entreprise</label>
                  <Input
                    placeholder="Rechercher par nom..."
                    value={companyNameFilter}
                    onChange={(e) => setCompanyNameFilter(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Moyenne min (€)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={minAverageFilter}
                    onChange={(e) => setMinAverageFilter(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Moyenne max (€)</label>
                  <Input
                    type="number"
                    placeholder="1000000"
                    value={maxAverageFilter}
                    onChange={(e) => setMaxAverageFilter(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Formation</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {formationFilter === '' 
                          ? "Tout"
                          : formationFilter === 'formee_payant'
                          ? "Structure Formée (Uniquement payant)"
                          : formationFilter === 'formee_mixte'
                          ? "Structure Formée* (Payant comme gratuit)"
                          : "Structure non formée"
                        }
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0 bg-background border shadow-xl z-[9999]" align="start">
                      <div className="p-2 bg-background">
                        <div className="space-y-1">
                          <Button
                            variant={formationFilter === '' ? 'default' : 'ghost'}
                            className="w-full justify-start text-sm"
                            onClick={() => setFormationFilter('')}
                          >
                            Tout
                          </Button>
                          <Button
                            variant={formationFilter === 'non_formee' ? 'default' : 'ghost'}
                            className="w-full justify-start text-sm"
                            onClick={() => setFormationFilter('non_formee')}
                          >
                            Structure non formée
                          </Button>
                          <Button
                            variant={formationFilter === 'formee_mixte' ? 'default' : 'ghost'}
                            className="w-full justify-start text-sm"
                            onClick={() => setFormationFilter('formee_mixte')}
                          >
                            Structure Formée* (Payant comme gratuit)
                          </Button>
                          <Button
                            variant={formationFilter === 'formee_payant' ? 'default' : 'ghost'}
                            className="w-full justify-start text-sm"
                            onClick={() => setFormationFilter('formee_payant')}
                          >
                            Structure Formée (Uniquement payant)
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-sm font-medium">Responsable BO</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {responsableBOFilter === '' 
                          ? "Tous les responsables BO"
                          : responsableBOFilter
                        }
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0 bg-background border shadow-xl z-[9999]" align="start">
                      <div className="p-2 bg-background">
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          <Button
                            variant={responsableBOFilter === '' ? 'default' : 'ghost'}
                            className="w-full justify-start text-sm"
                            onClick={() => setResponsableBOFilter('')}
                          >
                            Tous les responsables BO
                          </Button>
                          {uniqueResponsablesBO.map((responsable) => (
                            <Button
                              key={responsable}
                              variant={responsableBOFilter === responsable ? 'default' : 'ghost'}
                              className="w-full justify-start text-sm"
                              onClick={() => setResponsableBOFilter(responsable)}
                            >
                              {responsable}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-sm font-medium">Formateur</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {formateurFilter === '' 
                          ? "Tous les formateurs"
                          : formateurFilter
                        }
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0 bg-background border shadow-xl z-[9999]" align="start">
                      <div className="p-2 bg-background">
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          <Button
                            variant={formateurFilter === '' ? 'default' : 'ghost'}
                            className="w-full justify-start text-sm"
                            onClick={() => setFormateurFilter('')}
                          >
                            Tous les formateurs
                          </Button>
                          {uniqueFormateurs.map((formateur) => (
                            <Button
                              key={formateur}
                              variant={formateurFilter === formateur ? 'default' : 'ghost'}
                              className="w-full justify-start text-sm"
                              onClick={() => setFormateurFilter(formateur)}
                            >
                              {formateur}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-sm font-medium">Type de client</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {localClientTypeFilter === 'all' 
                          ? "Tous les clients"
                          : localClientTypeFilter === 'INDUSTRIE'
                          ? "Clients"
                          : "Revendeurs"
                        }
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-0 bg-background border shadow-xl z-[9999]" align="start">
                      <div className="p-2 bg-background">
                        <div className="space-y-1">
                          <Button
                            variant={localClientTypeFilter === 'all' ? 'default' : 'ghost'}
                            className="w-full justify-start text-sm"
                            onClick={() => setLocalClientTypeFilter('all')}
                          >
                            Tous les clients
                          </Button>
                          <Button
                            variant={localClientTypeFilter === 'INDUSTRIE' ? 'default' : 'ghost'}
                            className="w-full justify-start text-sm"
                            onClick={() => setLocalClientTypeFilter('INDUSTRIE')}
                          >
                            Clients
                          </Button>
                          <Button
                            variant={localClientTypeFilter === 'DISTRIBUTEUR' ? 'default' : 'ghost'}
                            className="w-full justify-start text-sm"
                            onClick={() => setLocalClientTypeFilter('DISTRIBUTEUR')}
                          >
                            Revendeurs
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              {(sipiFilter || cityFilter || companyNameFilter || minAverageFilter || maxAverageFilter || formationFilter || responsableBOFilter || formateurFilter || localClientTypeFilter !== 'all') && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setSipiFilter('');
                    setCityFilter('');
                    setCompanyNameFilter('');
                    setMinAverageFilter('');
                    setMaxAverageFilter('');
                    setFormationFilter('');
                    setResponsableBOFilter('');
                    setFormateurFilter('');
                    setLocalClientTypeFilter('all');
                  }}
                  className="w-full mt-2"
                >
                  Effacer tous les filtres
                </Button>
              )}
            </div>

            {/* Tableau des entreprises */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Liste des entreprises ({filteredCompanies.length})
              </h3>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="min-w-[200px] cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('company_name')}
                      >
                        <div className="flex items-center gap-2">
                          Nom de l'entreprise
                          {getSortIcon('company_name')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="min-w-[120px] cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('sipi_number')}
                      >
                        <div className="flex items-center gap-2">
                          Numéro SIPI
                          {getSortIcon('sipi_number')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="min-w-[100px] cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('city')}
                      >
                        <div className="flex items-center gap-2">
                           Ville
                           {getSortIcon('city')}
                         </div>
                       </TableHead>
                       <TableHead className="min-w-[120px]">Client bloqué</TableHead>
                       <TableHead className="min-w-[150px]">Formation (Date de cmd SIPI)</TableHead>
                       <TableHead className="min-w-[180px]">Date approx Formation (rapport SIPI)</TableHead>
                       <TableHead className="min-w-[200px]">Formation</TableHead>
                      <TableHead 
                        className="min-w-[100px] cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('general_department')}
                      >
                        <div className="flex items-center gap-2">
                          Département
                          {getSortIcon('general_department')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="min-w-[120px] cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('averageOrderPerYear')}
                      >
                        <div className="flex items-center gap-2">
                          Moyenne/an (€)
                          {getSortIcon('averageOrderPerYear')}
                        </div>
                      </TableHead>
                      {availableYears.map(year => (
                        <TableHead 
                          key={year} 
                          className="min-w-[150px] text-center cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort(`year_${year}`)}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <div>
                              {year}
                              <div className="text-xs text-muted-foreground font-normal">
                                Détail par année
                              </div>
                            </div>
                            {getSortIcon(`year_${year}`)}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map((company) => {
                      // Create a map for quick lookup of year data
                      const yearDataMap = new Map(
                        company.orderStats?.map(stat => [stat.year, stat]) || []
                      );
                      
                      return (
                        <TableRow key={company.id}>
                          <TableCell 
                            className="font-medium cursor-pointer hover:text-primary hover:underline"
                            onClick={() => handleCompanyClick(company)}
                          >
                            {company.company_name}
                          </TableCell>
                          <TableCell>{company.sipi_number}</TableCell>
                          <TableCell>{company.city || "-"}</TableCell>
                          <TableCell>
                            {company.client_blocked_date && company.last_order_date && 
                             new Date(company.client_blocked_date) > new Date(company.last_order_date) ? (
                              <span className="text-destructive font-medium">Oui</span>
                            ) : (
                              <span className="text-muted-foreground">Non</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {company.training_date ? format(new Date(company.training_date), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell>
                            {company.report_creation_date ? format(new Date(company.report_creation_date), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {company.training_date ? (
                                <span className="text-green-700 font-medium">Structure Formée (Uniquement payant)</span>
                              ) : company.report_creation_date ? (
                                <span className="text-blue-700 font-medium">Structure Formée* (Payant comme gratuit)</span>
                              ) : (
                                <span className="text-muted-foreground">Structure non formée</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{company.general_department || "-"}</TableCell>
                          <TableCell className="font-medium">
                            {company.averageOrderPerYear ? 
                              `${Math.round(company.averageOrderPerYear).toLocaleString()} €` : 
                              "-"
                            }
                          </TableCell>
                          {availableYears.map(year => {
                            const yearData = yearDataMap.get(year);
                            return (
                              <TableCell key={year} className="text-center">
                                {yearData ? (
                                  <div className="space-y-1">
                                    <div className="font-medium text-primary">
                                      {yearData.totalOrders}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {yearData.totalAmount.toLocaleString()} €
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Company Detail Dialog */}
      <CompanyDetailDialog
        company={selectedCompany}
        open={companyDetailOpen}
        onOpenChange={setCompanyDetailOpen}
        departmentManagement={departmentManagement}
      />
    </Card>
  );
};

export default CompaniesMap;