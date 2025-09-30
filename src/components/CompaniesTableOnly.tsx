import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Filter, ChevronDown, Search, CalendarIcon, ChevronUp, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
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
  periodOrders?: number;
  periodAmount?: number;
}

interface CompanyOrderStats {
  year: number;
  totalOrders: number;
  totalAmount: number;
}

interface CompaniesTableOnlyProps {
  startDate?: Date;
  endDate?: Date;
  onDateChange?: {
    setStartDate: (date: Date | undefined) => void;
    setEndDate: (date: Date | undefined) => void;
  };
}

const CompaniesTableOnly = ({ 
  startDate: externalStartDate,
  endDate: externalEndDate,
  onDateChange
}: CompaniesTableOnlyProps) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [totalCompanies, setTotalCompanies] = useState(0);
  
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
  const [localClientTypeFilter, setLocalClientTypeFilter] = useState('all');

  // Department management data
  const [departmentManagement, setDepartmentManagement] = useState<Record<string, any>>({});
  
  // Date filters - use external ones if provided, otherwise local state
  const [localStartDate, setLocalStartDate] = useState<Date>();
  const [localEndDate, setLocalEndDate] = useState<Date>();
  
  const startDate = externalStartDate ?? localStartDate;
  const endDate = externalEndDate ?? localEndDate;
  
  const setStartDate = onDateChange?.setStartDate ?? setLocalStartDate;
  const setEndDate = onDateChange?.setEndDate ?? setLocalEndDate;
  
  // Sort state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const { toast } = useToast();

  // Load companies and order data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Load companies with pagination
        let allCompanies: any[] = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data: companiesData, error: companiesError } = await supabase
            .from('companies')
            .select('*')
            .range(from, from + batchSize - 1);

          if (companiesError) {
            console.error('Error loading companies:', companiesError);
            setError('Erreur lors du chargement des entreprises');
            return;
          }

          if (companiesData && companiesData.length > 0) {
            allCompanies = [...allCompanies, ...companiesData];
            from += batchSize;
            hasMore = companiesData.length === batchSize;
          } else {
            hasMore = false;
          }
        }

        // Load orders with pagination
        let allOrders: any[] = [];
        from = 0;
        hasMore = true;

        while (hasMore) {
          const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select('sipi_number, total_amount, delivery_date')
            .range(from, from + batchSize - 1);

          if (ordersError) {
            console.error('Error loading orders:', ordersError);
            setError('Erreur lors du chargement des commandes');
            return;
          }

          if (ordersData && ordersData.length > 0) {
            allOrders = [...allOrders, ...ordersData];
            from += batchSize;
            hasMore = ordersData.length === batchSize;
          } else {
            hasMore = false;
          }
        }

        // Group orders by SIPI number and year
        const ordersByCompany = new Map<string, Map<number, { totalOrders: number; totalAmount: number }>>();
        
        allOrders.forEach(order => {
          if (!order.sipi_number || !order.delivery_date) return;
          
          const year = new Date(order.delivery_date).getFullYear();
          if (isNaN(year)) return;
          
          if (!ordersByCompany.has(order.sipi_number)) {
            ordersByCompany.set(order.sipi_number, new Map());
          }
          
          const yearMap = ordersByCompany.get(order.sipi_number)!;
          if (!yearMap.has(year)) {
            yearMap.set(year, { totalOrders: 0, totalAmount: 0 });
          }
          
          const yearData = yearMap.get(year)!;
          yearData.totalOrders += 1;
          yearData.totalAmount += parseFloat(order.total_amount) || 0;
        });

        // Add order stats to companies
        const companiesWithStats = allCompanies.map(company => {
          const orderStats: CompanyOrderStats[] = [];
          const companyOrders = ordersByCompany.get(company.sipi_number);
          
          if (companyOrders) {
            companyOrders.forEach((data, year) => {
              orderStats.push({
                year,
                totalOrders: data.totalOrders,
                totalAmount: data.totalAmount
              });
            });
          }
          
          orderStats.sort((a, b) => a.year - b.year);
          
          const totalOrders = orderStats.reduce((sum, stat) => sum + stat.totalOrders, 0);
          const averageOrderPerYear = orderStats.length > 0 ? totalOrders / orderStats.length : 0;

          return {
            ...company,
            orderStats,
            averageOrderPerYear
          };
        });

        setCompanies(companiesWithStats);
        setTotalCompanies(companiesWithStats.length);
        
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter companies based on all criteria
  const filteredCompanies = useMemo(() => {
    return companies.filter(company => {
      // SIPI filter
      if (sipiFilter && !company.sipi_number?.toLowerCase().includes(sipiFilter.toLowerCase())) {
        return false;
      }
      
      // City filter
      if (cityFilter && !company.city?.toLowerCase().includes(cityFilter.toLowerCase())) {
        return false;
      }
      
      // Company name filter
      if (companyNameFilter && !company.company_name?.toLowerCase().includes(companyNameFilter.toLowerCase())) {
        return false;
      }
      
      // Average order filter
      if (minAverageFilter || maxAverageFilter) {
        const avg = company.averageOrderPerYear || 0;
        if (minAverageFilter && avg < parseFloat(minAverageFilter)) return false;
        if (maxAverageFilter && avg > parseFloat(maxAverageFilter)) return false;
      }
      
      // Department filter
      if (selectedDepartments.length > 0 && !selectedDepartments.includes(company.general_department || '')) {
        return false;
      }
      
      return true;
    });
  }, [companies, sipiFilter, cityFilter, companyNameFilter, minAverageFilter, maxAverageFilter, selectedDepartments]);

  // Get unique departments for filter
  const uniqueDepartments = useMemo(() => {
    const depts = new Set(companies.map(c => c.general_department).filter(Boolean));
    return Array.from(depts).sort();
  }, [companies]);

  // Get available years from order data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    companies.forEach(company => {
      company.orderStats?.forEach(stat => {
        years.add(stat.year);
      });
    });
    return Array.from(years).sort();
  }, [companies]);

  // Sort companies
  const sortedCompanies = useMemo(() => {
    if (!sortColumn) return filteredCompanies;
    
    return [...filteredCompanies].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortColumn) {
        case 'sipi_number':
          aValue = a.sipi_number || '';
          bValue = b.sipi_number || '';
          break;
        case 'company_name':
          aValue = a.company_name || '';
          bValue = b.company_name || '';
          break;
        case 'city':
          aValue = a.city || '';
          bValue = b.city || '';
          break;
        case 'general_department':
          aValue = a.general_department || '';
          bValue = b.general_department || '';
          break;
        case 'averageOrderPerYear':
          aValue = a.averageOrderPerYear || 0;
          bValue = b.averageOrderPerYear || 0;
          break;
        default:
          return 0;
      }
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredCompanies, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Chargement des données...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="space-y-4">
        {/* Date filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Date de début:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd/MM/yyyy") : "Sélectionner"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Date de fin:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "dd/MM/yyyy") : "Sélectionner"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Search filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">SIPI</label>
            <Input
              placeholder="Rechercher SIPI..."
              value={sipiFilter}
              onChange={(e) => setSipiFilter(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Ville</label>
            <Input
              placeholder="Rechercher ville..."
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Entreprise</label>
            <Input
              placeholder="Nom d'entreprise..."
              value={companyNameFilter}
              onChange={(e) => setCompanyNameFilter(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Moyenne Min</label>
            <Input
              type="number"
              placeholder="Commandes/an min"
              value={minAverageFilter}
              onChange={(e) => setMinAverageFilter(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Moyenne Max</label>
            <Input
              type="number"
              placeholder="Commandes/an max"
              value={maxAverageFilter}
              onChange={(e) => setMaxAverageFilter(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {/* Department filter */}
        <div className="flex items-center space-x-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-between">
                <Filter className="w-4 h-4 mr-2" />
                Départements ({selectedDepartments.length})
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {uniqueDepartments.map((dept) => (
                  <div key={dept} className="flex items-center space-x-2">
                    <Checkbox
                      id={dept}
                      checked={selectedDepartments.includes(dept)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedDepartments([...selectedDepartments, dept]);
                        } else {
                          setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
                        }
                      }}
                    />
                    <label htmlFor={dept} className="text-sm cursor-pointer">
                      {dept}
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            onClick={() => {
              setSipiFilter('');
              setCityFilter('');
              setCompanyNameFilter('');
              setMinAverageFilter('');
              setMaxAverageFilter('');
              setSelectedDepartments([]);
              setStartDate(undefined);
              setEndDate(undefined);
            }}
          >
            Effacer les filtres
          </Button>
        </div>
      </div>

      {/* Results summary */}
      <div className="text-sm text-muted-foreground">
        {sortedCompanies.length} entreprise{sortedCompanies.length !== 1 ? 's' : ''} trouvée{sortedCompanies.length !== 1 ? 's' : ''} sur {totalCompanies}
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 p-0 font-semibold"
                    onClick={() => handleSort('sipi_number')}
                  >
                    SIPI
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 p-0 font-semibold"
                    onClick={() => handleSort('company_name')}
                  >
                    Entreprise
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 p-0 font-semibold"
                    onClick={() => handleSort('city')}
                  >
                    Ville
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 p-0 font-semibold"
                    onClick={() => handleSort('general_department')}
                  >
                    Département
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 p-0 font-semibold"
                    onClick={() => handleSort('averageOrderPerYear')}
                  >
                    Moyenne/An
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                {availableYears.map(year => (
                  <TableHead key={year} className="text-center min-w-[100px]">
                    {year}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCompanies.map((company) => {
                const yearDataMap = new Map<number, CompanyOrderStats>();
                company.orderStats?.forEach(stat => {
                  yearDataMap.set(stat.year, stat);
                });

                return (
                  <TableRow 
                    key={company.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedCompany(company);
                      setCompanyDetailOpen(true);
                    }}
                  >
                    <TableCell className="font-medium">{company.sipi_number}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {company.company_name}
                    </TableCell>
                    <TableCell>{company.city || '-'}</TableCell>
                    <TableCell>{company.general_department || '-'}</TableCell>
                    <TableCell className="text-center">
                      {company.averageOrderPerYear ? (
                        <span className="font-medium text-primary">
                          {Math.round(company.averageOrderPerYear)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
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

      {/* Company Detail Dialog */}
      <CompanyDetailDialog
        company={selectedCompany}
        open={companyDetailOpen}
        onOpenChange={setCompanyDetailOpen}
        departmentManagement={departmentManagement}
      />
    </div>
  );
};

export default CompaniesTableOnly;